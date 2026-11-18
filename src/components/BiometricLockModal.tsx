import { FormEvent, useState } from 'react';
import { Fingerprint, Lock } from 'lucide-react';
import { BiometricEnrollment, verifyBiometricUnlock } from '../utils/biometricAuth';

interface BiometricLockModalProps {
  userId: string;
  enrollment: BiometricEnrollment;
  onUnlocked: () => void;
}

export function BiometricLockModal({
  userId,
  enrollment,
  onUnlocked,
}: BiometricLockModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleWebAuthnPrompt = async () => {
    setError(null);
    setChecking(true);
    try {
      const res = await verifyBiometricUnlock(userId);
      if (res.ok) {
        onUnlocked();
      } else {
        setError(res.error ?? 'Biometric verification failed.');
      }
    } finally {
      setChecking(false);
    }
  };

  const handlePinUnlock = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setChecking(true);
    try {
      const res = await verifyBiometricUnlock(userId, pin);
      if (res.ok) {
        onUnlocked();
      } else {
        setError(res.error ?? 'Incorrect PIN.');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="biometric-lock-title"
      className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600">
            <Lock className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="biometric-lock-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Kora Session Locked
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Verify your biometric passkey or recovery PIN to access chats and wallet.
            </p>
          </div>
        </div>

        {enrollment.mode === 'webauthn' && (
          <button
            type="button"
            disabled={checking}
            onClick={handleWebAuthnPrompt}
            className="w-full min-h-[48px] px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Fingerprint className="w-5 h-5" aria-hidden="true" />
            Unlock with Device Biometrics
          </button>
        )}

        <form onSubmit={handlePinUnlock} className="space-y-3">
          <label
            htmlFor="unlock-pin-input"
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            Security PIN
          </label>
          <input
            id="unlock-pin-input"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter your recovery PIN"
            className="w-full min-h-[44px] px-3.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm font-mono text-zinc-900 dark:text-zinc-100"
          />
          {error && (
            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={checking || !pin.trim()}
            className="w-full min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-50"
          >
            Unlock Session
          </button>
        </form>
      </div>
    </div>
  );
}
