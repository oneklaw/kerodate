# Kora Monetized Dating Platform — Deployment & Operations Guide

## 1. System Architecture
Kora pairs a Laravel 11 API + Blade/Tailwind administrative and checkout layer with a cross-platform React / React Native client:
- **Free Core Discovery**: Browsing, matching, liking, and starting new conversations are 100% free.
- **4 Free Messages Per New Chat**: Every new conversation tracks `initiator_free_messages_used` and `recipient_free_messages_used` (up to 4 outbound messages free per user per chat).
- **Coin Economy**: `$1.00 USD = 100 coins = 100 messages` (`1 coin/message` after the 4 free messages). Users can purchase any custom amount via the top-up slider.
- **Payment Rails & Webhooks**: Flutterwave (`verif-hash` verification) and MTN MoMo (`X-Momo-Signature` HMAC-SHA256 verification) with idempotent ledger crediting and atomic row locking (`lockForUpdate()`).
- **Anti-Spam & Fraud Engine**: Velocity rate-limiting (6 msgs/60s), duplicate message template detection, external phishing/solicitation regex rules, and payment velocity checks.
- **Security & Continuity**: Biometric WebAuthn / Expo LocalAuthentication lock, AES-256-GCM PBKDF2 encrypted backups, real-time SSE/Reverb sync, low-balance push notifications (`<= 15 coins`), and offline message queuing.

## 2. Laravel Backend Setup
```bash
cd laravel
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --force
```

### Required Environment Variables
```env
APP_URL=https://api.kora.example.com
DB_CONNECTION=pgsql
REDIS_HOST=127.0.0.1

FLW_SECRET_KEY=FLWSECK_TEST-...
FLW_WEBHOOK_HASH=your_flutterwave_verif_hash

MTN_MOMO_ENV=production
MTN_MOMO_BASE_URL=https://proxy.momoapi.mtn.com
MTN_MOMO_SUBSCRIPTION_KEY=your_ocp_apim_key
MTN_MOMO_WEBHOOK_SECRET=your_momo_hmac_secret

BROADCAST_CONNECTION=reverb
```

### Real-Time Queue & WebSockets
Run Laravel Reverb and queue workers via Supervisor:
```bash
php artisan reverb:start --host=0.0.0.0 --port=8080
php artisan queue:work redis --tries=3 --backoff=5
```

## 3. Webhook Security Checklist
1. Always register `POST /api/webhooks/flutterwave` and `POST /api/webhooks/mtn-momo` over TLS 1.3.
2. Verify signatures with `hash_equals()` before mutating wallet state.
3. Enforce unique `idempotency_key` on `wallet_transactions` to prevent double-crediting on gateway retries.

## 4. React Native Mobile Build (Expo / EAS)
```bash
cd react-native
npm install
npx expo prebuild
eas build --platform all --profile production
```
Ensure `NSFaceIDUsageDescription` (iOS) and `USE_BIOMETRIC` (Android) are declared in `app.json` for biometric wallet lock.
