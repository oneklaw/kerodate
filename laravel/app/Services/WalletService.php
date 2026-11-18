<?php

namespace App\Services;

use App\Events\LowCoinBalanceAlert;
use App\Events\WalletBalanceUpdated;
use App\Models\Conversation;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class WalletService
{
    public const COINS_PER_USD = 100;
    public const MESSAGE_COIN_COST = 1;

    public function calculateCoins(float $usdAmount): int
    {
        if ($usdAmount < 1.00) {
            throw new RuntimeException('Minimum top-up amount is $1.00 (100 coins).');
        }
        return (int) round($usdAmount * self::COINS_PER_USD);
    }

    public function chargeMessage(User $sender, Conversation $conversation): array
    {
        return DB::transaction(function () use ($sender, $conversation) {
            $lockedConv = Conversation::whereKey($conversation->id)->lockForUpdate()->firstOrFail();
            $wallet = Wallet::firstOrCreate(
                ['user_id' => $sender->id],
                ['coin_balance' => 0, 'low_balance_threshold' => 15]
            );
            $lockedWallet = Wallet::whereKey($wallet->id)->lockForUpdate()->firstOrFail();

            $isInitiator = $lockedConv->initiator_id === $sender->id;
            $freeUsed = $isInitiator
                ? $lockedConv->initiator_free_messages_used
                : $lockedConv->recipient_free_messages_used;

            if ($freeUsed < Conversation::FREE_MESSAGES_LIMIT) {
                if ($isInitiator) {
                    $lockedConv->increment('initiator_free_messages_used');
                } else {
                    $lockedConv->increment('recipient_free_messages_used');
                }

                return [
                    'is_free' => true,
                    'coins_charged' => 0,
                    'balance_after' => $lockedWallet->coin_balance,
                    'free_remaining' => Conversation::FREE_MESSAGES_LIMIT - ($freeUsed + 1),
                ];
            }

            if ($lockedWallet->coin_balance < self::MESSAGE_COIN_COST) {
                event(new LowCoinBalanceAlert($sender->id, $lockedWallet->coin_balance));
                throw new RuntimeException('Insufficient coins. Top up $1.00 for 100 coins to continue.');
            }

            $lockedWallet->coin_balance -= self::MESSAGE_COIN_COST;
            $lockedWallet->lifetime_coins_spent += self::MESSAGE_COIN_COST;
            $lockedWallet->save();

            WalletTransaction::create([
                'wallet_id' => $lockedWallet->id,
                'reference' => 'MSG-' . strtoupper(Str::random(10)),
                'type' => 'message_spend',
                'provider' => 'internal',
                'usd_amount' => 0.01,
                'coins_delta' => -self::MESSAGE_COIN_COST,
                'balance_after' => $lockedWallet->coin_balance,
                'status' => 'completed',
                'metadata' => ['conversation_id' => $lockedConv->id],
            ]);

            if ($lockedWallet->isLowBalance()) {
                event(new LowCoinBalanceAlert($sender->id, $lockedWallet->coin_balance));
            }
            event(new WalletBalanceUpdated($sender->id, $lockedWallet->coin_balance));

            return [
                'is_free' => false,
                'coins_charged' => self::MESSAGE_COIN_COST,
                'balance_after' => $lockedWallet->coin_balance,
                'free_remaining' => 0,
            ];
        });
    }

    public function creditFromVerifiedWebhook(string $reference, string $idempotencyKey): WalletTransaction
    {
        return DB::transaction(function () use ($reference, $idempotencyKey) {
            $tx = WalletTransaction::where('reference', $reference)->lockForUpdate()->firstOrFail();

            if ($tx->status === 'completed') {
                return $tx;
            }

            $wallet = Wallet::whereKey($tx->wallet_id)->lockForUpdate()->firstOrFail();
            $wallet->coin_balance += $tx->coins_delta;
            $wallet->lifetime_coins_purchased += $tx->coins_delta;
            $wallet->low_balance_notified_at = null;
            $wallet->save();

            $tx->status = 'completed';
            $tx->idempotency_key = $idempotencyKey;
            $tx->balance_after = $wallet->coin_balance;
            $tx->webhook_verified_at = now();
            $tx->save();

            event(new WalletBalanceUpdated($wallet->user_id, $wallet->coin_balance));

            return $tx;
        });
    }
}
