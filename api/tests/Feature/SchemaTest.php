<?php

use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use Illuminate\Database\QueryException;

it('rejects a duplicate product code', function () {
    Product::factory()->create(['code' => 'C1']);

    expect(fn () => Product::factory()->create(['code' => 'C1']))
        ->toThrow(QueryException::class);
});

it('rejects a duplicate invoice number', function () {
    $customer = Customer::factory()->create();
    Sale::query()->create([
        'invoice_no' => 'UMR1-0001',
        'customer_id' => $customer->id,
        'date' => now()->toDateString(),
    ]);

    expect(fn () => Sale::query()->create([
        'invoice_no' => 'UMR1-0001',
        'customer_id' => $customer->id,
        'date' => now()->toDateString(),
    ]))->toThrow(QueryException::class);
});

it('rejects a duplicate non-empty nif and allows empty nifs', function () {
    Customer::factory()->create(['nif' => '123456789']);
    Customer::factory()->create(['nif' => null]);
    Customer::factory()->create(['nif' => null]);

    expect(fn () => Customer::factory()->create(['nif' => '123456789']))
        ->toThrow(QueryException::class);
});

it('hides an archived product from normal queries', function () {
    $product = Product::factory()->create();
    $product->delete();

    expect(Product::query()->count())->toBe(0)
        ->and(Product::withTrashed()->count())->toBe(1);
});
