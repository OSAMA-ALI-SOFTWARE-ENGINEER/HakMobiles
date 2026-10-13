<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['products', 'customers', 'suppliers', 'purchases', 'sales', 'expenses'] as $tableName) {
            if (! Schema::hasColumn($tableName, 'purged_at')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->timestamp('purged_at')->nullable();
                });
            }
        }
    }

    public function down(): void
    {
        foreach (['products', 'customers', 'suppliers', 'purchases', 'sales', 'expenses'] as $tableName) {
            if (Schema::hasColumn($tableName, 'purged_at')) {
                Schema::table($tableName, function (Blueprint $table) {
                    $table->dropColumn('purged_at');
                });
            }
        }
    }
};
