<?php

namespace App\Http\Middleware;

use App\Models\Device;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountState
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $user->is_active || $user->isExpired()) {
            $user->currentAccessToken()?->delete();

            return response()->json(['message' => 'This account is blocked.', 'status' => 'inactive'], 401);
        }

        $token = $user->currentAccessToken();
        $deviceId = (is_object($token) && isset($token->device_id)) ? $token->device_id : null;
        if ($deviceId) {
            $device = Device::query()->find($deviceId);
            if ($device && $device->revoked_at) {
                $token->delete();

                return response()->json(['message' => 'This device was revoked.', 'status' => 'revoked'], 401);
            }
        }

        $path = $request->path();
        $passwordAllowed = str_contains($path, 'auth/change-password') || str_contains($path, 'auth/logout');
        if ($user->must_change_password && ! $passwordAllowed) {
            return response()->json(['message' => 'Change your password before continuing.', 'status' => 'must_change_password'], 403);
        }

        $twoFactorAllowed = $passwordAllowed
            || str_contains($path, 'auth/two-factor')
            || str_contains($path, 'auth/me');
        if ($user->requiresTwoFactor() && $user->two_factor_confirmed_at === null && ! $twoFactorAllowed) {
            return response()->json(['message' => 'Set up two-factor login before continuing.', 'status' => 'must_setup_two_factor'], 403);
        }

        return $next($request);
    }
}
