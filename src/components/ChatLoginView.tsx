import { FormEvent, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, KeyRound, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { PlatformState } from '../types/app';

interface ChatLoginViewProps {
  pendingMatchName?: string;
  onAuthenticated: (
    user: { id: string; email: string; name: string },
    nextState: PlatformState,
  ) => void;
}

export function ChatLoginView({ pendingMatchName, onAuthenticated }: ChatLoginViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login' ? { email, password } : { name, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        authenticated?: boolean;
        user?: { id: string; email: string; name: string };
        state?: PlatformState;
        error?: string;
      };

      if (!res.ok || !data.authenticated || !data.user || !data.state) {
        setError(data.error || 'Authentication failed. Check your credentials.');
        return;
      }

      onAuthenticated(data.user, data.state);
    } catch {
      setError('Unable to verify credentials right now. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoCredentials = () => {
    setMode('login');
    setEmail('onekalitkenneth@gmail.com');
    setPassword('KeroDate!2026');
    setError(null);
  };

  return (
    <section
      aria-label="Secure Chat Login"
      className="max-w-lg mx-auto py-4 sm:py-8"
      data-testid="chat-login-gate"
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {pendingMatchName
                ? `Sign in to chat with ${pendingMatchName}`
                : 'Secure Login for Chats'}
            </h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              {pendingMatchName
                ? `Unlock your 4 free outbound messages with ${pendingMatchName} inside an authenticated session.`
                : 'Private conversations are redacted on the server until you verify your account.'}
            </p>
          </div>
        </div>

        <div className="px-6 pt-5">
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="grid grid-cols-2 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                mode === 'login'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                mode === 'register'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label
                htmlFor="chat-auth-name"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
              >
                Display Name
              </label>
              <input
                id="chat-auth-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-600/40"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="chat-auth-email"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Email Address
            </label>
            <input
              id="chat-auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-600/40"
            />
          </div>

          <div>
            <label
              htmlFor="chat-auth-password"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="chat-auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === 'register'
                    ? 'At least 8 characters with letters & numbers'
                    : 'Enter your chat password'
                }
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full min-h-[44px] pl-3.5 pr-11 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-600/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              data-testid="chat-auth-error"
              className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2 font-medium"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            data-testid="chat-auth-submit"
            className="w-full min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {mode === 'login' ? (
              <>
                <KeyRound className="w-4 h-4" aria-hidden="true" />
                <span>{submitting ? 'Verifying...' : 'Sign In to Chats'}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>{submitting ? 'Creating Account...' : 'Create Account & Open Chats'}</span>
              </>
            )}
          </button>

          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">Demo member:</span>{' '}
              <span className="font-mono">onekalitkenneth@gmail.com</span> ·{' '}
              <span className="font-mono">KeroDate!2026</span>
            </div>
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="min-h-[36px] px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium whitespace-nowrap self-start sm:self-auto"
            >
              Fill Demo Credentials
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>
              scrypt password hashing · HttpOnly HMAC-SHA256 session cookie · 5-attempt rate limit
            </span>
          </div>
        </form>
      </div>
    </section>
  );
}
