<?php

use App\Models\Customer;
use App\Models\Partner;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Supplier;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    $this->customer = Customer::factory()->create();
    $this->supplier = Supplier::factory()->create();
    $this->product = Product::factory()->create();
    $this->from = Partner::query()->create(['name' => 'From', 'share_pct' => 40]);
    $this->to = Partner::query()->create(['name' => 'To', 'share_pct' => 60]);

    $this->users = [];
    foreach (['Super Admin', 'Partner', 'Manager', 'Salesperson', 'Viewer'] as $role) {
        $user = User::factory()->create([
            'two_factor_confirmed_at' => now(),
            'must_change_password' => false,
        ]);
        $user->assignRole($role);
        $this->users[$role] = $user;
    }

    $this->sale = Sale::query()->create([
        'invoice_no' => 'MATRIX-1',
        'customer_id' => $this->customer->id,
        'date' => now()->timezone('Europe/Lisbon')->toDateString(),
        'sold_by' => $this->users['Salesperson']->id,
    ]);
});

it('enforces the permission matrix', function (string $role, string $method, string $uri, int $status) {
    $user = $this->users[$role];
    $payload = match (true) {
        str_contains($uri, '/products') && $method === 'post' => ['code' => 'P-'.Str::upper(Str::slug($role, '')), 'name' => 'Case', 'sell_price' => 5],
        str_contains($uri, '/stock-adjustments') => ['product_id' => $this->product->id, 'qty' => -1, 'reason' => 'Count'],
        str_contains($uri, '/purchases') => ['supplier_id' => $this->supplier->id, 'date' => now()->toDateString()],
        str_contains($uri, '/sales') && $method === 'post' => ['invoice_no' => 'INV-'.Str::upper(Str::slug($role, '')), 'customer_id' => $this->customer->id, 'date' => now()->toDateString()],
        str_contains($uri, '/customer-payments') && $method === 'post' => ['customer_id' => $this->customer->id, 'amount' => 10],
        str_contains($uri, '/customers') && $method === 'post' => ['shop_name' => 'Shop '.$role],
        str_contains($uri, '/suppliers') && $method === 'post' => ['name' => 'Supplier '.$role],
        str_contains($uri, '/expenses') && $method === 'post' => ['category' => 'Freight', 'amount' => 20, 'amount_eur' => 20],
        str_contains($uri, '/partner-transfers') && $method === 'post' => ['from_partner' => $this->from->id, 'to_partner' => $this->to->id, 'amount' => 50],
        str_contains($uri, '/settings') && $method === 'post' => ['key' => 'alert-'.$role, 'value' => 10],
        default => [],
    };

    $uri = str_replace('{sale}', $this->sale->id, $uri);
    $response = $this->actingAs($user, 'sanctum')->json($method, $uri, $payload);
    expect($response->status())->toBe($status);
})->with([
    ['Super Admin', 'get', '/api/dashboard', 200],
    ['Partner', 'get', '/api/dashboard', 200],
    ['Manager', 'get', '/api/dashboard', 200],
    ['Salesperson', 'get', '/api/dashboard', 200],
    ['Viewer', 'get', '/api/dashboard', 200],
    ['Super Admin', 'get', '/api/dashboard/profit', 200],
    ['Partner', 'get', '/api/dashboard/profit', 200],
    ['Manager', 'get', '/api/dashboard/profit', 403],
    ['Salesperson', 'get', '/api/dashboard/profit', 403],
    ['Viewer', 'get', '/api/dashboard/profit', 200],
    ['Viewer', 'get', '/api/products', 200],
    ['Salesperson', 'post', '/api/products', 403],
    ['Manager', 'post', '/api/products', 201],
    ['Viewer', 'post', '/api/products', 403],
    ['Super Admin', 'post', '/api/products', 201],
    ['Salesperson', 'post', '/api/stock-adjustments', 403],
    ['Manager', 'post', '/api/stock-adjustments', 201],
    ['Salesperson', 'get', '/api/purchases', 403],
    ['Viewer', 'get', '/api/purchases', 200],
    ['Manager', 'post', '/api/purchases', 201],
    ['Viewer', 'post', '/api/purchases', 403],
    ['Salesperson', 'post', '/api/sales', 201],
    ['Viewer', 'post', '/api/sales', 403],
    ['Salesperson', 'patch', '/api/sales/{sale}', 200],
    ['Viewer', 'patch', '/api/sales/{sale}', 403],
    ['Manager', 'patch', '/api/sales/{sale}', 200],
    ['Salesperson', 'post', '/api/customer-payments', 201],
    ['Viewer', 'post', '/api/customer-payments', 403],
    ['Viewer', 'get', '/api/customer-payments', 200],
    ['Salesperson', 'post', '/api/customers', 201],
    ['Viewer', 'post', '/api/customers', 403],
    ['Salesperson', 'get', '/api/suppliers', 403],
    ['Viewer', 'get', '/api/suppliers', 200],
    ['Manager', 'post', '/api/expenses', 201],
    ['Salesperson', 'post', '/api/expenses', 403],
    ['Viewer', 'get', '/api/expenses', 200],
    ['Manager', 'get', '/api/partner-transfers', 403],
    ['Viewer', 'get', '/api/partner-transfers', 200],
    ['Partner', 'post', '/api/partner-transfers', 201],
    ['Manager', 'post', '/api/partner-transfers', 403],
    ['Salesperson', 'get', '/api/reports', 403],
    ['Viewer', 'get', '/api/reports', 200],
    ['Partner', 'get', '/api/activity', 200],
    ['Manager', 'get', '/api/activity', 403],
    ['Viewer', 'get', '/api/activity', 403],
    ['Super Admin', 'post', '/api/settings', 201],
    ['Partner', 'post', '/api/settings', 403],
    ['Super Admin', 'get', '/api/users', 200],
    ['Viewer', 'post', '/api/users', 403],
    ['Viewer', 'get', '/api/users', 403],
    ['Partner', 'get', '/api/users', 403],
]);
