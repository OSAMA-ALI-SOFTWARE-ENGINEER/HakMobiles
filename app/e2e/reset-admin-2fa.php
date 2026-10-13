<?php

require __DIR__.'/../../api/vendor/autoload.php';

$app = require __DIR__.'/../../api/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$user = App\Models\User::query()->where('email', 'haseeb@hak.test')->firstOrFail();
$user->forceFill([
    'two_factor_secret' => null,
    'two_factor_confirmed_at' => null,
])->save();
