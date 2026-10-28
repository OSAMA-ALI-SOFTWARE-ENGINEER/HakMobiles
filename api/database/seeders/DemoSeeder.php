<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleLine;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(DatabaseSeeder::class);

        $admin = User::query()->where('email', 'haseeb@hak.test')->firstOrFail();
        $customer = Customer::query()->where('shop_name', 'Loja Central')->firstOrFail();
        $product = Product::query()->where('code', 'C1')->firstOrFail();

        $sale = Sale::query()->firstOrCreate(
            ['invoice_no' => 'DEMO-0001'],
            [
                'customer_id' => $customer->id,
                'date' => now()->toDateString(),
                'sold_by' => $admin->id,
                'created_by' => $admin->id,
            ],
        );

        SaleLine::query()->firstOrCreate(
            ['sale_id' => $sale->id, 'product_id' => $product->id],
            [
                'qty' => 2,
                'unit_price' => $product->sell_price,
                'discount' => 0,
                'unit_cost_at_sale' => 1,
            ],
        );
    }
}
