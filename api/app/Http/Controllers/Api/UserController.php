<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::query()->whereNull('purged_at')->with('roles')->orderBy('name')->get()->map(fn (User $user) => $this->present($user));

        return response()->json(['data' => $users]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:40'],
            'role' => ['required', 'string', Rule::exists('roles', 'name')],
            'expires_at' => ['nullable', 'date'],
        ]);

        $temporary = Str::password(12, symbols: true);
        $user = User::query()->create([
            'name' => $data['name'],
            'email' => strtolower($data['email']),
            'phone' => $data['phone'] ?? null,
            'password' => $temporary,
            'must_change_password' => true,
            'is_active' => true,
            'expires_at' => $data['expires_at'] ?? null,
        ]);
        $user->assignRole($data['role']);
        Audit::log('user.created', $user, ['role' => $data['role']]);

        return response()->json([
            'user' => $this->present($user),
            'temporary_password' => $temporary,
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'role' => ['sometimes', 'string', Rule::exists('roles', 'name')],
            'expires_at' => ['nullable', 'date'],
            'require_two_factor' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['role']) && $user->hasRole('Super Admin') && $data['role'] !== 'Super Admin' && $this->activeSuperAdmins() <= 1) {
            return response()->json(['message' => 'At least one super admin must remain.'], 422);
        }

        $user->fill(array_intersect_key($data, array_flip(['name', 'phone', 'expires_at'])));
        $user->save();
        if (isset($data['role'])) {
            $user->syncRoles([$data['role']]);
        }
        Audit::log('user.updated', $user, $data);

        return response()->json(['user' => $this->present($user->fresh())]);
    }

    public function resetPassword(User $user): JsonResponse
    {
        $temporary = Str::password(12, symbols: true);
        $user->forceFill([
            'password' => $temporary,
            'must_change_password' => true,
        ])->save();
        $user->tokens()->delete();
        Audit::log('user.password_reset', $user);

        return response()->json(['temporary_password' => $temporary]);
    }

    public function deactivate(User $user): JsonResponse
    {
        if ($user->hasRole('Super Admin') && $this->activeSuperAdmins() <= 1) {
            return response()->json(['message' => 'At least one super admin must remain.'], 422);
        }

        $user->forceFill(['is_active' => false])->save();
        $user->tokens()->delete();
        Audit::log('user.deactivated', $user);

        return response()->json(['user' => $this->present($user->fresh())]);
    }

    public function reactivate(User $user): JsonResponse
    {
        if ($user->purged_at) {
            return response()->json(['message' => 'This login was deleted permanently.'], 422);
        }

        $user->forceFill(['is_active' => true])->save();
        Audit::log('user.reactivated', $user);

        return response()->json(['user' => $this->present($user->fresh())]);
    }

    public function purge(Request $request, User $user): JsonResponse
    {
        if ($request->user()?->id === $user->id) {
            return response()->json(['message' => 'You cannot delete your own login.'], 422);
        }

        if ($user->hasRole('Super Admin') && $user->is_active && $this->activeSuperAdmins() <= 1) {
            return response()->json(['message' => 'At least one super admin must remain.'], 422);
        }

        $user->tokens()->delete();
        $user->forceFill([
            'is_active' => false,
            'purged_at' => now(),
            'email' => 'purged-'.$user->id.'@hak.invalid',
        ])->save();
        Audit::log('user.purged', $user);

        return response()->json(['message' => 'User deleted.']);
    }

    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'is_active' => $user->is_active,
            'must_change_password' => $user->must_change_password,
            'expires_at' => $user->expires_at,
            'two_factor_confirmed_at' => $user->two_factor_confirmed_at,
            'roles' => $user->getRoleNames()->values(),
        ];
    }

    private function activeSuperAdmins(): int
    {
        return User::role('Super Admin')->where('is_active', true)->count();
    }
}
