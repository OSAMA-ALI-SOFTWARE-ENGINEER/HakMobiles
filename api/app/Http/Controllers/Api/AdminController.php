<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\User;
use App\Support\AccessMatrix;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Spatie\Activitylog\Models\Activity;
use Spatie\Permission\Models\Role;

class AdminController extends Controller
{
    public function users(): JsonResponse
    {
        $users = User::query()->with('roles:id,name')->orderBy('name')->get()->map(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'is_active' => $user->is_active,
            'must_change_password' => $user->must_change_password,
            'expires_at' => $user->expires_at,
            'two_factor_confirmed_at' => $user->two_factor_confirmed_at,
            'roles' => $user->getRoleNames()->values(),
        ]);

        return response()->json($users);
    }

    public function storeUser(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:40'],
            'role' => ['required', Rule::in(array_keys(AccessMatrix::ROLES))],
            'expires_at' => ['nullable', 'date'],
        ]);

        $temporary = Str::password(12);
        $user = User::query()->create([
            'name' => $data['name'],
            'email' => Str::lower($data['email']),
            'phone' => $data['phone'] ?? null,
            'password' => $temporary,
            'must_change_password' => true,
            'is_active' => true,
            'expires_at' => $data['expires_at'] ?? null,
        ]);
        $user->assignRole($data['role']);
        Audit::log('user.created', $user, ['role' => $data['role']]);

        return response()->json([
            'user' => $user->fresh(),
            'temporary_password' => $temporary,
        ], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'role' => ['sometimes', Rule::in(array_keys(AccessMatrix::ROLES))],
            'expires_at' => ['nullable', 'date'],
            'require_two_factor' => ['sometimes', 'boolean'],
        ]);

        if (($data['role'] ?? null) && $data['role'] !== 'Super Admin' && $this->isLastSuperAdmin($user)) {
            return response()->json(['message' => 'At least one super admin is required.'], 422);
        }

        $user->fill(array_intersect_key($data, array_flip(['name', 'phone', 'expires_at'])));
        $user->save();
        if (isset($data['role'])) {
            $user->syncRoles([$data['role']]);
        }
        Audit::log('user.updated', $user, $data);

        return response()->json(['status' => 'ok']);
    }

    public function resetPassword(User $user): JsonResponse
    {
        $temporary = Str::password(12);
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
        if ($this->isLastSuperAdmin($user)) {
            return response()->json(['message' => 'At least one super admin is required.'], 422);
        }

        $user->forceFill(['is_active' => false])->save();
        $user->tokens()->delete();
        Audit::log('user.deactivated', $user);

        return response()->json(['status' => 'ok']);
    }

    public function roles(): JsonResponse
    {
        $roles = Role::query()->with('permissions:id,name')->orderBy('name')->get()->map(fn (Role $role) => [
            'id' => $role->id,
            'name' => $role->name,
            'permissions' => $role->permissions->pluck('name')->values(),
        ]);

        return response()->json([
            'roles' => $roles,
            'permissions' => AccessMatrix::PERMISSIONS,
        ]);
    }

    public function storeRole(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', 'unique:roles,name'],
            'copy_from' => ['nullable', 'integer', 'exists:roles,id'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::in(AccessMatrix::PERMISSIONS)],
        ]);

        $role = Role::query()->create(['name' => $data['name'], 'guard_name' => 'web']);
        $permissions = $data['permissions'] ?? [];
        if (isset($data['copy_from']) && $permissions === []) {
            $permissions = Role::query()->find($data['copy_from'])?->permissions->pluck('name')->all() ?? [];
        }
        $role->syncPermissions($permissions);
        Audit::log('role.created', $role, ['permissions' => $permissions]);

        return response()->json(['id' => $role->id, 'name' => $role->name], 201);
    }

    public function updateRole(Request $request, Role $role): JsonResponse
    {
        if ($role->name === 'Super Admin' && $request->input('name') && $request->input('name') !== 'Super Admin') {
            return response()->json(['message' => 'The super admin role cannot be renamed.'], 422);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80', Rule::unique('roles', 'name')->ignore($role->id)],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', Rule::in(AccessMatrix::PERMISSIONS)],
        ]);

        if (isset($data['name'])) {
            $role->name = $data['name'];
            $role->save();
        }
        if (isset($data['permissions'])) {
            $role->syncPermissions($data['permissions']);
        }
        Audit::log('role.updated', $role, $data);

        return response()->json(['status' => 'ok']);
    }

    public function devices(): JsonResponse
    {
        $devices = Device::query()->with('user:id,name,email')->orderByDesc('last_sync_at')->get();

        return response()->json($devices);
    }

    public function revokeDevice(Device $device): JsonResponse
    {
        $device->forceFill(['revoked_at' => now()])->save();
        if ($device->user) {
            $device->user->tokens()->where('device_id', $device->id)->delete();
        }
        Audit::log('device.revoked', $device);

        return response()->json(['status' => 'ok']);
    }

    public function activity(): JsonResponse
    {
        $rows = Activity::query()->latest()->limit(200)->get();

        return response()->json($rows);
    }

    private function isLastSuperAdmin(User $user): bool
    {
        if (! $user->hasRole('Super Admin') || ! $user->is_active) {
            return false;
        }

        return User::role('Super Admin')->where('is_active', true)->count() <= 1;
    }
}
