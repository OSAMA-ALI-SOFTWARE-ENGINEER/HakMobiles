<?php

use App\Models\User;

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$seller = User::query()->updateOrCreate(
    ['email' => 'seller@hak.test'],
    [
        'name' => 'Sales Desk',
        'password' => 'password1234',
        'is_active' => true,
        'must_change_password' => false,
    ],
);
$seller->syncRoles(['Salesperson']);
echo $seller->email.PHP_EOL;
