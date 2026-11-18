@extends('layouts.app')

@section('content')
<div
    x-data="koraTopUp({{ $wallet->coin_balance }}, '{{ route('wallet.topup.initiate') }}', '{{ csrf_token() }}')"
    class="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8"
>
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
            <p class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Wallet &amp; Coin Top-Up</p>
            <h1 class="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">
                Power Your Conversations
            </h1>
            <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Every new chat includes 4 free messages. Thereafter, 1 coin = 1 message ($1.00 = 100 coins).
            </p>
        </div>
        <div class="text-left sm:text-right">
            <span class="text-xs text-zinc-500 dark:text-zinc-400">Current Balance</span>
            <p class="text-3xl font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-50" x-text="balance + ' coins'"></p>
        </div>
    </div>

    <div class="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div class="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <div class="flex items-center justify-between">
                <label for="usd-slider" class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Custom Top-Up Amount
                </label>
                <span class="font-mono tabular-nums text-sm font-semibold text-rose-600 dark:text-rose-400" x-text="'$' + Number(usdAmount).toFixed(2) + ' USD'"></span>
            </div>

            <div class="mt-4">
                <input
                    id="usd-slider"
                    type="range"
                    min="1"
                    max="250"
                    step="1"
                    x-model.number="usdAmount"
                    class="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
                <div class="flex justify-between text-xs font-mono tabular-nums text-zinc-500 mt-2">
                    <span>$1 (100)</span>
                    <span>$25 (2,500)</span>
                    <span>$100 (10,000)</span>
                    <span>$250 (25,000)</span>
                </div>
            </div>

            <div class="mt-6 flex items-center justify-between gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <div>
                    <p class="text-xs text-zinc-500 dark:text-zinc-400">You Receive</p>
                    <p class="text-2xl font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-50" x-text="(usdAmount * 100).toLocaleString() + ' coins'"></p>
                </div>
                <div class="w-32">
                    <label for="exact-usd" class="sr-only">Exact USD Amount</label>
                    <input
                        id="exact-usd"
                        type="number"
                        min="1"
                        max="2500"
                        step="1"
                        x-model.number="usdAmount"
                        class="w-full px-3 py-2 text-right font-mono tabular-nums text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    />
                </div>
            </div>

            <div class="mt-6">
                <p class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-3">Payment Gateway</p>
                <div class="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        @click="provider = 'flutterwave'"
                        :class="provider === 'flutterwave' ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300' : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'"
                        class="px-4 py-3 rounded-xl border text-sm font-semibold transition-colors"
                    >
                        Flutterwave
                    </button>
                    <button
                        type="button"
                        @click="provider = 'mtn_momo'"
                        :class="provider === 'mtn_momo' ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300' : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'"
                        class="px-4 py-3 rounded-xl border text-sm font-semibold transition-colors"
                    >
                        MTN MoMo
                    </button>
                </div>
            </div>

            <div x-show="provider === 'mtn_momo'" class="mt-4">
                <label for="momo-msisdn" class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    MTN Mobile Money Number (MSISDN)
                </label>
                <input
                    id="momo-msisdn"
                    type="tel"
                    x-model="phoneNumber"
                    placeholder="+256 770 000 000"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100"
                />
            </div>

            <button
                type="button"
                @click="submitTopUp()"
                :disabled="loading"
                class="mt-6 w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
                <span x-show="!loading" x-text="'Pay $' + Number(usdAmount).toFixed(2) + ' via ' + (provider === 'flutterwave' ? 'Flutterwave' : 'MTN MoMo')"></span>
                <span x-show="loading">Processing secure checkout...</span>
            </button>
        </div>

        <div class="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100">Recent Ledger</h2>
            <div class="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
                @forelse($transactions as $tx)
                    <div class="py-3 flex items-center justify-between text-sm">
                        <div>
                            <p class="font-medium text-zinc-900 dark:text-zinc-100">{{ ucfirst(str_replace('_', ' ', $tx->type)) }}</p>
                            <p class="text-xs font-mono text-zinc-500">{{ $tx->reference }} · {{ $tx->status }}</p>
                        </div>
                        <span class="font-mono tabular-nums font-semibold {{ $tx->coins_delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100' }}">
                            {{ $tx->coins_delta >= 0 ? '+' : '' }}{{ $tx->coins_delta }}
                        </span>
                    </div>
                @empty
                    <p class="py-6 text-sm text-zinc-500">No wallet transactions recorded yet.</p>
                @endforelse
            </div>
        </div>
    </div>
</div>
@endsection
