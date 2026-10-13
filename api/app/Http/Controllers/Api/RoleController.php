<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\AccessMatrix;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::query()->with('permissions')->orderBy('name')->get()->map(fn (Role $role) => [
            'id' => $role->id,
            'name' => $role->name,
            'permissions' => $role->permissions->pluck('name')->values(),
        ]);

        return response()->json([
            'data' => $roles,
            'catalog' => AccessMatrix::PERMISSIONS,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('roles', 'name')],
            'copy_from' => ['nullable', 'integer', 'exists:roles,id'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::in(AccessMatrix::PERMISSIONS)],
        ]);

        $role = Role::query()->create(['name' => $data['name'], 'guard_name' => 'web']);
        $permissions = $data['permissions'] ?? [];
        if (isset($data['copy_from'])) {
            $permissions = Role::query()->findOrFail($data['copy_from'])->permissions->pluck('name')->all();
        }
        $role->syncPermissions($permissions);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Audit::log('role.created', $role, ['permissions' => $permissions]);

        return response()->json(['id' => $role->id, 'name' => $role->name, 'permissions' => $permissions], 201);
    }

    public function update(Request $request, Role $role): JsonResponse
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
            if ($role->name === 'Super Admin') {
                $data['permissions'] = AccessMatrix::PERMISSIONS;
            }
            $role->syncPermissions($data['permissions']);
        }
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Audit::log('role.updated', $role, $data);

        return response()->json([
            'id' => $role->id,
            'name' => $role->name,
            'permissions' => $role->permissions()->pluck('name')->values(),
        ]);
    }
}
