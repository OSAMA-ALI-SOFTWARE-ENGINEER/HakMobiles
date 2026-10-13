<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class ResetAdmin extends Command
{
    protected $signature = 'hak:reset-admin {email} {password}';

    protected $description = 'Restore a super admin who is locked out';

    public function handle(): int
    {
        $email = strtolower($this->argument('email'));
        $password = $this->argument('password');
        $validator = Validator::make(
            ['password' => $password],
            ['password' => ['required', Password::min(10)]],
        );
        if ($validator->fails()) {
            $this->error($validator->errors()->first());

            return self::FAILURE;
        }

        $user = User::query()->where('email', $email)->first();
        if (! $user) {
            $this->error('No user with that email.');

            return self::FAILURE;
        }

        $user->forceFill([
            'password' => $password,
            'is_active' => true,
            'must_change_password' => false,
            'expires_at' => null,
        ])->save();
        $user->syncRoles(['Super Admin']);
        Cache::forget('login-lock:'.$email);
        Cache::forget('login-attempts:'.$email);
        $this->info('Super admin reset: '.$email);

        return self::SUCCESS;
    }
}
