<?php

namespace App\Services;

use App\Models\FraudRuleLog;
use App\Models\Message;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\RateLimiter;

class AntiSpamFraudService
{
    public function evaluateMessage(User $user, string $body, string $ip): array
    {
        $riskScore = 0;
        $rulesTriggered = [];
        $normalizedHash = hash('sha256', preg_replace('/\s+/', ' ', strtolower(trim($body))));

        // 1. Velocity rate limit: max 8 outbound messages per 60s
        $rateKey = 'chat-send:' . $user->id;
        if (RateLimiter::tooManyAttempts($rateKey, 8)) {
            $riskScore += 55;
            $rulesTriggered[] = 'RATE_LIMIT_BURST';
        }
        RateLimiter::hit($rateKey, 60);

        // 2. Duplicate template spam across recent messages
        $duplicateCount = Message::where('sender_id', $user->id)
            ->where('body_hash', $normalizedHash)
            ->where('created_at', '>=', now()->subMinutes(30))
            ->count();

        if ($duplicateCount >= 2) {
            $riskScore += 55;
            $rulesTriggered[] = 'DUPLICATE_SPAM_TEMPLATE';
        }

        // 3. External phishing / solicitation pattern
        if (preg_match('/(https?:\/\/\S+|t\.me\/\S+|wa\.me\/\S+|\b(crypto|usdt|cashapp|whatsapp me|telegram me|wire transfer)\b)/i', $body)) {
            $riskScore += 65;
            $rulesTriggered[] = 'EXTERNAL_SOLICITATION_OR_PHISHING';
        }

        $blocked = $riskScore >= 40;
        if (!empty($rulesTriggered)) {
            FraudRuleLog::create([
                'user_id' => $user->id,
                'channel' => 'chat',
                'rule_code' => implode(',', $rulesTriggered),
                'risk_score' => min(100, $riskScore),
                'blocked' => $blocked,
                'ip_address' => $ip,
                'context' => ['preview' => mb_substr($body, 0, 120)],
            ]);
        }

        return [
            'allowed' => !$blocked,
            'risk_score' => min(100, $riskScore),
            'rules' => $rulesTriggered,
            'body_hash' => $normalizedHash,
        ];
    }

    public function evaluateTopUpVelocity(User $user, float $usdAmount, string $ip): array
    {
        $hourlyCount = WalletTransaction::whereHas('wallet', fn ($q) => $q->where('user_id', $user->id))
            ->where('type', 'top_up')
            ->where('created_at', '>=', now()->subHour())
            ->count();

        $riskScore = 0;
        $rules = [];

        if ($hourlyCount >= 5) {
            $riskScore += 60;
            $rules[] = 'PAYMENT_VELOCITY_SPIKE';
        }
        if ($usdAmount > 500) {
            $riskScore += 35;
            $rules[] = 'HIGH_VALUE_TOPUP_REVIEW';
        }

        $blocked = $riskScore >= 60;
        if (!empty($rules)) {
            FraudRuleLog::create([
                'user_id' => $user->id,
                'channel' => 'payment',
                'rule_code' => implode(',', $rules),
                'risk_score' => min(100, $riskScore),
                'blocked' => $blocked,
                'ip_address' => $ip,
                'context' => ['usd_amount' => $usdAmount, 'hourly_count' => $hourlyCount],
            ]);
        }

        return ['allowed' => !$blocked, 'risk_score' => $riskScore, 'rules' => $rules];
    }
}
