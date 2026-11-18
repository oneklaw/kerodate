<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('initiator_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('recipient_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('initiator_free_messages_used')->default(0);
            $table->unsignedTinyInteger('recipient_free_messages_used')->default(0);
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();

            $table->unique(['initiator_id', 'recipient_id']);
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->uuid('client_temp_id')->nullable()->unique();
            $table->text('body');
            $table->string('body_hash', 64)->index();
            $table->boolean('is_free_message')->default(false);
            $table->unsignedSmallInteger('coins_charged')->default(0);
            $table->timestamps();

            $table->index(['sender_id', 'created_at']);
        });

        Schema::create('fraud_rule_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('channel', ['chat', 'payment', 'webhook']);
            $table->string('rule_code', 64)->index();
            $table->unsignedTinyInteger('risk_score');
            $table->boolean('blocked')->default(false);
            $table->string('ip_address', 45)->nullable();
            $table->json('context')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fraud_rule_logs');
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
    }
};
