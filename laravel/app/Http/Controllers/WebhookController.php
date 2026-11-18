<?php

namespace App\Http\Controllers;

use App\Models\FraudRuleLog;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebhookController extends Controller
{
    public function __construct(private readonly WalletService $walletService) {}

    public function handleFlutterwave(Request $request): JsonResponse
    {
        $secretHash = config('services.flutterwave.webhook_hash');
        $signature = $request->header('verif-hash');

        if (!$signature || !hash_equals((string) $secretHash, (string) $signature)) {
            FraudRuleLog::create([
                'channel' => 'webhook',
                'rule_code' => 'INVALID_FLW_SIGNATURE',
                'risk_score' => 95,
                'blocked' => true,
                'ip_address' => $request->ip(),
            ]);
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $payload = $request->all();
        if (($payload['status'] ?? null) !== 'successful') {
            return response()->json(['ignored' => true], 200);
        }

        $reference = (string) ($payload['txRef'] ?? $payload['data']['tx_ref'] ?? '');
        $idempotencyKey = 'flw:' . ($payload['id'] ?? $payload['data']['id'] ?? $reference);

        $tx = $this->walletService->creditFromVerifiedWebhook($reference, $idempotencyKey);

        return response()->json([
            'status' => 'credited',
            'reference' => $tx->reference,
            'balance_after' => $tx->balance_after,
        ]);
    }

    public function handleMtnMomo(Request $request): JsonResponse
    {
        $rawBody = $request->getContent();
        $expectedSig = hash_hmac('sha256', $rawBody, (string) config('services.mtn_momo.webhook_secret'));
        $providedSig = (string) $request->header('X-Momo-Signature');

        if (!$providedSig || !hash_equals($expectedSig, $providedSig)) {
            FraudRuleLog::create([
                'channel' => 'webhook',
                'rule_code' => 'INVALID_MOMO_SIGNATURE',
                'risk_score' => 95,
                'blocked' => true,
                'ip_address' => $request->ip(),
            ]);
            return response()->json(['error' => 'Invalid MoMo signature'], 401);
        }

        $payload = $request->all();
        if (strtoupper((string) ($payload['status'] ?? '')) !== 'SUCCESSFUL') {
            return response()->json(['ignored' => true], 200);
        }

        $reference = (string) ($payload['externalId'] ?? '');
        $idempotencyKey = 'momo:' . ($payload['financialTransactionId'] ?? $reference);

        $tx = $this->walletService->creditFromVerifiedWebhook($reference, $idempotencyKey);

        return response()->json([
            'status' => 'credited',
            'reference' => $tx->reference,
            'balance_after' => $tx->balance_after,
        ]);
    }
}
