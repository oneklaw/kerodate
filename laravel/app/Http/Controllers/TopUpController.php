<?php

namespace App\Http\Controllers;

use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\AntiSpamFraudService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\View\View;

class TopUpController extends Controller
{
    public function __construct(
        private readonly WalletService $walletService,
        private readonly AntiSpamFraudService $fraudService,
    ) {}

    public function show(Request $request): View
    {
        $wallet = Wallet::firstOrCreate(['user_id' => $request->user()->id]);
        $transactions = $wallet->transactions()->limit(25)->get();

        return view('wallet.topup', [
            'wallet' => $wallet,
            'transactions' => $transactions,
        ]);
    }

    public function initiate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'usd_amount' => ['required', 'numeric', 'min:1', 'max:2500'],
            'provider' => ['required', 'in:flutterwave,mtn_momo'],
            'phone_number' => ['nullable', 'string', 'max:24'],
        ]);

        $user = $request->user();
        $fraudCheck = $this->fraudService->evaluateTopUpVelocity(
            $user,
            (float) $validated['usd_amount'],
            (string) $request->ip()
        );

        if (!$fraudCheck['allowed']) {
            return response()->json([
                'message' => 'Top-up flagged by fraud protection rules.',
                'rules' => $fraudCheck['rules'],
            ], 429);
        }

        $coins = $this->walletService->calculateCoins((float) $validated['usd_amount']);
        $reference = strtoupper($validated['provider'] === 'flutterwave' ? 'FLW' : 'MOMO') . '-' . Str::ulid();
        $wallet = Wallet::firstOrCreate(['user_id' => $user->id]);

        $tx = WalletTransaction::create([
            'wallet_id' => $wallet->id,
            'reference' => $reference,
            'type' => 'top_up',
            'provider' => $validated['provider'],
            'usd_amount' => $validated['usd_amount'],
            'coins_delta' => $coins,
            'balance_after' => $wallet->coin_balance,
            'status' => 'pending',
            'metadata' => ['phone_number' => $validated['phone_number'] ?? null],
        ]);

        if ($validated['provider'] === 'flutterwave') {
            $flwResponse = Http::withToken(config('services.flutterwave.secret_key'))
                ->post('https://api.flutterwave.com/v3/payments', [
                    'tx_ref' => $reference,
                    'amount' => $validated['usd_amount'],
                    'currency' => 'USD',
                    'redirect_url' => route('wallet.topup'),
                    'customer' => ['email' => $user->email, 'name' => $user->name],
                    'meta' => ['coins' => $coins, 'wallet_id' => $wallet->id],
                ]);

            return response()->json([
                'reference' => $reference,
                'coins' => $coins,
                'checkout_url' => $flwResponse->json('data.link'),
                'transaction_id' => $tx->id,
            ]);
        }

        // MTN MoMo RequestToPay collection flow
        Http::withHeaders([
            'X-Reference-Id' => (string) Str::uuid(),
            'X-Target-Environment' => config('services.mtn_momo.environment', 'sandbox'),
            'Ocp-Apim-Subscription-Key' => config('services.mtn_momo.subscription_key'),
        ])->post(config('services.mtn_momo.base_url') . '/collection/v1_0/requesttopay', [
            'amount' => (string) $validated['usd_amount'],
            'currency' => 'USD',
            'externalId' => $reference,
            'payer' => ['partyIdType' => 'MSISDN', 'partyId' => $validated['phone_number']],
            'payerMessage' => "Kora {$coins} Coins Top-Up",
            'payeeNote' => $reference,
        ]);

        return response()->json([
            'reference' => $reference,
            'coins' => $coins,
            'status' => 'pending_momo_prompt',
            'transaction_id' => $tx->id,
        ]);
    }
}
