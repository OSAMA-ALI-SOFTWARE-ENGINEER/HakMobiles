<?php

namespace Database\Seeders;

use App\Support\AccessMatrix;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (AccessMatrix::PERMISSIONS as $permission) {
            Permission::findOrCreate($permission, 'web');
        }

        foreach (AccessMatrix::ROLES as $role => $permissions) {
            Role::findOrCreate($role, 'web')->syncPermissions($permissions);
        }
    }
}
