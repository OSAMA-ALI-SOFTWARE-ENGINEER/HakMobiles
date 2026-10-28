<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Partner;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Supplier;
use App\Models\SyncChange;
use App\Models\User;
use App\Support\AccessMatrix;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RolePermissionSeeder::class);

        $admin = $this->login('haseeb@hak.test', 'Haseeb', 'ChangeMe123!', ['Super Admin']);
        $waseem = $this->login('waseem@hak.test', 'Dr. Waseem', 'ChangeMe123!', ['Partner']);
        $umar = $this->login('umar@hak.test', 'Umar', 'ChangeMe123!', ['Partner']);
        $this->login('seller@hak.test', 'Sales Desk', 'password1234', ['Salesperson']);

        $this->partner('Dr. Waseem', 20, $waseem->id);
        $this->partner('Haseeb', 40, $admin->id);
        $this->partner('Umar', 40, $umar->id);

        foreach ([
            ['code' => 'C1', 'name' => 'Case', 'category' => 'Cases', 'colour' => 'Black', 'sell_price' => 5, 'alert_level' => 10],
            ['code' => 'CH1', 'name' => 'Charger', 'category' => 'Chargers', 'colour' => 'White', 'sell_price' => 10, 'alert_level' => 3],
            ['code' => 'C2', 'name' => 'Clear Case', 'category' => 'Cases', 'colour' => 'Clear', 'sell_price' => 4, 'alert_level' => 10],
            ['code' => 'CB1', 'name' => 'Cable', 'category' => 'Cables', 'colour' => 'Black', 'sell_price' => 3, 'alert_level' => 10],
            ['code' => 'SP1', 'name' => 'Screen Protector', 'category' => 'Protection', 'colour' => 'Clear', 'sell_price' => 2, 'alert_level' => 15],
        ] as $product) {
            Product::query()->firstOrCreate(['code' => $product['code']], $product);
        }

        foreach (['Shop A' => '910000001', 'Shop B' => '910000002', 'Loja Central' => '910000003'] as $shop => $phone) {
            Customer::query()->firstOrCreate(['shop_name' => $shop], ['phone' => $phone, 'status' => 'lead']);
        }

        foreach (['Shenzhen Co', 'Lahore Traders'] as $name) {
            Supplier::query()->firstOrCreate(['name' => $name], ['name' => $name]);
        }

        foreach ([
            'company_name' => 'HAK Wholesales',
            'company_nif' => '',
            'company_address' => '',
            'company_phone' => '',
            'company_email' => '',
            'invoice_footer' => 'Internal invoice. Not a certified tax document.',
            'document_design' => [
                'logo' => '',
                'color' => 'indigo',
                'kicker' => 'Internal invoice',
                'statementFooter' => 'Internal statement. Not a certified tax document.',
            ],
            'default_alert_level' => 10,
            'overdue_days' => 30,
            'inactive_days' => 60,
            'categories' => ['Cases', 'Chargers', 'Cables', 'Protection'],
            'colours' => ['Black', 'White', 'Clear'],
            'payment_methods' => ['Cash', 'Bank Transfer', 'MB Way', 'Card', 'Cheque'],
            'expense_categories' => ['Rent', 'Freight', 'Utilities', 'Other'],
            'currencies' => ['EUR', 'USD'],
            'timezone' => 'Europe/Lisbon',
        ] as $key => $value) {
            $setting = Setting::withTrashed()->firstOrCreate(['key' => $key], ['value' => $value]);
            if ($setting->trashed()) {
                $setting->restore();
            }
        }

        foreach (array_keys(AccessMatrix::SYNC_TABLES) as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }
            foreach (DB::table($table)->pluck('id') as $id) {
                $recorded = SyncChange::query()
                    ->where('table_name', $table)
                    ->where('record_id', (string) $id)
                    ->exists();
                if ($recorded) {
                    continue;
                }
                SyncChange::query()->create([
                    'table_name' => $table,
                    'record_id' => (string) $id,
                    'changed_at' => now(),
                ]);
            }
        }
    }

    private function login(string $email, string $name, string $password, array $roles): User
    {
        $user = User::query()->firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => $password,
                'is_active' => true,
                'must_change_password' => false,
            ],
        );
        $user->syncRoles($roles);

        return $user;
    }

    private function partner(string $name, float $share, string $userId): void
    {
        $partner = Partner::query()->firstOrCreate(
            ['name' => $name],
            ['share_pct' => $share, 'user_id' => $userId],
        );
        if ($partner->user_id === null) {
            $partner->user_id = $userId;
            $partner->save();
        }
    }
}
