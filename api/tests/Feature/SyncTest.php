<?php

use App\Models\Product;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function syncUser(string $role): User
{
    $user = User::factory()->create([
        'two_factor_confirmed_at' => now(),
        'must_change_password' => false,
    ]);
    $user->assignRole($role);

    return $user;
}

function syncOp(string $table, string $id, array $payload): array
{
    $now = now()->toDateTimeString();

    return [
        'op_id' => (string) Str::uuid7(),
        'table' => $table,
        'record_id' => $id,
        'payload' => array_merge($payload, [
            'id' => $id,
            'created_at' => $now,
            'updated_at' => $now,
        ]),
    ];
}

it('accepts the same push twice without duplicating the row', function () {
    $admin = syncUser('Super Admin');
    $id = (string) Str::uuid7();
    $op = syncOp('products', $id, ['code' => 'SYNC1', 'name' => 'Cable', 'sell_price' => 3]);

    $first = $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => [$op]]);
    $second = $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => [$op]]);

    $first->assertOk()->assertJsonPath('accepted.0', $op['op_id']);
    $second->assertOk()->assertJsonPath('accepted.0', $op['op_id']);
    expect(Product::query()->count())->toBe(1);
});

it('returns changes in sequence and then nothing', function () {
    $admin = syncUser('Super Admin');
    $ops = [
        syncOp('products', (string) Str::uuid7(), ['code' => 'A1', 'name' => 'A', 'sell_price' => 1]),
        syncOp('products', (string) Str::uuid7(), ['code' => 'B1', 'name' => 'B', 'sell_price' => 2]),
    ];
    $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => $ops])->assertOk();

    $pull = $this->actingAs($admin, 'sanctum')->getJson('/api/sync/pull?since=0')->assertOk();
    expect($pull->json('changes'))->toHaveCount(2)
        ->and($pull->json('changes.0.seq'))->toBeLessThan($pull->json('changes.1.seq'));

    $last = $pull->json('last_seq');
    $this->actingAs($admin, 'sanctum')
        ->getJson('/api/sync/pull?since='.$last)
        ->assertOk()
        ->assertJsonCount(0, 'changes');
});

it('never sends cost fields to a salesperson', function () {
    $admin = syncUser('Super Admin');
    $seller = syncUser('Salesperson');
    $ops = [
        syncOp('purchase_lines', (string) Str::uuid7(), [
            'purchase_id' => (string) Str::uuid7(),
            'product_id' => (string) Str::uuid7(),
            'qty' => 10,
            'unit_cost' => 1.5,
        ]),
        syncOp('sale_lines', (string) Str::uuid7(), [
            'sale_id' => (string) Str::uuid7(),
            'product_id' => (string) Str::uuid7(),
            'qty' => 2,
            'unit_price' => 5,
            'discount' => 0,
            'unit_cost_at_sale' => 1.5,
        ]),
    ];
    $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => $ops])->assertOk();

    $pull = $this->actingAs($seller, 'sanctum')->getJson('/api/sync/pull?since=0')->assertOk();
    $encoded = json_encode($pull->json('changes'));

    expect($encoded)->not->toContain('unit_cost')
        ->and($pull->json('changes'))->not->toBeEmpty();
});

it('rejects a viewer push and saves nothing', function () {
    $viewer = syncUser('Viewer');
    $op = syncOp('products', (string) Str::uuid7(), ['code' => 'NOPE', 'name' => 'No', 'sell_price' => 1]);

    $this->actingAs($viewer, 'sanctum')
        ->postJson('/api/sync/push', ['ops' => [$op]])
        ->assertOk()
        ->assertJsonPath('rejected.0.reason', 'forbidden');

    expect(Product::query()->count())->toBe(0);
});

it('stores a follow-up through sync', function () {
    $admin = syncUser('Super Admin');
    $customerId = (string) Str::uuid7();
    $followId = (string) Str::uuid7();

    $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => [
        syncOp('customers', $customerId, ['shop_name' => 'Loja CRM', 'status' => 'lead']),
        syncOp('follow_ups', $followId, [
            'customer_id' => $customerId,
            'title' => 'Call back',
            'due_at' => now()->toDateTimeString(),
        ]),
    ]])->assertOk()->assertJsonCount(0, 'rejected');

    expect(\Illuminate\Support\Facades\DB::table('follow_ups')->where('id', $followId)->value('title'))->toBe('Call back');
});

it('replaces an existing product code when the tracker sample is loaded', function () {
    $admin = syncUser('Super Admin');
    $oldId = (string) Str::uuid7();
    $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => [
        syncOp('products', $oldId, ['code' => 'C1', 'name' => 'Old case', 'sell_price' => 1]),
    ]])->assertOk()->assertJsonCount(0, 'rejected');

    $sampleId = '01900000-0000-7000-8000-000000000011';
    $this->actingAs($admin, 'sanctum')->postJson('/api/sync/sample', [
        'tables' => [
            'products' => [[
                'id' => $sampleId,
                'code' => 'C1',
                'name' => 'Case',
                'sell_price' => 5,
            ]],
        ],
    ])->assertOk();

    $old = \Illuminate\Support\Facades\DB::table('products')->where('id', $oldId)->first();
    expect($old->deleted_at)->not->toBeNull()
        ->and($old->code)->not->toBe('C1')
        ->and(\Illuminate\Support\Facades\DB::table('products')->where('id', $sampleId)->value('name'))->toBe('Case');

    $this->actingAs(syncUser('Salesperson'), 'sanctum')
        ->postJson('/api/sync/sample', ['tables' => ['products' => []]])
        ->assertForbidden();
});

it('logs the old and new price when a product price changes', function () {
    $admin = syncUser('Super Admin');
    $id = (string) Str::uuid7();
    $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => [
        syncOp('products', $id, ['code' => 'PX', 'name' => 'Case', 'sell_price' => 5]),
    ]])->assertOk()->assertJsonCount(0, 'rejected');
    $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => [
        syncOp('products', $id, ['code' => 'PX', 'name' => 'Case', 'sell_price' => 6]),
    ]])->assertOk()->assertJsonCount(0, 'rejected');

    $this->actingAs($admin, 'sanctum')->getJson('/api/activity')
        ->assertOk()
        ->assertJsonFragment(['description' => 'product.price_changed']);

    $row = \Spatie\Activitylog\Models\Activity::query()->where('description', 'product.price_changed')->first();
    expect((float) $row->properties['old'])->toBe(5.0)
        ->and((float) $row->properties['new'])->toBe(6.0);
});

it('stores a partly received purchase with shipping', function () {
    $admin = syncUser('Super Admin');
    $purchaseId = (string) Str::uuid7();
    $lineId = (string) Str::uuid7();

    $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => [
        syncOp('purchases', $purchaseId, [
            'supplier_id' => (string) Str::uuid7(),
            'date' => '2026-10-09',
            'extra_cost' => 20,
        ]),
        syncOp('purchase_lines', $lineId, [
            'purchase_id' => $purchaseId,
            'product_id' => (string) Str::uuid7(),
            'qty' => 100,
            'qty_received' => 60,
            'unit_cost' => 1,
        ]),
    ]])->assertOk()->assertJsonCount(0, 'rejected');

    expect(\Illuminate\Support\Facades\DB::table('purchases')->where('id', $purchaseId)->value('extra_cost'))->toEqual('20.00')
        ->and(\Illuminate\Support\Facades\DB::table('purchase_lines')->where('id', $lineId)->value('qty_received'))->toBe(60);
});

it('stores zero shipping when a purchase sends a null extra cost', function () {
    $admin = syncUser('Super Admin');
    $purchaseId = (string) Str::uuid7();

    $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => [
        syncOp('purchases', $purchaseId, [
            'supplier_id' => (string) Str::uuid7(),
            'date' => '2026-10-21',
            'extra_cost' => null,
        ]),
    ]])->assertOk()->assertJsonCount(0, 'rejected');

    expect((float) \Illuminate\Support\Facades\DB::table('purchases')->where('id', $purchaseId)->value('extra_cost'))->toBe(0.0);
});

it('stores portuguese supplier contact details', function () {
    $admin = syncUser('Super Admin');
    $id = (string) Str::uuid7();

    $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => [
        syncOp('suppliers', $id, [
            'name' => 'Lisbon Parts',
            'first_name' => 'Ana',
            'last_name' => 'Silva',
            'email' => 'ana@lisbon-parts.pt',
            'phone' => '+351210000000',
            'whatsapp' => '+351910000000',
            'nif' => '123456789',
            'address' => 'Rua Augusta 10, Lisboa',
            'home_address' => 'Rua do Sol 2, Lisboa',
            'country' => 'Portugal',
            'contact' => 'Ana Silva',
        ]),
    ]])->assertOk()->assertJsonCount(0, 'rejected');

    $row = \Illuminate\Support\Facades\DB::table('suppliers')->where('id', $id)->first();
    expect($row->first_name)->toBe('Ana')
        ->and($row->last_name)->toBe('Silva')
        ->and($row->email)->toBe('ana@lisbon-parts.pt')
        ->and($row->nif)->toBe('123456789')
        ->and($row->address)->toBe('Rua Augusta 10, Lisboa')
        ->and($row->home_address)->toBe('Rua do Sol 2, Lisboa')
        ->and($row->whatsapp)->toBe('+351910000000')
        ->and($row->country)->toBe('Portugal');
});

it('keeps an empty credit limit empty', function () {
    $admin = syncUser('Super Admin');
    $id = (string) Str::uuid7();

    $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => [
        syncOp('customers', $id, [
            'shop_name' => 'No limit',
            'credit_limit' => null,
        ]),
    ]])->assertOk()->assertJsonCount(0, 'rejected');

    expect(\Illuminate\Support\Facades\DB::table('customers')->where('id', $id)->value('credit_limit'))->toBeNull();
});

it('stores a purged product and keeps it out of the live list', function () {
    $admin = syncUser('Super Admin');
    $id = (string) Str::uuid7();
    $stamp = now()->toDateTimeString();

    $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => [
        syncOp('products', $id, [
            'code' => 'PURGE1',
            'name' => 'Gone',
            'sell_price' => 1,
            'deleted_at' => $stamp,
            'purged_at' => $stamp,
        ]),
    ]])->assertOk()->assertJsonCount(0, 'rejected');

    $row = \Illuminate\Support\Facades\DB::table('products')->where('id', $id)->first();
    expect($row->deleted_at)->not->toBeNull()
        ->and($row->purged_at)->not->toBeNull()
        ->and(Product::query()->where('id', $id)->exists())->toBeFalse();
});

it('stores a short path for a product photo', function () {
    \Illuminate\Support\Facades\Storage::fake('public');
    $admin = syncUser('Super Admin');
    $id = (string) Str::uuid7();
    $this->actingAs($admin, 'sanctum')->postJson('/api/sync/push', ['ops' => [
        syncOp('products', $id, ['code' => 'PHOTO1', 'name' => 'Case', 'sell_price' => 1]),
    ]])->assertOk()->assertJsonCount(0, 'rejected');

    $response = $this->actingAs($admin, 'sanctum')->post('/api/files', [
        'table' => 'products',
        'record_id' => $id,
        'file' => \Illuminate\Http\UploadedFile::fake()->create('case.jpg', 20, 'image/jpeg'),
    ]);

    $response->assertOk();
    $path = $response->json('path');
    expect(strlen((string) $path))->toBeLessThan(255)
        ->and(Product::query()->find($id)->photo_path)->toBe($path);
});
