<?php

namespace App\Console\Commands;

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CreateSuperAdmin extends Command
{
    protected $signature = 'hak:create-super-admin {--name=} {--email=} {--password=}';

    protected $description = 'Create the first super admin login';

    public function handle(): int
    {
        $this->call('db:seed', ['--class' => RolePermissionSeeder::class, '--force' => true]);

        $name = $this->option('name') ?: $this->ask('Name');
        $email = $this->option('email') ?: $this->ask('Email');
        $password = $this->option('password') ?: $this->secret('Password (min 10 characters)');

        $validator = Validator::make(
            ['name' => $name, 'email' => $email, 'password' => $password],
            ['name' => ['required', 'string'], 'email' => ['required', 'email'], 'password' => ['required', Password::min(10)]],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user = User::query()->updateOrCreate(
            ['email' => strtolower($email)],
            ['name' => $name, 'password' => $password, 'is_active' => true, 'must_change_password' => false],
        );
        $user->syncRoles(['Super Admin']);
        $this->info('Super admin ready: '.$user->email);

        return self::SUCCESS;
    }
}
