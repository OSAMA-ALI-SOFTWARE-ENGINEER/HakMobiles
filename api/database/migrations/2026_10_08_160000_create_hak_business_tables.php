<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $common = function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('created_by')->nullable()->index();
            $table->uuid('device_id')->nullable()->index();
            $table->timestamps();
            $table->uuid('updated_by')->nullable();
            $table->softDeletes();
        };

        Schema::create('devices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->index();
            $table->string('name');
            $table->string('platform')->nullable();
            $table->string('app_version')->nullable();
            $table->string('invoice_prefix')->unique();
            $table->timestamp('last_sync_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
        });

        Schema::create('partners', function (Blueprint $table) use ($common) {
            $common($table);
            $table->string('name');
            $table->decimal('share_pct', 5, 2);
            $table->uuid('user_id')->nullable()->index();
        });

        Schema::create('products', function (Blueprint $table) use ($common) {
            $common($table);
            $table->string('code')->unique();
            $table->string('name');
            $table->string('category')->nullable();
            $table->string('colour')->nullable();
            $table->string('model')->nullable();
            $table->decimal('sell_price', 12, 2)->default(0);
            $table->unsignedInteger('alert_level')->nullable();
            $table->string('barcode')->nullable();
            $table->string('photo_path')->nullable();
        });

        Schema::create('customers', function (Blueprint $table) use ($common) {
            $common($table);
            $table->string('shop_name');
            $table->string('contact')->nullable();
            $table->string('phone')->nullable()->index();
            $table->string('nif')->nullable()->unique();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('email')->nullable();
            $table->decimal('credit_limit', 12, 2)->nullable();
        });

        Schema::create('suppliers', function (Blueprint $table) use ($common) {
            $common($table);
            $table->string('name')->unique();
            $table->string('contact')->nullable();
            $table->string('phone')->nullable();
            $table->string('country')->nullable();
            $table->string('email')->nullable();
        });

        Schema::create('purchases', function (Blueprint $table) use ($common) {
            $common($table);
            $table->uuid('supplier_id')->index();
            $table->date('date');
            $table->string('invoice_no')->nullable();
        });

        Schema::create('purchase_lines', function (Blueprint $table) use ($common) {
            $common($table);
            $table->uuid('purchase_id')->index();
            $table->uuid('product_id')->index();
            $table->integer('qty');
            $table->decimal('unit_cost', 12, 2);
        });

        Schema::create('sales', function (Blueprint $table) use ($common) {
            $common($table);
            $table->string('invoice_no')->unique();
            $table->uuid('customer_id')->index();
            $table->date('date');
            $table->uuid('sold_by')->nullable()->index();
            $table->string('note')->nullable();
        });

        Schema::create('sale_lines', function (Blueprint $table) use ($common) {
            $common($table);
            $table->uuid('sale_id')->index();
            $table->uuid('product_id')->index();
            $table->integer('qty');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('unit_cost_at_sale', 12, 2)->nullable();
        });

        Schema::create('stock_adjustments', function (Blueprint $table) use ($common) {
            $common($table);
            $table->uuid('product_id')->index();
            $table->integer('qty');
            $table->string('reason');
        });

        Schema::create('supplier_payments', function (Blueprint $table) use ($common) {
            $common($table);
            $table->uuid('supplier_id')->index();
            $table->uuid('paid_by')->nullable()->index();
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3)->default('EUR');
            $table->decimal('fx_rate', 12, 6)->default(1);
            $table->decimal('amount_eur', 12, 2);
            $table->string('method')->nullable();
            $table->string('purpose')->nullable();
        });

        Schema::create('customer_payments', function (Blueprint $table) use ($common) {
            $common($table);
            $table->uuid('customer_id')->index();
            $table->uuid('received_by')->nullable()->index();
            $table->decimal('amount', 12, 2);
            $table->string('method')->nullable();
        });

        Schema::create('payment_allocations', function (Blueprint $table) use ($common) {
            $common($table);
            $table->uuid('customer_payment_id')->index();
            $table->uuid('sale_id')->index();
            $table->decimal('amount', 12, 2);
        });

        Schema::create('expenses', function (Blueprint $table) use ($common) {
            $common($table);
            $table->string('category');
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3)->default('EUR');
            $table->decimal('fx_rate', 12, 6)->default(1);
            $table->decimal('amount_eur', 12, 2);
            $table->uuid('paid_by')->nullable()->index();
            $table->string('receipt_path')->nullable();
        });

        Schema::create('partner_transfers', function (Blueprint $table) use ($common) {
            $common($table);
            $table->uuid('from_partner')->index();
            $table->uuid('to_partner')->index();
            $table->decimal('amount', 12, 2);
            $table->string('method')->nullable();
            $table->string('note')->nullable();
        });

        Schema::create('settings', function (Blueprint $table) use ($common) {
            $common($table);
            $table->string('key')->unique();
            $table->json('value')->nullable();
        });

        Schema::create('sync_changes', function (Blueprint $table) {
            $table->bigIncrements('seq');
            $table->string('table_name');
            $table->uuid('record_id');
            $table->timestamp('changed_at');
            $table->index(['table_name', 'record_id']);
        });

        Schema::create('processed_ops', function (Blueprint $table) {
            $table->uuid('op_id')->primary();
            $table->uuid('device_id')->nullable()->index();
            $table->timestamp('processed_at');
        });
    }

    public function down(): void
    {
        foreach ([
            'processed_ops', 'sync_changes', 'settings', 'partner_transfers', 'expenses',
            'payment_allocations', 'customer_payments', 'supplier_payments', 'stock_adjustments',
            'sale_lines', 'sales', 'purchase_lines', 'purchases', 'suppliers', 'customers',
            'products', 'partners', 'devices',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
