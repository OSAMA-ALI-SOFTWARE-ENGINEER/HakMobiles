<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Partner;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleLine;
use App\Models\Setting;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::query()->updateOrCreate(
            ['email' => 'haseeb@hak.test'],
            [
                'name' => 'Haseeb',
                'password' => 'ChangeMe123!',
                'is_active' => true,
                'must_change_password' => false,
                'two_factor_secret' => null,
                'two_factor_confirmed_at' => null,
            ],
        );
        $admin->syncRoles(['Super Admin']);

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

        $partners = [
            ['name' => 'Dr. Waseem', 'share_pct' => 20],
            ['name' => 'Haseeb', 'share_pct' => 40],
            ['name' => 'Umar', 'share_pct' => 40],
        ];
        foreach ($partners as $partner) {
            Partner::query()->updateOrCreate(['name' => $partner['name']], $partner);
        }

        $settings = [
            'categories' => ['Cases', 'Chargers', 'Cables'],
            'colours' => ['Black', 'White', 'Blue'],
            'default_alert_level' => 10,
            'overdue_days' => 30,
            'currencies' => ['EUR', 'USD'],
            'timezone' => 'Europe/Lisbon',
        ];
        foreach ($settings as $key => $value) {
            Setting::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }

        $products = Product::factory()->count(5)->create();
        $customers = Customer::factory()->count(3)->create();
        Supplier::factory()->count(2)->create();

        $sale = Sale::query()->create([
            'invoice_no' => 'DEMO-0001',
            'customer_id' => $customers->first()->id,
            'date' => now()->toDateString(),
            'sold_by' => $admin->id,
            'created_by' => $admin->id,
        ]);
        SaleLine::query()->create([
            'sale_id' => $sale->id,
            'product_id' => $products->first()->id,
            'qty' => 2,
            'unit_price' => $products->first()->sell_price,
            'discount' => 0,
            'unit_cost_at_sale' => 1,
        ]);
    }
}
