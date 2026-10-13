<?php

use App\Models\Device;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Laravel\Sanctum\PersonalAccessToken;

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function makeUser(array $overrides = [], string $role = 'Salesperson'): User
{
    $user = User::factory()->create(array_merge([
        'password' => 'password1234',
        'is_active' => true,
        'must_change_password' => false,
    ], $overrides));
    $user->assignRole($role);

    return $user;
}

it('returns a token for a correct login and 401 for a wrong password', function () {
    $user = makeUser();

    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password1234',
        'device_name' => 'Desk',
    ])->assertOk()->assertJsonStructure(['token', 'device' => ['invoice_prefix']]);

    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
        'device_name' => 'Desk',
    ])->assertUnauthorized();
});

it('locks an email on the sixth failed attempt', function () {
    $user = makeUser();

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
            'device_name' => 'Desk',
        ])->assertUnauthorized();
    }

    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
        'device_name' => 'Desk',
    ])->assertStatus(429);
});

it('rejects inactive and expired users', function () {
    $inactive = makeUser(['is_active' => false, 'email' => 'inactive@hak.test']);
    $expired = makeUser(['expires_at' => now()->subDay(), 'email' => 'expired@hak.test']);

    foreach ([$inactive, $expired] as $user) {
        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password1234',
            'device_name' => 'Desk',
        ])->assertUnauthorized();
    }
});

it('rejects a revoked token on me', function () {
    $user = makeUser();
    $login = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password1234',
        'device_name' => 'Desk',
    ])->assertOk();

    $token = $login->json('token');
    PersonalAccessToken::query()->delete();
    auth()->forgetGuards();

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->getJson('/api/auth/me')
        ->assertUnauthorized();
});

it('lets a user with a temporary password change it and nothing else', function () {
    $user = makeUser(['must_change_password' => true]);
    $token = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password1234',
        'device_name' => 'Desk',
    ])->json('token');

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->getJson('/api/products')
        ->assertForbidden();

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson('/api/auth/change-password', [
            'password' => 'new-password-10',
            'password_confirmation' => 'new-password-10',
        ])->assertOk();

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->getJson('/api/products')
        ->assertOk();
});

it('updates the signed-in profile and leaves another user unchanged', function () {
    $user = makeUser(['name' => 'Ada', 'phone' => '910000001']);
    $other = makeUser(['name' => 'Bea', 'phone' => '910000002', 'email' => 'bea@hak.test']);
    $token = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password1234',
        'device_name' => 'Desk',
    ])->json('token');

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->patchJson('/api/auth/profile', [
            'name' => 'Ada Lopes',
            'phone' => '910111222',
            'notify_overdue' => false,
        ])
        ->assertOk()
        ->assertJsonPath('user.name', 'Ada Lopes')
        ->assertJsonPath('user.phone', '910111222')
        ->assertJsonPath('user.notify_overdue', false);

    expect($other->fresh()->name)->toBe('Bea')
        ->and($other->fresh()->phone)->toBe('910000002');

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->patchJson('/api/auth/profile', [
            'name' => 'Someone Else',
            'role' => 'Super Admin',
        ])
        ->assertStatus(422);

    expect($user->fresh()->name)->toBe('Ada Lopes')
        ->and($user->fresh()->hasRole('Salesperson'))->toBeTrue();
});

it('archives a login, reactivates it, and then deletes it permanently', function () {
    $admin = makeUser(['email' => 'admin-archive@hak.test'], 'Super Admin');
    $user = makeUser(['name' => 'Clerk', 'email' => 'clerk-archive@hak.test']);
    $token = $this->postJson('/api/auth/login', [
        'email' => $admin->email,
        'password' => 'password1234',
        'device_name' => 'Desk',
    ])->json('token');

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson('/api/users/'.$user->id.'/deactivate')
        ->assertOk()
        ->assertJsonPath('user.is_active', false);

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson('/api/users/'.$user->id.'/reactivate')
        ->assertOk()
        ->assertJsonPath('user.is_active', true);

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->deleteJson('/api/users/'.$admin->id)
        ->assertStatus(422);

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->deleteJson('/api/users/'.$user->id)
        ->assertOk();

    expect($user->fresh()->purged_at)->not->toBeNull()
        ->and($user->fresh()->email)->not->toBe('clerk-archive@hak.test');

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->getJson('/api/users')
        ->assertOk()
        ->assertJsonMissing(['email' => 'clerk-archive@hak.test']);

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson('/api/users/'.$user->id.'/reactivate')
        ->assertStatus(422);
});

it('resets a super admin from the artisan command', function () {
    $user = makeUser(['is_active' => false], 'Super Admin');

    $this->artisan('hak:reset-admin', [
        'email' => $user->email,
        'password' => 'restored-password',
    ])->assertSuccessful();

    expect($user->fresh()->is_active)->toBeTrue();
    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'restored-password',
        'device_name' => 'Desk',
    ])->assertOk();
});

it('blocks a revoked device at login', function () {
    $user = makeUser();
    $login = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password1234',
        'device_name' => 'Desk',
    ])->assertOk();

    Device::query()->find($login->json('device.id'))->forceFill(['revoked_at' => now()])->save();

    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password1234',
        'device_name' => 'Desk',
    ])->assertUnauthorized();
});

it('signs in without an authenticator code while two-factor login is off', function () {
    config(['hak.two_factor_enabled' => false]);
    $user = makeUser(['two_factor_confirmed_at' => now()], 'Partner');

    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password1234',
        'device_name' => 'Desk',
    ])->assertOk()->assertJsonPath('must_setup_two_factor', false);
});

it('asks for an authenticator code when two-factor login is switched on', function () {
    config(['hak.two_factor_enabled' => true]);
    $user = makeUser(['two_factor_confirmed_at' => now()], 'Partner');

    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password1234',
        'device_name' => 'Desk',
    ])->assertStatus(422)->assertJsonPath('two_factor_required', true);
});
