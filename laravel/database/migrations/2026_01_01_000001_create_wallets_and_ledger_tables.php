<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('coin_balance')->default(0);
            $table->unsignedBigInteger('lifetime_coins_purchased')->default(0);
            $table->unsignedBigInteger('lifetime_coins_spent')->default(0);
            $table->unsignedInteger('low_balance_threshold')->default(15);
            $table->timestamp('low_balance_notified_at')->nullable();
            $table->timestamps();
        });

        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wallet_id')->constrained()->cascadeOnDelete();
            $table->string('reference', 80)->unique();
            $table->string('idempotency_key', 120)->nullable()->unique();
            $table->enum('type', ['top_up', 'message_spend', 'free_grant', 'refund']);
            $table->enum('provider', ['flutterwave', 'mtn_momo', 'internal'])->default('internal');
            $table->decimal('usd_amount', 10, 2)->default(0.00);
            $table->bigInteger('coins_delta');
            $table->unsignedBigInteger('balance_after');
            $table->enum('status', ['pending', 'completed', 'failed', 'flagged'])->default('pending');
            $table->json('metadata')->nullable();
            $table->timestamp('webhook_verified_at')->nullable();
            $table->timestamps();

            $table->index(['wallet_id', 'status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallet_transactions');
        Schema::dropIfExists('wallets');
    }
};
