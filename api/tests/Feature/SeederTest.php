<?php

use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Setting;
use App\Models\Supplier;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoSeeder;
use Illuminate\Support\Facades\Schema;

it('seeds the logins, catalogue and settings a fresh install needs', function () {
    $this->seed(DatabaseSeeder::class);

    expect(User::query()->where('email', 'haseeb@hak.test')->exists())->toBeTrue()
        ->and(Product::query()->where('code', 'C1')->exists())->toBeTrue()
        ->and(Customer::query()->count())->toBe(3)
        ->and(Supplier::query()->count())->toBe(2)
        ->and(Schema::hasColumn('suppliers', 'nif'))->toBeTrue()
        ->and(Setting::query()->where('key', 'payment_methods')->exists())->toBeTrue()
        ->and(Setting::query()->where('key', 'expense_categories')->exists())->toBeTrue()
        ->and(Setting::query()->where('key', 'inactive_days')->exists())->toBeTrue()
        ->and(Setting::query()->where('key', 'invoice_footer')->exists())->toBeTrue();

    $this->seed(DatabaseSeeder::class);

    expect(Product::query()->where('code', 'C1')->count())->toBe(1)
        ->and(Customer::query()->count())->toBe(3);
});

it('adds one sample sale without duplicating it', function () {
    $this->seed(DemoSeeder::class);
    $this->seed(DemoSeeder::class);

    expect(Sale::query()->where('invoice_no', 'DEMO-0001')->count())->toBe(1);
});
