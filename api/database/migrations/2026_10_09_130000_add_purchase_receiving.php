<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('purchases', 'extra_cost')) {
            Schema::table('purchases', function (Blueprint $table) {
                $table->decimal('extra_cost', 12, 2)->default(0);
            });
        }

        if (! Schema::hasColumn('purchase_lines', 'qty_received')) {
            Schema::table('purchase_lines', function (Blueprint $table) {
                $table->integer('qty_received')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('purchases', 'extra_cost')) {
            Schema::table('purchases', function (Blueprint $table) {
                $table->dropColumn('extra_cost');
            });
        }

        if (Schema::hasColumn('purchase_lines', 'qty_received')) {
            Schema::table('purchase_lines', function (Blueprint $table) {
                $table->dropColumn('qty_received');
            });
        }
    }
};
