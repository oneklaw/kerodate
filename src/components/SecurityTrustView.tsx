import { ChangeEvent, FormEvent, useState } from 'react';
import {
  Bell,
  Download,
  Fingerprint,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { FraudEventLog } from '../domain/datingEngine';
import { PlatformState } from '../types/app';
import { BiometricEnrollment } from '../utils/biometricAuth';
import {
  createEncryptedBackup,
  EncryptedBackupEnvelope,
  restoreEncryptedBackup,
} from '../utils/encryptedBackup';
import { getBrowserNotificationPermission } from '../utils/pushNotifications';

interface SecurityTrustViewProps {
  state: PlatformState;
  biometric: BiometricEnrollment | null;
  isOffline: boolean;
  queuedCount: number;
  onEnrollBiometric: (pin: string) => Promise<void>;
  onDisableBiometric: () => void;
  onLockNow: () => void;
  onToggleOffline: () => void;
  onSyncNow: () => Promise<void>;
  onEnableNotifications: () => Promise<void>;
  onRestoreState: (restored: PlatformState) => Promise<void>;
  onEvaluateFraud: (payload: {
    text?: string;
    topUpCountLastHour?: number;
    topUpUsdAmount?: number;
  }) => Promise<void>;
}

export function SecurityTrustView({
  state,
  biometric,
  isOffline,
  queuedCount,
  onEnrollBiometric,
  onDisableBiometric,
  onLockNow,
  onToggleOffline,
  onSyncNow,
  onEnableNotifications,
  onRestoreState,
  onEvaluateFraud,
}: SecurityTrustViewProps) {
  const [pinInput, setPinInput] = useState('2468');
  const [backupPassphrase, setBackupPassphrase] = useState('kora-vault-2026');
  const [restorePassphrase, setRestorePassphrase] = useState('kora-vault-2026');
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [fraudTestText, setFraudTestText] = useState(
    'Send USDT to https://t.me/crypto_vip_promo for instant match',
  );
  const [notifPermission, setNotifPermission] = useState(getBrowserNotificationPermission());
  const [busy, setBusy] = useState(false);

  const handleEnroll = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onEnrollBiometric(pinInput);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadEncryptedBackup = async () => {
    setBackupNotice(null);
    try {
      const envelope = await createEncryptedBackup(state, backupPassphrase);
      const blob = new Blob([JSON.stringify(envelope, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kora-backup-${new Date().toISOString().slice(0, 10)}.kora.enc`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupNotice(
        `Encrypted AES-256-GCM backup exported (${envelope.checksum.slice(0, 10)}...).`,
      );
    } catch (err) {
      setBackupNotice(err instanceof Error ? err.message : 'Backup export failed.');
    }
  };

  const handleRestoreFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupNotice(null);
    try {
      const text = await file.text();
      const envelope = JSON.parse(text) as EncryptedBackupEnvelope;
      const decrypted = await restoreEncryptedBackup<PlatformState>(
        envelope,
        restorePassphrase,
      );
      await onRestoreState(decrypted);
      setBackupNotice('Encrypted backup decrypted and restored across platform.');
    } catch (err) {
      setBackupNotice(err instanceof Error ? err.message : 'Restore failed.');
    }
    e.target.value = '';
  };

  const handleNotificationToggle = async () => {
    await onEnableNotifications();
    setNotifPermission(getBrowserNotificationPermission());
  };

  const handleFraudTest = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onEvaluateFraud({ text: fraudTestText });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Security, Sync and Anti-Spam Rules" className="space-y-5">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Security, Continuity &amp; Risk Engine
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-0.5">
          Trust, Biometrics &amp; Fraud Rules
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Protect your wallet with WebAuthn biometric lock, export AES-256-GCM encrypted backups, sync offline queues, and inspect anti-spam rules.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Biometric Authentication Layer */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <Fingerprint className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Biometric Authentication Lock
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {biometric?.enrolled
                    ? `Active (${biometric.mode === 'webauthn' ? 'Hardware WebAuthn' : 'Passkey PIN Vault'})`
                    : 'Not enrolled yet'}
                </p>
              </div>
            </div>

            {biometric?.enrolled && (
              <button
                type="button"
                onClick={onLockNow}
                className="min-h-[40px] px-3.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                Lock Now
              </button>
            )}
          </div>

          <form onSubmit={handleEnroll} className="space-y-3 pt-2">
            <div>
              <label
                htmlFor="biometric-pin"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Recovery Security PIN (min 4 digits)
              </label>
              <input
                id="biometric-pin"
                type="password"
                minLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm font-mono text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="submit"
                disabled={busy}
                className="min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors"
              >
                {biometric?.enrolled ? 'Re-Enroll Biometric Lock' : 'Enable Biometric Lock'}
              </button>
              {biometric?.enrolled && (
                <button
                  type="button"
                  onClick={onDisableBiometric}
                  className="min-h-[44px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  Disable Lock
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Encrypted Backup & Restore */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                AES-256-GCM Encrypted Backup
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Client-side PBKDF2 key derivation · Zero plaintext cloud exposure
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label
                htmlFor="backup-passphrase"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Export Passphrase
              </label>
              <input
                id="backup-passphrase"
                type="password"
                value={backupPassphrase}
                onChange={(e) => setBackupPassphrase(e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label
                htmlFor="restore-passphrase"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Restore Passphrase
              </label>
              <input
                id="restore-passphrase"
                type="password"
                value={restorePassphrase}
                onChange={(e) => setRestorePassphrase(e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-mono text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleDownloadEncryptedBackup}
              className="min-h-[44px] px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center gap-2"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Export .kora.enc Backup
            </button>

            <label className="min-h-[44px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>Restore from Backup</span>
              <input
                type="file"
                accept=".enc,.json"
                onChange={handleRestoreFile}
                className="sr-only"
              />
            </label>
          </div>

          {backupNotice && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              {backupNotice}
            </p>
          )}
        </div>

        {/* Real-Time Sync, Offline Queue & Push Notifications */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                {isOffline ? (
                  <WifiOff className="w-5 h-5 text-amber-600" aria-hidden="true" />
                ) : (
                  <Wifi className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                )}
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Real-Time Sync &amp; Push Alerts
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                  Last synced: {new Date(state.lastSyncedAt).toLocaleTimeString()} · {queuedCount} queued
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={onToggleOffline}
              className="min-h-[44px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
            >
              {isOffline ? 'Reconnect Online' : 'Simulate Offline Mode'}
            </button>

            <button
              type="button"
              onClick={onSyncNow}
              className="min-h-[44px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Sync Now
            </button>

            <button
              type="button"
              onClick={handleNotificationToggle}
              className="min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-2"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              {notifPermission === 'granted'
                ? 'Push Alerts Enabled'
                : 'Enable Low-Balance Push'}
            </button>
          </div>
        </div>

        {/* Anti-Spam & Fraud Rules Tester */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                Anti-Spam &amp; Fraud Rule Evaluator
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Tests rate-limits, duplicate templates, external links, and payment velocity
              </p>
            </div>
          </div>

          <form onSubmit={handleFraudTest} className="space-y-3">
            <label htmlFor="fraud-payload" className="sr-only">
              Sample message payload
            </label>
            <input
              id="fraud-payload"
              type="text"
              value={fraudTestText}
              onChange={(e) => setFraudTestText(e.target.value)}
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="min-h-[40px] px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold"
              >
                Evaluate Message Rule
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onEvaluateFraud({ topUpCountLastHour: 6, topUpUsdAmount: 650 })}
                className="min-h-[40px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Test Payment Velocity Anomaly
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Fraud Audit Log */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
          Fraud &amp; Anti-Spam Audit Log
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                <th className="py-2.5 pr-4 font-medium">Channel</th>
                <th className="py-2.5 pr-4 font-medium">Outcome</th>
                <th className="py-2.5 pr-4 font-medium">Rules Triggered</th>
                <th className="py-2.5 pr-4 font-medium">Payload Preview</th>
                <th className="py-2.5 text-right font-medium">Risk Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {state.fraudEvents.map((ev: FraudEventLog) => (
                <tr key={ev.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="py-3 pr-4 font-mono text-zinc-700 dark:text-zinc-300">
                    {ev.channel}
                  </td>
                  <td className="py-3 pr-4 font-semibold">
                    <span
                      className={
                        ev.allowed
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {ev.allowed ? 'Allowed' : 'Blocked'}
                    </span>
                  </td>
                  <td className="py-3 pr-4 font-mono text-zinc-600 dark:text-zinc-400">
                    {ev.triggeredRules.length > 0
                      ? ev.triggeredRules.map((r) => r.code).join(', ')
                      : 'PASS'}
                  </td>
                  <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300 max-w-xs truncate">
                    {ev.samplePayload}
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                    {ev.riskScore}/100
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
