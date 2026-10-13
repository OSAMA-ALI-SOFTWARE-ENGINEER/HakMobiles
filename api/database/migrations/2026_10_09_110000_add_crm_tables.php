<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('customers', 'status')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->string('status')->default('lead');
                $table->string('shop_type')->nullable();
                $table->json('tags')->nullable();
                $table->string('source')->nullable();
                $table->uuid('assigned_to')->nullable()->index();
                $table->string('whatsapp')->nullable();
                $table->string('postcode')->nullable();
                $table->unsignedInteger('payment_terms')->nullable();
                $table->text('notes')->nullable();
            });
        }

        if (! Schema::hasTable('customer_activities')) {
            Schema::create('customer_activities', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('created_by')->nullable()->index();
                $table->uuid('device_id')->nullable()->index();
                $table->timestamps();
                $table->uuid('updated_by')->nullable();
                $table->softDeletes();
                $table->uuid('customer_id')->index();
                $table->string('type');
                $table->text('body')->nullable();
                $table->uuid('user_id')->nullable()->index();
                $table->timestamp('happened_at')->nullable();
            });
        }

        if (! Schema::hasTable('follow_ups')) {
            Schema::create('follow_ups', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('created_by')->nullable()->index();
                $table->uuid('device_id')->nullable()->index();
                $table->timestamps();
                $table->uuid('updated_by')->nullable();
                $table->softDeletes();
                $table->uuid('customer_id')->index();
                $table->string('title');
                $table->string('type')->nullable();
                $table->timestamp('due_at');
                $table->uuid('assigned_to')->nullable()->index();
                $table->timestamp('done_at')->nullable();
                $table->string('auto_reason')->nullable();
                $table->text('notes')->nullable();
                $table->string('priority')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('follow_ups');
        Schema::dropIfExists('customer_activities');
    }
};
