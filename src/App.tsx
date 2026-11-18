import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Code2,
  Compass,
  Lock,
  MessageCircle,
  Moon,
  RefreshCw,
  Shield,
  Sun,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  LOW_BALANCE_THRESHOLD,
  PaymentProvider,
  WalletTransaction,
} from './domain/datingEngine';
import { NavTab, PlatformState } from './types/app';
import { DiscoverView } from './components/DiscoverView';
import { ChatView } from './components/ChatView';
import { WalletTopUpView } from './components/WalletTopUpView';
import { SecurityTrustView } from './components/SecurityTrustView';
import { BlueprintDocsView } from './components/BlueprintDocsView';
import { BiometricLockModal } from './components/BiometricLockModal';
import {
  BiometricEnrollment,
  clearBiometricEnrollment,
  enrollBiometricLock,
  getBiometricEnrollment,
} from './utils/biometricAuth';
import {
  createSyncChannel,
  enqueueOfflineMessage,
  loadCachedSnapshot,
  loadOfflineQueue,
  QueuedOfflineMessage,
  saveCachedSnapshot,
  saveOfflineQueue,
} from './utils/offlineSync';
import {
  dispatchPushNotification,
  requestBrowserNotifications,
} from './utils/pushNotifications';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('discover');
  const [state, setState] = useState<PlatformState | null>(() =>
    loadCachedSnapshot<PlatformState>(),
  );
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!loadCachedSnapshot<PlatformState>());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('kora_theme_v1') === 'dark';
    } catch {
      return false;
    }
  });

  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [offlineQueue, setOfflineQueue] = useState<QueuedOfflineMessage[]>(() =>
    loadOfflineQueue(),
  );

  const [biometric, setBiometric] = useState<BiometricEnrollment | null>(() =>
    getBiometricEnrollment(),
  );
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [toast, setToast] = useState<{
    id: string;
    title: string;
    body: string;
    tone: 'info' | 'warning' | 'success';
  } | null>(null);

  const syncChannelRef = useRef<BroadcastChannel | null>(null);
  const lastAlertedLowRef = useRef<boolean>(false);

  const isOffline = simulatedOffline || !browserOnline;

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('kora_theme_v1', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('kora_theme_v1', 'light');
    }
  }, [darkMode]);

  const applyNewState = useCallback((next: PlatformState, broadcast = true) => {
    setState(next);
    saveCachedSnapshot(next);
    if (broadcast) {
      syncChannelRef.current?.postMessage({ type: 'state_changed' });
    }
    if (
      next.wallet.coinBalance <= LOW_BALANCE_THRESHOLD &&
      !lastAlertedLowRef.current
    ) {
      lastAlertedLowRef.current = true;
      const body = `Only ${next.wallet.coinBalance} coins left. Top up $1.00 for 100 coins.`;
      dispatchPushNotification('Kora Low Coin Balance', body);
    } else if (next.wallet.coinBalance > LOW_BALANCE_THRESHOLD) {
      lastAlertedLowRef.current = false;
    }
  }, []);

  const fetchBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error('Failed to load platform data.');
      const data = (await res.json()) as PlatformState;
      applyNewState(data, false);
      setErrorMsg(null);
    } catch (err) {
      if (!state) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to reach server.');
      }
    } finally {
      setLoading(false);
    }
  }, [applyNewState, state]);

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  // Real-time SSE + Cross-tab BroadcastChannel sync
  useEffect(() => {
    syncChannelRef.current = createSyncChannel((ev) => {
      if (ev.type === 'state_changed') {
        fetchBootstrap();
      }
    });

    const es = new EventSource('/api/events');
    es.addEventListener('balance_updated', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          state?: PlatformState;
          creditedCoins?: number;
          reference?: string;
        };
        if (data.state) {
          applyNewState(data.state, false);
        }
        if (data.creditedCoins) {
          const msg = `+${data.creditedCoins} coins credited (${data.reference}).`;
          dispatchPushNotification('Kora Top-Up Confirmed', msg);
          setToast({
            id: String(Date.now()),
            title: 'Payment Verified',
            body: msg,
            tone: 'success',
          });
        }
      } catch {
        // Ignore malformed SSE frame
      }
    });

    es.addEventListener('message_received', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          state?: PlatformState;
        };
        if (data.state) {
          applyNewState(data.state, false);
        }
      } catch {
        // Ignore malformed SSE frame
      }
    });

    return () => {
      es.close();
      syncChannelRef.current?.close();
    };
  }, [applyNewState, fetchBootstrap]);

  // Browser online/offline events
  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    const currentQueue = loadOfflineQueue();
    if (currentQueue.length === 0 || isOffline) {
      await fetchBootstrap();
      return;
    }

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: currentQueue }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          syncedCount: number;
          state: PlatformState;
        };
        saveOfflineQueue([]);
        setOfflineQueue([]);
        applyNewState(data.state);
        setToast({
          id: String(Date.now()),
          title: 'Offline Queue Synced',
          body: `${data.syncedCount} queued message(s) delivered to server.`,
          tone: 'success',
        });
      }
    } catch {
      // Keep queue intact until connection succeeds
    }
  }, [applyNewState, fetchBootstrap, isOffline]);

  useEffect(() => {
    if (!isOffline && offlineQueue.length > 0) {
      syncOfflineQueue();
    }
  }, [isOffline, offlineQueue.length, syncOfflineQueue]);

  const handleToggleLike = async (profileId: string) => {
    const res = await fetch(`/api/profiles/${profileId}/like`, { method: 'POST' });
    if (res.ok) {
      const data = (await res.json()) as { state: PlatformState };
      applyNewState(data.state);
    }
  };

  const handleStartChat = async (profileId: string) => {
    const res = await fetch('/api/chats/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: profileId }),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        conversation: { id: string };
        state: PlatformState;
      };
      applyNewState(data.state);
      setActiveChatId(data.conversation.id);
      setActiveTab('messages');
    }
  };

  const handleSendMessage = async (
    chatId: string,
    text: string,
  ): Promise<{ ok: boolean; error?: string; code?: number }> => {
    const trimmed = text.trim();
    if (!trimmed) return { ok: false, error: 'Message cannot be empty.' };

    if (isOffline && state) {
      const clientTempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const updatedQueue = enqueueOfflineMessage({
        clientTempId,
        chatId,
        text: trimmed,
        queuedAt: new Date().toISOString(),
      });
      setOfflineQueue(updatedQueue);

      const nextState: PlatformState = {
        ...state,
        conversations: state.conversations.map((conv) =>
          conv.id === chatId
            ? {
                ...conv,
                messages: [
                  ...conv.messages,
                  {
                    id: clientTempId,
                    clientTempId,
                    chatId,
                    sender: 'me',
                    text: trimmed,
                    createdAt: new Date().toISOString(),
                    isFreeMessage: conv.freeMessagesUsed < 4,
                    coinsCharged: 0,
                    syncStatus: 'queued',
                  },
                ],
              }
            : conv,
        ),
      };
      applyNewState(nextState, false);
      return { ok: true };
    }

    const res = await fetch(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
    });

    const data = await res.json();
    if (data.state) {
      applyNewState(data.state);
    }
    if (!res.ok) {
      return { ok: false, error: data.error, code: res.status };
    }
    return { ok: true };
  };

  const handleInitiateTopUp = async (
    usdAmount: number,
    provider: PaymentProvider,
    phoneNumber?: string,
  ): Promise<{ ok: boolean; transaction?: WalletTransaction; error?: string }> => {
    const res = await fetch('/api/wallet/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usdAmount, provider, phoneNumber }),
    });
    const data = await res.json();
    if (data.state) {
      applyNewState(data.state);
    }
    if (!res.ok) {
      return { ok: false, error: data.error || 'Top-up failed.' };
    }
    return { ok: true, transaction: data.transaction };
  };

  const handleSimulateWebhook = async (
    reference: string,
    tamperSignature = false,
  ): Promise<{ ok: boolean; message: string }> => {
    const res = await fetch('/api/wallet/simulate-gateway-callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, tamperSignature }),
    });
    const data = await res.json();
    if (data.state) {
      applyNewState(data.state);
    }
    if (!res.ok) {
      return {
        ok: false,
        message: `Webhook rejected (${res.status}): ${data.error || 'Signature mismatch'}. Fraud log updated.`,
      };
    }
    return {
      ok: true,
      message: `HMAC signature (${data.signaturePreview}) verified. +${data.tx.coinsDelta} coins credited in real time!`,
    };
  };

  const handleEvaluateFraud = async (payload: {
    text?: string;
    topUpCountLastHour?: number;
    topUpUsdAmount?: number;
  }) => {
    const res = await fetch('/api/fraud/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.state) {
      applyNewState(data.state);
    }
    setToast({
      id: String(Date.now()),
      title: data.evaluation.allowed ? 'Rule Check Passed' : 'Fraud Rule Triggered',
      body: `Risk Score ${data.evaluation.riskScore}/100 · ${
        data.evaluation.triggeredRules[0]?.code || 'CLEAN'
      }`,
      tone: data.evaluation.allowed ? 'success' : 'warning',
    });
  };

  const handleEnrollBiometric = async (pin: string) => {
    if (!state) return;
    const enrollment = await enrollBiometricLock(state.user.id, state.user.email, pin);
    setBiometric(enrollment);
    setToast({
      id: String(Date.now()),
      title: 'Biometric Lock Active',
      body: `Session protection enabled (${enrollment.mode === 'webauthn' ? 'Hardware WebAuthn' : 'Passkey PIN Vault'}).`,
      tone: 'success',
    });
  };

  const handleDisableBiometric = () => {
    clearBiometricEnrollment();
    setBiometric(null);
    setIsLocked(false);
  };

  const handleEnableNotifications = async () => {
    const perm = await requestBrowserNotifications();
    if (perm === 'granted') {
      dispatchPushNotification(
        'Kora Push Alerts Enabled',
        'You will be alerted whenever your balance drops to 15 coins or below.',
      );
      setToast({
        id: String(Date.now()),
        title: 'Push Notifications Enabled',
        body: 'Low-balance alerts will trigger desktop/mobile notifications.',
        tone: 'success',
      });
    } else {
      setToast({
        id: String(Date.now()),
        title: 'In-App Alerts Active',
        body: 'Browser notifications were not granted; in-app low-balance alerts remain active.',
        tone: 'info',
      });
    }
  };

  const handleRestoreState = async (restored: PlatformState) => {
    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(restored),
    });
    if (res.ok) {
      const data = (await res.json()) as { state: PlatformState };
      applyNewState(data.state);
      setToast({
        id: String(Date.now()),
        title: 'Backup Restored',
        body: 'Encrypted vault decrypted and synchronized.',
        tone: 'success',
      });
    }
  };

  const handleResetDemo = async () => {
    const res = await fetch('/api/reset-demo', { method: 'POST' });
    if (res.ok) {
      const data = (await res.json()) as PlatformState;
      saveOfflineQueue([]);
      setOfflineQueue([]);
      lastAlertedLowRef.current = false;
      applyNewState(data);
      setToast({
        id: String(Date.now()),
        title: 'Demo State Reset',
        body: 'Restored initial 18 coins and fresh 4-free-message chat allowances.',
        tone: 'info',
      });
    }
  };

  const navItems: Array<{ id: NavTab; label: string; icon: typeof Compass }> = useMemo(
    () => [
      { id: 'discover', label: 'Discover', icon: Compass },
      { id: 'messages', label: 'Messages', icon: MessageCircle },
      { id: 'wallet', label: 'Wallet', icon: Wallet },
      { id: 'security', label: 'Security', icon: Shield },
      { id: 'blueprint', label: 'Blueprint', icon: Code2 },
    ],
    [],
  );

  const isLowBalance = (state?.wallet.coinBalance ?? 100) <= LOW_BALANCE_THRESHOLD;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-20 md:pb-12">
      {/* Desktop 3-Zone Top Bar Contract */}
      <header className="hidden md:block sticky top-0 z-30 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single wordmark */}
          <a
            href="#discover"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('discover');
            }}
            className="text-xl font-display font-bold tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap shrink-0"
          >
            Kora
          </a>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav aria-label="Primary navigation" className="flex items-center gap-6">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-rose-600 text-zinc-900 dark:text-zinc-50'
                      : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('wallet')}
              className="min-h-[40px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold font-mono tabular-nums transition-colors whitespace-nowrap shrink-0"
            >
              Top Up · {state?.wallet.coinBalance ?? 0} coins
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Top Bar (<= 52px) */}
      <div className="md:hidden sticky top-0 z-30 h-13 px-4 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <span className="text-lg font-display font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Kora
        </span>
        <button
          type="button"
          onClick={() => setActiveTab('wallet')}
          className="min-h-[36px] px-3 rounded-lg bg-rose-600 text-white text-xs font-mono tabular-nums font-semibold"
        >
          {state?.wallet.coinBalance ?? 0} coins
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Workspace Utility Toolbar (Theme, Offline/Sync, Biometric Lock, Reset) */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 px-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {state?.user.name ?? 'Member'} · {state?.user.city ?? 'Global'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
              {isOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                  Offline ({offlineQueue.length} queued)
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  Real-Time Synced
                </>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSimulatedOffline((v) => !v)}
              className="min-h-[36px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium whitespace-nowrap"
            >
              {isOffline ? 'Go Online' : 'Offline Mode'}
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="min-h-[36px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1.5 font-medium whitespace-nowrap"
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                  Light
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                  Dark
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (biometric?.enrolled) {
                  setIsLocked(true);
                } else {
                  setActiveTab('security');
                }
              }}
              className="min-h-[36px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1.5 font-medium whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              {biometric?.enrolled ? 'Lock App' : 'Biometrics'}
            </button>

            <button
              type="button"
              onClick={handleResetDemo}
              aria-label="Reset demo data"
              className="min-h-[36px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1.5 font-medium whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Reset
            </button>
          </div>
        </div>

        {/* Low-Balance Push Alert Banner */}
        {state && isLowBalance && (
          <div
            role="status"
            data-testid="low-balance-banner"
            className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-900/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  Low Coin Balance Alert ({state.wallet.coinBalance} coins left)
                </p>
                <p className="mt-0.5 opacity-90">
                  Your balance is at or below {LOW_BALANCE_THRESHOLD} coins. Top up $1.00 for 100 coins so active chats stay uninterrupted.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('wallet')}
              className="min-h-[38px] px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              Top Up $1 (100 Coins)
            </button>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 text-xs"
          >
            <div>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                {toast.title}:{' '}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">{toast.body}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss alert"
              className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {loading && !state ? (
          <div className="p-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Loading Kora platform...
          </div>
        ) : errorMsg && !state ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-rose-600">
            {errorMsg}
          </div>
        ) : state ? (
          <>
            {activeTab === 'discover' && (
              <DiscoverView
                profiles={state.profiles}
                conversations={state.conversations}
                onToggleLike={handleToggleLike}
                onStartChat={handleStartChat}
              />
            )}

            {activeTab === 'messages' && (
              <ChatView
                profiles={state.profiles}
                conversations={state.conversations}
                activeChatId={activeChatId}
                coinBalance={state.wallet.coinBalance}
                isOffline={isOffline}
                queuedCount={offlineQueue.length}
                onSelectChat={setActiveChatId}
                onSendMessage={handleSendMessage}
                onNavigateTopUp={() => setActiveTab('wallet')}
              />
            )}

            {activeTab === 'wallet' && (
              <WalletTopUpView
                state={state}
                onInitiateTopUp={handleInitiateTopUp}
                onSimulateWebhook={handleSimulateWebhook}
              />
            )}

            {activeTab === 'security' && (
              <SecurityTrustView
                state={state}
                biometric={biometric}
                isOffline={isOffline}
                queuedCount={offlineQueue.length}
                onEnrollBiometric={handleEnrollBiometric}
                onDisableBiometric={handleDisableBiometric}
                onLockNow={() => setIsLocked(true)}
                onToggleOffline={() => setSimulatedOffline((v) => !v)}
                onSyncNow={syncOfflineQueue}
                onEnableNotifications={handleEnableNotifications}
                onRestoreState={handleRestoreState}
                onEvaluateFraud={handleEvaluateFraud}
              />
            )}

            {activeTab === 'blueprint' && <BlueprintDocsView />}
          </>
        ) : null}
      </main>

      {/* Mobile Bottom Tab Bar (64px height) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-5 items-center"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {isLocked && biometric?.enrolled && state && (
        <BiometricLockModal
          userId={state.user.id}
          enrollment={biometric}
          onUnlocked={() => setIsLocked(false)}
        />
      )}
    </div>
  );
}
