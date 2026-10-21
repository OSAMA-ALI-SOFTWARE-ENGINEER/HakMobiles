<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            if (! Schema::hasColumn('suppliers', 'first_name')) {
                $table->string('first_name')->nullable();
            }
            if (! Schema::hasColumn('suppliers', 'last_name')) {
                $table->string('last_name')->nullable();
            }
            if (! Schema::hasColumn('suppliers', 'address')) {
                $table->string('address')->nullable();
            }
            if (! Schema::hasColumn('suppliers', 'home_address')) {
                $table->string('home_address')->nullable();
            }
            if (! Schema::hasColumn('suppliers', 'nif')) {
                $table->string('nif')->nullable()->unique();
            }
            if (! Schema::hasColumn('suppliers', 'whatsapp')) {
                $table->string('whatsapp')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropUnique(['nif']);
            $table->dropColumn(['first_name', 'last_name', 'address', 'home_address', 'nif', 'whatsapp']);
        });
    }
};
