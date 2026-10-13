<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Partner;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\SyncChange;
use App\Models\User;
use App\Support\AccessMatrix;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RolePermissionSeeder::class);

        $admin = User::query()->updateOrCreate(
            ['email' => 'haseeb@hak.test'],
            [
                'name' => 'Haseeb',
                'password' => 'ChangeMe123!',
                'is_active' => true,
                'must_change_password' => false,
            ],
        );
        $admin->syncRoles(['Super Admin']);

        $waseem = User::query()->updateOrCreate(
            ['email' => 'waseem@hak.test'],
            ['name' => 'Dr. Waseem', 'password' => 'ChangeMe123!', 'is_active' => true],
        );
        $waseem->syncRoles(['Partner']);

        $umar = User::query()->updateOrCreate(
            ['email' => 'umar@hak.test'],
            ['name' => 'Umar', 'password' => 'ChangeMe123!', 'is_active' => true],
        );
        $umar->syncRoles(['Partner']);

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

        Partner::query()->updateOrCreate(['name' => 'Dr. Waseem'], ['share_pct' => 20, 'user_id' => $waseem->id, 'id' => Partner::query()->where('name', 'Dr. Waseem')->value('id') ?: (string) Str::uuid7()]);
        Partner::query()->updateOrCreate(['name' => 'Haseeb'], ['share_pct' => 40, 'user_id' => $admin->id, 'id' => Partner::query()->where('name', 'Haseeb')->value('id') ?: (string) Str::uuid7()]);
        Partner::query()->updateOrCreate(['name' => 'Umar'], ['share_pct' => 40, 'user_id' => $umar->id, 'id' => Partner::query()->where('name', 'Umar')->value('id') ?: (string) Str::uuid7()]);

        $products = [
            ['code' => 'C1', 'name' => 'Case', 'category' => 'Cases', 'colour' => 'Black', 'sell_price' => 5, 'alert_level' => 10],
            ['code' => 'CH1', 'name' => 'Charger', 'category' => 'Chargers', 'colour' => 'White', 'sell_price' => 10, 'alert_level' => 3],
            ['code' => 'C2', 'name' => 'Clear Case', 'category' => 'Cases', 'colour' => 'Clear', 'sell_price' => 4, 'alert_level' => 10],
            ['code' => 'CB1', 'name' => 'Cable', 'category' => 'Cables', 'colour' => 'Black', 'sell_price' => 3, 'alert_level' => 10],
            ['code' => 'SP1', 'name' => 'Screen Protector', 'category' => 'Protection', 'colour' => 'Clear', 'sell_price' => 2, 'alert_level' => 15],
        ];
        foreach ($products as $product) {
            Product::query()->updateOrCreate(['code' => $product['code']], $product);
        }

        foreach (['Shop A' => '910000001', 'Shop B' => '910000002', 'Loja Central' => '910000003'] as $shop => $phone) {
            Customer::query()->updateOrCreate(['shop_name' => $shop], ['shop_name' => $shop, 'phone' => $phone]);
        }

        foreach (['Shenzhen Co', 'Lahore Traders'] as $name) {
            Supplier::query()->updateOrCreate(['name' => $name], ['name' => $name]);
        }

        foreach ([
            'default_alert_level' => 10,
            'overdue_days' => 30,
            'categories' => ['Cases', 'Chargers', 'Cables', 'Protection'],
            'colours' => ['Black', 'White', 'Clear'],
            'currencies' => ['EUR', 'USD'],
        ] as $key => $value) {
            $setting = \App\Models\Setting::withTrashed()->updateOrCreate(['key' => $key], ['value' => $value]);
            if ($setting->trashed()) {
                $setting->restore();
            }
        }

        foreach (array_keys(AccessMatrix::SYNC_TABLES) as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            foreach (DB::table($table)->pluck('id') as $id) {
                SyncChange::query()->create([
                    'table_name' => $table,
                    'record_id' => (string) $id,
                    'changed_at' => now(),
                ]);
            }
        }
    }
}
