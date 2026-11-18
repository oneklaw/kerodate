import { FormEvent, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  CreditCard,
  Download,
  ShieldAlert,
  Smartphone,
  Webhook,
} from 'lucide-react';
import {
  calculateCoinsForUsd,
  COINS_PER_USD,
  FREE_MESSAGES_PER_CHAT,
  PaymentProvider,
  WalletTransaction,
} from '../domain/datingEngine';
import { PlatformState } from '../types/app';

interface WalletTopUpViewProps {
  state: PlatformState;
  onInitiateTopUp: (
    usdAmount: number,
    provider: PaymentProvider,
    phoneNumber?: string,
  ) => Promise<{ ok: boolean; transaction?: WalletTransaction; error?: string }>;
  onSimulateWebhook: (
    reference: string,
    tamperSignature?: boolean,
  ) => Promise<{ ok: boolean; message: string }>;
}

export function WalletTopUpView({
  state,
  onInitiateTopUp,
  onSimulateWebhook,
}: WalletTopUpViewProps) {
  const [usdAmount, setUsdAmount] = useState<number>(5);
  const [provider, setProvider] = useState<PaymentProvider>('flutterwave');
  const [phoneNumber, setPhoneNumber] = useState<string>('+256 772 410 890');
  const [submitting, setSubmitting] = useState(false);
  const [activePendingRef, setActivePendingRef] = useState<string | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'top_up' | 'message_spend'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const coinsToReceive = calculateCoinsForUsd(usdAmount);
  const sliderPercent = Math.min(100, Math.max(0, ((Math.min(usdAmount, 250) - 1) / 249) * 100));

  const freeChatsAvailable = useMemo(() => {
    const usedChatIds = new Set(state.conversations.map((c) => c.matchId));
    const untouchedProfiles = state.profiles.filter((p) => !usedChatIds.has(p.id)).length;
    const activeFreeLeft = state.conversations.reduce(
      (sum, c) => sum + Math.max(0, FREE_MESSAGES_PER_CHAT - c.freeMessagesUsed),
      0,
    );
    return untouchedProfiles * FREE_MESSAGES_PER_CHAT + activeFreeLeft;
  }, [state.conversations, state.profiles]);

  const filteredTransactions = useMemo(() => {
    return state.transactions.filter((tx) => {
      if (ledgerFilter !== 'all' && tx.type !== ledgerFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          tx.reference.toLowerCase().includes(q) ||
          tx.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [state.transactions, ledgerFilter, searchQuery]);

  const handleCheckout = async (e: FormEvent) => {
    e.preventDefault();
    setGatewayStatus(null);
    setSubmitting(true);
    try {
      const res = await onInitiateTopUp(
        usdAmount,
        provider,
        provider === 'mtn_momo' ? phoneNumber : undefined,
      );
      if (res.ok && res.transaction) {
        setActivePendingRef(res.transaction.reference);
        setGatewayStatus({
          type: 'info',
          text: `Checkout ${res.transaction.reference} initialized for $${res.transaction.usdAmount.toFixed(2)} (${res.transaction.coinsDelta} coins). Confirm via verified webhook below.`,
        });
      } else {
        setGatewayStatus({
          type: 'error',
          text: res.error ?? 'Payment initiation failed.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleWebhookTrigger = async (reference: string, tamper = false) => {
    setSubmitting(true);
    try {
      const result = await onSimulateWebhook(reference, tamper);
      setGatewayStatus({
        type: result.ok ? 'success' : 'error',
        text: result.message,
      });
      if (result.ok) {
        setActivePendingRef(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const exportCsv = () => {
    const header = 'Reference,Type,Provider,USD,CoinsDelta,BalanceAfter,Status,CreatedAt\n';
    const rows = state.transactions
      .map(
        (t) =>
          `"${t.reference}","${t.type}","${t.provider ?? 'internal'}",${t.usdAmount.toFixed(2)},${t.coinsDelta},${t.balanceAfter},"${t.status}","${t.createdAt}"`,
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kora-wallet-ledger.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-label="Wallet and Coin Top-Up" className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Real-Time Coin Wallet · $1.00 = {COINS_PER_USD} Coins
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">
            Top Up &amp; Ledger
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1.5">
            Slide to pick any amount starting from $1.00 for 100 coins (100 messages) or enter any custom figure.
          </p>
        </div>

        <button
          type="button"
          onClick={exportCsv}
          className="min-h-[40px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 whitespace-nowrap shrink-0 self-start md:self-auto"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {/* 4-column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Available Balance</p>
          <p
            data-testid="wallet-coin-balance"
            className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-50 mt-1"
          >
            {state.wallet.coinBalance.toLocaleString()}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 tabular-nums">
            coins · ${(state.wallet.coinBalance / COINS_PER_USD).toFixed(2)} value
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Free Messages Left</p>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-50 mt-1">
            {freeChatsAvailable}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            across new &amp; active chats
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Lifetime Purchased</p>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-50 mt-1">
            {state.wallet.lifetimePurchased.toLocaleString()}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">coins credited</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Low-Balance Alert</p>
          <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-50 mt-1">
            &le; {state.user.lowBalanceThreshold}
          </p>
          <p
            className={`text-xs mt-1 font-medium ${
              state.wallet.coinBalance <= state.user.lowBalanceThreshold
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {state.wallet.coinBalance <= state.user.lowBalanceThreshold
              ? 'Threshold reached'
              : 'Healthy balance'}
          </p>
        </div>
      </div>

      {/* Main Split: Top-Up Slider + Payment Gateway vs Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={handleCheckout}
          className="lg:col-span-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-6"
        >
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="topup-slider" className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Custom-Amount Slider
            </label>
            <span className="font-mono tabular-nums text-sm font-semibold text-rose-600 dark:text-rose-400">
              ${usdAmount.toFixed(2)} USD
            </span>
          </div>

          <div>
            <input
              id="topup-slider"
              type="range"
              min={1}
              max={250}
              step={1}
              value={Math.min(250, Math.max(1, usdAmount))}
              onChange={(e) => setUsdAmount(Number(e.target.value))}
              className="w-full kora-slider cursor-pointer"
              style={{
                background: `linear-gradient(to right, #e11d48 0%, #e11d48 ${sliderPercent}%, rgba(161,161,170,0.3) ${sliderPercent}%, rgba(161,161,170,0.3) 100%)`,
              }}
            />
            <div className="flex justify-between text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400 mt-2.5">
              <span>$1 (100)</span>
              <span>$50 (5,000)</span>
              <span>$125 (12,500)</span>
              <span>$250 (25,000)</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[1, 5, 10, 25, 50, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setUsdAmount(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono tabular-nums font-medium border transition-colors min-h-[36px] ${
                  usdAmount === preset
                    ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                ${preset}
              </button>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Coins You Receive</p>
              <p
                data-testid="topup-coins-preview"
                className="text-2xl font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-50 mt-0.5 flex items-center gap-2"
              >
                <Coins className="w-5 h-5 text-rose-600" aria-hidden="true" />
                {coinsToReceive.toLocaleString()} coins
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                Equivalent to {coinsToReceive.toLocaleString()} metered messages
              </p>
            </div>
            <div className="w-32">
              <label
                htmlFor="custom-usd-input"
                className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1"
              >
                Any USD amount
              </label>
              <input
                id="custom-usd-input"
                type="number"
                min={1}
                max={10000}
                step={1}
                value={usdAmount}
                onChange={(e) => setUsdAmount(Math.max(1, Number(e.target.value) || 1))}
                className="w-full min-h-[40px] px-3 text-right font-mono tabular-nums text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Select Payment Gateway
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider('flutterwave')}
                className={`min-h-[48px] px-4 py-3 rounded-xl border text-left flex items-center gap-3 transition-colors ${
                  provider === 'flutterwave'
                    ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/30 text-zinc-900 dark:text-zinc-50'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <CreditCard className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-xs font-bold">Flutterwave</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Card · Bank · Wallet</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('mtn_momo')}
                className={`min-h-[48px] px-4 py-3 rounded-xl border text-left flex items-center gap-3 transition-colors ${
                  provider === 'mtn_momo'
                    ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/30 text-zinc-900 dark:text-zinc-50'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Smartphone className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-xs font-bold">MTN MoMo</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Mobile Money Prompt</p>
                </div>
              </button>
            </div>
          </div>

          {provider === 'mtn_momo' && (
            <div>
              <label
                htmlFor="momo-phone"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                MTN Mobile Money MSISDN
              </label>
              <input
                id="momo-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+256 772 410 890"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm font-mono text-zinc-900 dark:text-zinc-100"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {submitting
              ? 'Creating Secure Checkout...'
              : `Initiate $${usdAmount.toFixed(2)} Top-Up (${coinsToReceive.toLocaleString()} coins)`}
          </button>

          {gatewayStatus && (
            <div
              role="status"
              className={`p-4 rounded-xl border text-xs space-y-3 ${
                gatewayStatus.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
                  : gatewayStatus.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200'
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200'
              }`}
            >
              <div className="flex items-start gap-2">
                {gatewayStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" aria-hidden="true" />
                ) : gatewayStatus.type === 'error' ? (
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
                ) : (
                  <Webhook className="w-4 h-4 shrink-0 mt-0.5 text-zinc-600 dark:text-zinc-400" aria-hidden="true" />
                )}
                <span className="leading-relaxed">{gatewayStatus.text}</span>
              </div>

              {activePendingRef && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleWebhookTrigger(activePendingRef, false)}
                    className="min-h-[38px] px-3.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs hover:opacity-90"
                  >
                    Confirm &amp; Credit via Verified Webhook
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleWebhookTrigger(activePendingRef, true)}
                    className="min-h-[38px] px-3.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Test Tampered Signature (401)
                  </button>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Transaction History Ledger */}
        <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Transaction History
            </h2>

            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              {(['all', 'top_up', 'message_spend'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setLedgerFilter(tab)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    ledgerFilter === tab
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab === 'top_up' ? 'Top-Ups' : 'Messages'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="ledger-search" className="sr-only">
              Search transactions
            </label>
            <input
              id="ledger-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by reference or description..."
              className="w-full min-h-[40px] px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
            />
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[460px] overflow-y-auto">
            {filteredTransactions.length === 0 ? (
              <p className="py-8 text-sm text-center text-zinc-500 dark:text-zinc-400">
                No matching transactions found.
              </p>
            ) : (
              filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="py-3.5 flex items-center justify-between gap-4 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {tx.description}
                    </p>
                    <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                      {tx.reference} · {tx.status}
                      {tx.webhookVerified ? ' · HMAC verified' : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-mono tabular-nums font-semibold ${
                        tx.coinsDelta >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      {tx.coinsDelta >= 0 ? `+${tx.coinsDelta}` : tx.coinsDelta} coins
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                      Bal: {tx.balanceAfter}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
