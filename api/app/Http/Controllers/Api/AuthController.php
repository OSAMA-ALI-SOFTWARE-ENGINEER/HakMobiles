<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use PragmaRX\Google2FA\Google2FA;

class AuthController extends Controller
{
    public function login(Request $request, Google2FA $google2fa): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['required', 'string', 'max:120'],
            'platform' => ['nullable', 'string', 'max:40'],
            'app_version' => ['nullable', 'string', 'max:40'],
            'otp' => ['nullable', 'string'],
        ]);

        $email = strtolower($data['email']);
        $lockKey = 'login-lock:'.$email;
        if (Cache::has($lockKey)) {
            return response()->json(['message' => 'Too many attempts. Try again in 15 minutes.'], 429);
        }

        $user = User::query()->where('email', $email)->first();
        $passwordOk = $user && Hash::check($data['password'], $user->password);

        if (! $passwordOk) {
            $attemptsKey = 'login-attempts:'.$email;
            $attempts = ((int) Cache::get($attemptsKey, 0)) + 1;
            Cache::put($attemptsKey, $attempts, now()->addMinute());
            if ($attempts >= 5) {
                Cache::put($lockKey, true, now()->addMinutes(15));
            }
            Audit::log('login.failed', null, ['email' => $email]);

            return response()->json(['message' => 'These credentials do not match our records.'], 401);
        }

        if (! $user->is_active || $user->isExpired()) {
            Audit::log('login.blocked', $user, ['email' => $email]);

            return response()->json(['message' => 'This account cannot sign in.'], 401);
        }

        if (config('hak.two_factor_enabled') && $user->two_factor_confirmed_at) {
            $otp = $data['otp'] ?? '';
            $valid = $otp !== '' && $google2fa->verifyKey((string) $user->two_factor_secret, $otp);
            if (! $valid) {
                return response()->json(['message' => 'Two-factor code required.', 'two_factor_required' => true], 422);
            }
        }

        Cache::forget('login-attempts:'.$email);
        Cache::forget($lockKey);

        $device = Device::query()->firstOrCreate(
            ['user_id' => $user->id, 'name' => $data['device_name']],
            [
                'platform' => $data['platform'] ?? null,
                'app_version' => $data['app_version'] ?? null,
                'invoice_prefix' => $this->nextPrefix($user),
            ],
        );

        if ($device->revoked_at) {
            return response()->json(['message' => 'This device was revoked.', 'status' => 'revoked'], 401);
        }

        $device->forceFill([
            'platform' => $data['platform'] ?? $device->platform,
            'app_version' => $data['app_version'] ?? $device->app_version,
        ])->save();

        $token = $user->createToken($device->name, ['*'], now()->addDays(30));
        $token->accessToken->forceFill(['device_id' => $device->id])->save();

        Audit::log('login.succeeded', $user, ['device_id' => $device->id]);

        return response()->json([
            'token' => $token->plainTextToken,
            'user' => $this->profile($user),
            'permissions' => $user->getAllPermissions()->pluck('name')->values(),
            'device' => [
                'id' => $device->id,
                'name' => $device->name,
                'invoice_prefix' => $device->invoice_prefix,
            ],
            'must_change_password' => $user->must_change_password,
            'must_setup_two_factor' => $user->requiresTwoFactor() && $user->two_factor_confirmed_at === null,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();
        Audit::log('logout');

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => $this->profile($user),
            'permissions' => $user->getAllPermissions()->pluck('name')->values(),
            'must_change_password' => $user->must_change_password,
            'must_setup_two_factor' => $user->requiresTwoFactor() && $user->two_factor_confirmed_at === null,
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'confirmed', Password::min(10)],
        ]);

        $user = $request->user();
        $user->forceFill([
            'password' => $data['password'],
            'must_change_password' => false,
        ])->save();

        Audit::log('password.changed', $user);

        return response()->json(['message' => 'Password updated.']);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        if ($request->exists('role') || $request->exists('roles') || $request->exists('is_active')) {
            return response()->json(['message' => 'You cannot change your role here.'], 422);
        }

        $user = $request->user();
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'notify_overdue' => ['sometimes', 'boolean'],
        ]);

        $user->fill($data)->save();
        Audit::log('profile.updated', $user);

        return response()->json(['user' => $this->profile($user->fresh())]);
    }

    public function setupTwoFactor(Request $request, Google2FA $google2fa): JsonResponse
    {
        $secret = DB::transaction(function () use ($request, $google2fa) {
            $user = User::query()->lockForUpdate()->findOrFail($request->user()->id);
            if ($user->two_factor_secret && $user->two_factor_confirmed_at === null) {
                return (string) $user->two_factor_secret;
            }

            $secret = $google2fa->generateSecretKey();
            $user->forceFill([
                'two_factor_secret' => $secret,
                'two_factor_confirmed_at' => null,
            ])->save();

            return $secret;
        });

        return response()->json([
            'secret' => $secret,
            'otpauth_url' => $google2fa->getQRCodeUrl(config('app.name'), $request->user()->email, $secret),
        ]);
    }

    public function confirmTwoFactor(Request $request, Google2FA $google2fa): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string']]);
        $user = $request->user();

        if (! $user->two_factor_secret || ! $google2fa->verifyKey((string) $user->two_factor_secret, $data['code'])) {
            return response()->json(['message' => 'The code is not valid.'], 422);
        }

        $user->forceFill(['two_factor_confirmed_at' => now()])->save();
        Audit::log('two_factor.enabled', $user);

        return response()->json(['message' => 'Two-factor login is on.']);
    }

    private function profile(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'avatar_path' => $user->avatar_path,
            'notify_overdue' => $user->notify_overdue ?? true,
            'is_active' => $user->is_active,
            'roles' => $user->getRoleNames()->values(),
        ];
    }

    private function nextPrefix(User $user): string
    {
        $letters = strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $user->name) ?: 'USR', 0, 3));
        $letters = str_pad($letters, 3, 'X');
        $n = Device::query()->where('invoice_prefix', 'like', $letters.'%')->count() + 1;
        $prefix = $letters.$n;

        while (Device::query()->where('invoice_prefix', $prefix)->exists()) {
            $n++;
            $prefix = $letters.$n;
        }

        return $prefix;
    }
}
