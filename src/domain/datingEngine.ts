export const COINS_PER_USD = 100;
export const FREE_MESSAGES_PER_CHAT = 4;
export const MESSAGE_COST_COINS = 1;
export const LOW_BALANCE_THRESHOLD = 15;
export const MIN_TOPUP_USD = 1;

export type PaymentProvider = 'flutterwave' | 'mtn_momo';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'flagged';
export type TransactionType = 'top_up' | 'message_spend' | 'free_grant' | 'refund';

export interface Profile {
  id: string;
  name: string;
  age: number;
  city: string;
  occupation: string;
  bio: string;
  interests: string[];
  imageUrl: string;
  verified: boolean;
  lastActive: string;
  distanceKm: number;
  liked?: boolean;
}

export interface ChatMessage {
  id: string;
  clientTempId?: string;
  chatId: string;
  sender: 'me' | 'match';
  text: string;
  createdAt: string;
  isFreeMessage: boolean;
  coinsCharged: number;
  syncStatus: 'synced' | 'queued';
}

export interface Conversation {
  id: string;
  matchId: string;
  freeMessagesUsed: number;
  totalMessagesSent: number;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface WalletTransaction {
  id: string;
  reference: string;
  type: TransactionType;
  provider?: PaymentProvider;
  usdAmount: number;
  coinsDelta: number;
  balanceAfter: number;
  status: TransactionStatus;
  description: string;
  createdAt: string;
  webhookVerified?: boolean;
  phoneOrMaskedAccount?: string;
}

export interface FraudRuleHit {
  code: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  points: number;
}

export interface FraudEventLog {
  id: string;
  actor: string;
  channel: 'chat' | 'payment' | 'webhook';
  allowed: boolean;
  riskScore: number;
  triggeredRules: FraudRuleHit[];
  samplePayload: string;
  createdAt: string;
}

export interface MessageChargeDecision {
  allowed: boolean;
  isFree: boolean;
  coinsCharged: number;
  freeRemainingAfter: number;
  newBalance: number;
  lowBalanceAlert: boolean;
  reason?: string;
}

export interface AntiSpamInput {
  text?: string;
  recentTimestampsMs?: number[];
  recentMessageHashes?: string[];
  nowMs?: number;
  topUpCountLastHour?: number;
  topUpUsdAmount?: number;
}

export interface AntiSpamEvaluation {
  allowed: boolean;
  requiresReview: boolean;
  riskScore: number;
  messageHash: string;
  triggeredRules: FraudRuleHit[];
}

export function calculateCoinsForUsd(usdAmount: number): number {
  if (!Number.isFinite(usdAmount) || usdAmount < MIN_TOPUP_USD) {
    return 0;
  }
  return Math.round(usdAmount * COINS_PER_USD);
}

export function calculateUsdForCoins(coins: number): number {
  if (!Number.isFinite(coins) || coins <= 0) {
    return 0;
  }
  return Number((coins / COINS_PER_USD).toFixed(2));
}

export function evaluateMessageCharge(
  freeMessagesUsed: number,
  currentBalance: number,
): MessageChargeDecision {
  const safeUsed = Math.max(0, Math.floor(freeMessagesUsed));
  const safeBalance = Math.max(0, Math.floor(currentBalance));

  if (safeUsed < FREE_MESSAGES_PER_CHAT) {
    const freeRemainingAfter = FREE_MESSAGES_PER_CHAT - (safeUsed + 1);
    return {
      allowed: true,
      isFree: true,
      coinsCharged: 0,
      freeRemainingAfter,
      newBalance: safeBalance,
      lowBalanceAlert: false,
    };
  }

  if (safeBalance < MESSAGE_COST_COINS) {
    return {
      allowed: false,
      isFree: false,
      coinsCharged: 0,
      freeRemainingAfter: 0,
      newBalance: safeBalance,
      lowBalanceAlert: true,
      reason: 'Free messages used in this chat. Top up $1 for 100 coins to continue.',
    };
  }

  const newBalance = safeBalance - MESSAGE_COST_COINS;
  return {
    allowed: true,
    isFree: false,
    coinsCharged: MESSAGE_COST_COINS,
    freeRemainingAfter: 0,
    newBalance,
    lowBalanceAlert: newBalance <= LOW_BALANCE_THRESHOLD,
  };
}

export function normalizeMessageHash(text: string): string {
  const cleaned = text.trim().toLowerCase().replace(/\s+/g, ' ');
  let hash = 2166136261;
  for (let i = 0; i < cleaned.length; i += 1) {
    hash ^= cleaned.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function evaluateAntiSpamAndFraud(input: AntiSpamInput): AntiSpamEvaluation {
  const triggeredRules: FraudRuleHit[] = [];
  let riskScore = 0;
  const nowMs = input.nowMs ?? Date.now();
  const text = (input.text ?? '').trim();
  const messageHash = text ? normalizeMessageHash(text) : '';

  if (input.text !== undefined) {
    if (text.length === 0) {
      triggeredRules.push({
        code: 'EMPTY_PAYLOAD',
        severity: 'medium',
        message: 'Message cannot be empty.',
        points: 40,
      });
      riskScore += 40;
    } else if (text.length > 1000) {
      triggeredRules.push({
        code: 'OVERSIZED_MESSAGE',
        severity: 'medium',
        message: 'Message exceeds 1,000 character anti-flood limit.',
        points: 45,
      });
      riskScore += 45;
    }

    if (/(.)\1{9,}/i.test(text)) {
      triggeredRules.push({
        code: 'CHARACTER_FLOOD',
        severity: 'medium',
        message: 'Repeated character flooding detected.',
        points: 40,
      });
      riskScore += 40;
    }

    const recentInWindow = (input.recentTimestampsMs ?? []).filter(
      (ts) => nowMs - ts <= 60_000 && ts <= nowMs + 5_000,
    );
    if (recentInWindow.length >= 8) {
      triggeredRules.push({
        code: 'RATE_LIMIT_BURST',
        severity: 'high',
        message: 'Velocity threshold exceeded (8+ messages within 60 seconds).',
        points: 55,
      });
      riskScore += 55;
    }

    const duplicateCount = (input.recentMessageHashes ?? []).filter(
      (h) => h === messageHash,
    ).length;
    if (messageHash && duplicateCount >= 2) {
      triggeredRules.push({
        code: 'DUPLICATE_SPAM_TEMPLATE',
        severity: 'high',
        message: 'Identical copy-paste solicitation detected across messages.',
        points: 55,
      });
      riskScore += 55;
    }

    const spamLinkPattern =
      /(https?:\/\/\S+|t\.me\/\S+|wa\.me\/\S+|bit\.ly\/\S+|tinyurl\.com\/\S+)/i;
    const scamPhrasePattern =
      /\b(crypto|usdt|bitcoin|wire transfer|cashapp|venmo|western union|send money|whatsapp me|telegram me|sugar daddy|gift card)\b/i;

    if (spamLinkPattern.test(text) || scamPhrasePattern.test(text)) {
      triggeredRules.push({
        code: 'EXTERNAL_SOLICITATION_OR_PHISHING',
        severity: 'high',
        message: 'External redirect link or financial solicitation pattern blocked.',
        points: 65,
      });
      riskScore += 65;
    }
  }

  if (input.topUpCountLastHour !== undefined && input.topUpCountLastHour >= 5) {
    triggeredRules.push({
      code: 'PAYMENT_VELOCITY_SPIKE',
      severity: 'high',
      message: '5+ top-up attempts inside 60 minutes flagged for velocity control.',
      points: 60,
    });
    riskScore += 60;
  }

  if (input.topUpUsdAmount !== undefined && input.topUpUsdAmount > 500) {
    triggeredRules.push({
      code: 'HIGH_VALUE_TOPUP_REVIEW',
      severity: 'medium',
      message: 'Top-up above $500 requires enhanced risk verification.',
      points: 35,
    });
    riskScore += 35;
  }

  const clampedScore = Math.min(100, riskScore);
  const hasHigh = triggeredRules.some((r) => r.severity === 'high');
  const allowed = !hasHigh && clampedScore < 40;
  const requiresReview = !allowed || clampedScore >= 30;

  return {
    allowed,
    requiresReview,
    riskScore: clampedScore,
    messageHash,
    triggeredRules,
  };
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
