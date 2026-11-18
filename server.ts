import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import {
  calculateCoinsForUsd,
  ChatMessage,
  Conversation,
  evaluateAntiSpamAndFraud,
  evaluateMessageCharge,
  FraudEventLog,
  LOW_BALANCE_THRESHOLD,
  MIN_TOPUP_USD,
  normalizeMessageHash,
  PaymentProvider,
  Profile,
  WalletTransaction,
} from './src/domain/datingEngine.ts';
import {
  calculateHaversineKm,
  DEFAULT_AUTO_CHAT_RADIUS_KM,
  GeoPoint,
  HUB_LOCATIONS,
  syncNearbyProfilesToConversations,
} from './src/domain/nearbyLocator.ts';
import { signWebhookPayload, verifyWebhookSignature } from './src/domain/webhookCrypto.ts';
import {
  ChatSessionClaims,
  hashPassword,
  signChatSessionToken,
  validatePasswordStrength,
  verifyChatSessionToken,
  verifyPassword,
} from './src/domain/chatAuth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const FLW_WEBHOOK_SECRET = process.env.FLW_WEBHOOK_SECRET || 'kora_flw_webhook_secret_2026';
const MOMO_WEBHOOK_SECRET = process.env.MOMO_WEBHOOK_SECRET || 'kora_momo_hmac_secret_2026';
const CHAT_SESSION_SECRET = process.env.CHAT_SESSION_SECRET || 'kero_chat_session_secret_2026';
const CHAT_COOKIE_NAME = 'kero_chat_session';
const DATA_FILE = path.join(__dirname, '.kora-store.json');

interface AuthAccount {
  userId: string;
  email: string;
  name: string;
  passwordHash: string;
}

interface PlatformState {
  user: {
    id: string;
    name: string;
    email: string;
    city: string;
    lowBalanceThreshold: number;
    location: GeoPoint;
  };
  wallet: {
    coinBalance: number;
    lifetimePurchased: number;
    lifetimeSpent: number;
  };
  profiles: Profile[];
  conversations: Conversation[];
  transactions: WalletTransaction[];
  fraudEvents: FraudEventLog[];
  authAccounts?: AuthAccount[];
  lastSyncedAt: string;
}

function createInitialState(): PlatformState {
  const now = Date.now();
  const iso = (offsetMinutes: number) => new Date(now - offsetMinutes * 60_000).toISOString();

  const initial: PlatformState = {
    user: {
      id: 'usr_kora_01',
      name: 'Kenneth',
      email: 'onekalitkenneth@gmail.com',
      city: 'Kampala · London',
      lowBalanceThreshold: LOW_BALANCE_THRESHOLD,
      location: { ...HUB_LOCATIONS.kampala },
    },
    authAccounts: [
      {
        userId: 'usr_kora_01',
        email: 'onekalitkenneth@gmail.com',
        name: 'Kenneth',
        passwordHash: hashPassword('KeroDate!2026'),
      },
    ],
    wallet: {
      coinBalance: 18,
      lifetimePurchased: 100,
      lifetimeSpent: 82,
    },
    profiles: [
      {
        id: 'prof_amara',
        name: 'Amara',
        age: 27,
        city: 'Kampala',
        occupation: 'Product Architect',
        bio: 'Design systems, slow pour-over coffee, and Saturday morning gallery walks.',
        interests: ['Architecture', 'Specialty Coffee', 'Jazz'],
        imageUrl: '/src/assets/images/profile_amara_1794994398125.jpg',
        verified: true,
        lastActive: 'Online now',
        lastActiveMinutes: 0,
        onlineStatus: 'online',
        lat: 0.3595,
        lng: 32.5935,
        distanceKm: 1.8,
        liked: true,
      },
      {
        id: 'prof_nadia',
        name: 'Nadia',
        age: 28,
        city: 'Kampala',
        occupation: 'Industrial Designer',
        bio: 'Ceramics, espresso on quiet terraces, and weekend train trips to the coast.',
        interests: ['Ceramics', 'Espresso', 'Travel'],
        imageUrl: '/src/assets/images/profile_nadia_1794994398255.jpg',
        verified: true,
        lastActive: 'Online now',
        lastActiveMinutes: 0,
        onlineStatus: 'online',
        lat: 0.3321,
        lng: 32.6004,
        distanceKm: 2.6,
        liked: false,
      },
      {
        id: 'prof_julian',
        name: 'Julian',
        age: 31,
        city: 'Kampala',
        occupation: 'Curator & Writer',
        bio: 'Contemporary sculpture curator looking for someone who enjoys long museum afternoons.',
        interests: ['Sculpture', 'Film', 'Cycling'],
        imageUrl: '/src/assets/images/profile_julian_1794994399452.jpg',
        verified: true,
        lastActive: 'Online now',
        lastActiveMinutes: 1,
        onlineStatus: 'online',
        lat: 0.3692,
        lng: 32.5512,
        distanceKm: 4.2,
        liked: true,
      },
      {
        id: 'prof_david',
        name: 'David',
        age: 32,
        city: 'Kampala',
        occupation: 'Botanical Photographer',
        bio: 'Documenting urban greenhouses and cooking West African comfort food on Sundays.',
        interests: ['Botany', '35mm Film', 'Cooking'],
        imageUrl: '/src/assets/images/profile_david_1794994398521.jpg',
        verified: true,
        lastActive: 'Active 14m ago',
        lastActiveMinutes: 14,
        onlineStatus: 'away',
        lat: 0.2951,
        lng: 32.6202,
        distanceKm: 7.2,
        liked: false,
      },
      {
        id: 'prof_elena',
        name: 'Elena',
        age: 29,
        city: 'Entebbe',
        occupation: 'Editorial Bookbinder',
        bio: 'Independent bookstores, Scandinavian timber furniture, and quiet evening walks.',
        interests: ['Typography', 'Bookshops', 'Rowing'],
        imageUrl: '/src/assets/images/profile_elena_1794994399857.jpg',
        verified: true,
        lastActive: 'Active 38m ago',
        lastActiveMinutes: 38,
        onlineStatus: 'away',
        lat: 0.2385,
        lng: 32.5194,
        distanceKm: 14.0,
        liked: false,
      },
    ],
    conversations: [
      {
        id: 'chat_amara',
        matchId: 'prof_amara',
        freeMessagesUsed: 2,
        totalMessagesSent: 2,
        updatedAt: iso(18),
        messages: [
          {
            id: 'msg_1',
            chatId: 'chat_amara',
            sender: 'me',
            text: 'Your weekend gallery spot looks peaceful — which exhibition caught your eye?',
            createdAt: iso(24),
            isFreeMessage: true,
            coinsCharged: 0,
            syncStatus: 'synced',
          },
          {
            id: 'msg_2',
            chatId: 'chat_amara',
            sender: 'match',
            text: 'The East African brutalism retrospective! Are you free for coffee near Kololo this week?',
            createdAt: iso(21),
            isFreeMessage: false,
            coinsCharged: 0,
            syncStatus: 'synced',
          },
          {
            id: 'msg_3',
            chatId: 'chat_amara',
            sender: 'me',
            text: 'Thursday afternoon works great for me. Same corner roastery?',
            createdAt: iso(18),
            isFreeMessage: true,
            coinsCharged: 0,
            syncStatus: 'synced',
          },
        ],
      },
      {
        id: 'chat_julian',
        matchId: 'prof_julian',
        freeMessagesUsed: 0,
        totalMessagesSent: 0,
        updatedAt: iso(60),
        messages: [
          {
            id: 'msg_4',
            chatId: 'chat_julian',
            sender: 'match',
            text: 'Matched with you after seeing your note on architectural photography. Say hello!',
            createdAt: iso(60),
            isFreeMessage: false,
            coinsCharged: 0,
            syncStatus: 'synced',
          },
        ],
      },
    ],
    transactions: [
      {
        id: 'tx_seed_1',
        reference: 'FLW-904182',
        type: 'top_up',
        provider: 'flutterwave',
        usdAmount: 1.0,
        coinsDelta: 100,
        balanceAfter: 100,
        status: 'completed',
        description: 'Flutterwave Card Top-Up ($1.00 = 100 coins)',
        createdAt: iso(420),
        webhookVerified: true,
        phoneOrMaskedAccount: 'Visa •••• 4242',
      },
      {
        id: 'tx_seed_2',
        reference: 'MSG-882104',
        type: 'message_spend',
        usdAmount: 0.82,
        coinsDelta: -82,
        balanceAfter: 18,
        status: 'completed',
        description: 'Previous metered conversations (82 paid messages)',
        createdAt: iso(120),
      },
    ],
    fraudEvents: [
      {
        id: 'frd_seed_1',
        actor: 'guest_9912',
        channel: 'chat',
        allowed: false,
        riskScore: 65,
        triggeredRules: [
          {
            code: 'EXTERNAL_SOLICITATION_OR_PHISHING',
            severity: 'high',
            message: 'External redirect link or financial solicitation pattern blocked.',
            points: 65,
          },
        ],
        samplePayload: 'Add me on telegram https://t.me/fast_usdt_promo',
        createdAt: iso(95),
      },
    ],
    lastSyncedAt: new Date().toISOString(),
  };

  const synced = syncNearbyProfilesToConversations(
    initial.profiles,
    initial.conversations,
    initial.user.location,
    { maxRadiusKm: DEFAULT_AUTO_CHAT_RADIUS_KM, onlineOnly: false },
  );
  initial.conversations = synced.conversations;
  return initial;
}

function loadState(): PlatformState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw) as PlatformState;
      let dirty = false;
      if (!Array.isArray(parsed.authAccounts) || parsed.authAccounts.length === 0) {
        parsed.authAccounts = [
          {
            userId: parsed.user?.id || 'usr_kora_01',
            email: (parsed.user?.email || 'onekalitkenneth@gmail.com').toLowerCase(),
            name: parsed.user?.name || 'Kenneth',
            passwordHash: hashPassword('KeroDate!2026'),
          },
        ];
        dirty = true;
      }
      const synced = syncNearbyProfilesToConversations(
        parsed.profiles || [],
        parsed.conversations || [],
        parsed.user?.location ?? HUB_LOCATIONS.kampala,
        { maxRadiusKm: DEFAULT_AUTO_CHAT_RADIUS_KM, onlineOnly: false },
      );
      if (synced.addedMatchIds.length > 0) {
        parsed.conversations = synced.conversations;
        dirty = true;
      }
      if (dirty) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2));
      }
      return parsed;
    }
  } catch {
    // Fall back to fresh initial state if file is unreadable
  }
  const initial = createInitialState();
  fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  return initial;
}

let state: PlatformState = loadState();
const sseClients = new Set<{ res: express.Response; req: express.Request }>();
const loginFailures = new Map<string, number[]>();

function parseCookies(req: express.Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

function getChatSessionClaims(req: express.Request): ChatSessionClaims | null {
  const authHeader = req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const claims = verifyChatSessionToken(token, CHAT_SESSION_SECRET);
    if (claims) return claims;
  }
  const cookies = parseCookies(req);
  return verifyChatSessionToken(cookies[CHAT_COOKIE_NAME], CHAT_SESSION_SECRET);
}

function setChatSessionCookie(res: express.Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    `${CHAT_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`,
  );
}

function clearChatSessionCookie(res: express.Response) {
  res.setHeader(
    'Set-Cookie',
    `${CHAT_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  );
}

function serializeClientState(authenticated: boolean) {
  const { authAccounts: _omit, ...publicState } = state;
  if (authenticated) {
    return publicState;
  }
  return {
    ...publicState,
    conversations: publicState.conversations.map((conv) => ({
      ...conv,
      messages: [],
    })),
  };
}

function persistState() {
  state.lastSyncedAt = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function broadcastEvent(
  event: string,
  buildPayload: (authenticated: boolean) => Record<string, unknown>,
) {
  for (const client of sseClients) {
    const authed = Boolean(getChatSessionClaims(client.req));
    const data = buildPayload(authed);
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

const MATCH_REPLIES: Record<string, string[]> = {
  prof_amara: [
    'Count me in for Thursday at 4pm! I will bring that architecture monograph.',
    'Perfect — see you at the courtyard table by the window.',
    'Also just realized we both follow the same jazz quartet.',
  ],
  prof_julian: [
    'So glad you wrote! Have you visited the new concrete pavilion yet?',
    'That sounds lovely — I am usually around Soho on Fridays.',
    'Let us compare our favorite 35mm film stocks over tea.',
  ],
  prof_nadia: [
    'Ciao! Thank you for reaching out — espresso on a sunny terrace sounds ideal.',
    'I am sketching a new stoneware mug series this afternoon.',
    'Would love to hear what brought you to Kora!',
  ],
  prof_david: [
    'Hey! Great to connect. Just came back from photographing the palm conservatory.',
    'Wait until you try my Sunday jollof recipe.',
    'What camera lens do you shoot with most often?',
  ],
  prof_elena: [
    'Hello! Always happy to trade independent bookshop recommendations.',
    'Have you read anything unforgettable lately?',
    'A walk along the canal with warm pastries sounds great.',
  ],
};

function scheduleMatchReply(chatId: string, matchId: string) {
  setTimeout(() => {
    const conv = state.conversations.find((c) => c.id === chatId);
    if (!conv) return;
    const pool = MATCH_REPLIES[matchId] ?? ['Thanks for your message! Tell me more.'];
    const replyIndex = conv.messages.filter((m) => m.sender === 'match').length % pool.length;
    const reply: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      chatId,
      sender: 'match',
      text: pool[replyIndex],
      createdAt: new Date().toISOString(),
      isFreeMessage: false,
      coinsCharged: 0,
      syncStatus: 'synced',
    };
    conv.messages.push(reply);
    conv.updatedAt = reply.createdAt;
    persistState();
    broadcastEvent('message_received', (authed) => ({
      authenticated: authed,
      chatId,
      message: authed ? reply : undefined,
      state: serializeClientState(authed),
    }));
  }, 900);
}

function processMessageSend(chatId: string, text: string, clientTempId?: string) {
  const conv = state.conversations.find((c) => c.id === chatId);
  if (!conv) {
    return { status: 404, body: { error: 'Conversation not found.' } };
  }

  if (clientTempId && conv.messages.some((m) => m.clientTempId === clientTempId)) {
    return {
      status: 200,
      body: { deduplicated: true, state: serializeClientState(true) },
    };
  }

  const nowMs = Date.now();
  const outboundMessages = state.conversations
    .flatMap((c) => c.messages)
    .filter((m) => m.sender === 'me');

  const recentTimestampsMs = outboundMessages
    .map((m) => Date.parse(m.createdAt))
    .filter((t) => nowMs - t <= 60_000);

  const recentMessageHashes = outboundMessages
    .slice(-15)
    .map((m) => normalizeMessageHash(m.text));

  const spamCheck = evaluateAntiSpamAndFraud({
    text,
    recentTimestampsMs,
    recentMessageHashes,
    nowMs,
  });

  if (!spamCheck.allowed) {
    const fraudEntry: FraudEventLog = {
      id: `frd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      actor: state.user.email,
      channel: 'chat',
      allowed: false,
      riskScore: spamCheck.riskScore,
      triggeredRules: spamCheck.triggeredRules,
      samplePayload: text.slice(0, 140),
      createdAt: new Date().toISOString(),
    };
    state.fraudEvents.unshift(fraudEntry);
    state.fraudEvents = state.fraudEvents.slice(0, 30);
    persistState();
    broadcastEvent('fraud_triggered', (authed) => ({
      fraudEntry,
      state: serializeClientState(authed),
    }));
    return {
      status: 422,
      body: {
        error: spamCheck.triggeredRules[0]?.message || 'Blocked by anti-spam protection.',
        fraudEvaluation: spamCheck,
        state: serializeClientState(true),
      },
    };
  }

  const charge = evaluateMessageCharge(conv.freeMessagesUsed, state.wallet.coinBalance);
  if (!charge.allowed) {
    return {
      status: 402,
      body: {
        error: charge.reason || 'Insufficient coins.',
        charge,
        state: serializeClientState(true),
      },
    };
  }

  if (charge.isFree) {
    conv.freeMessagesUsed += 1;
  } else {
    state.wallet.coinBalance = charge.newBalance;
    state.wallet.lifetimeSpent += charge.coinsCharged;
    const matchName =
      state.profiles.find((p) => p.id === conv.matchId)?.name ?? 'Match';
    state.transactions.unshift({
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      reference: `MSG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      type: 'message_spend',
      usdAmount: 0.01,
      coinsDelta: -charge.coinsCharged,
      balanceAfter: state.wallet.coinBalance,
      status: 'completed',
      description: `Message to ${matchName}`,
      createdAt: new Date().toISOString(),
    });
  }

  conv.totalMessagesSent += 1;
  const newMsg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    clientTempId,
    chatId,
    sender: 'me',
    text: text.trim(),
    createdAt: new Date().toISOString(),
    isFreeMessage: charge.isFree,
    coinsCharged: charge.coinsCharged,
    syncStatus: 'synced',
  };
  conv.messages.push(newMsg);
  conv.updatedAt = newMsg.createdAt;
  persistState();

  broadcastEvent('balance_updated', (authed) => ({
    authenticated: authed,
    coinBalance: state.wallet.coinBalance,
    lowBalanceAlert: charge.lowBalanceAlert,
    state: serializeClientState(authed),
  }));

  scheduleMatchReply(conv.id, conv.matchId);

  return {
    status: 201,
    body: {
      message: newMsg,
      charge,
      state: serializeClientState(true),
    },
  };
}

function processVerifiedWebhook(
  provider: PaymentProvider,
  reference: string,
  rawPayload: string,
  providedSig: string | undefined,
  secret: string,
) {
  const isValid =
    provider === 'flutterwave'
      ? providedSig === secret || verifyWebhookSignature(rawPayload, providedSig, secret)
      : verifyWebhookSignature(rawPayload, providedSig, secret);

  if (!isValid) {
    const fraudEntry: FraudEventLog = {
      id: `frd_${Date.now()}`,
      actor: `${provider}_webhook`,
      channel: 'webhook',
      allowed: false,
      riskScore: 95,
      triggeredRules: [
        {
          code: provider === 'flutterwave' ? 'INVALID_FLW_SIGNATURE' : 'INVALID_MOMO_SIGNATURE',
          severity: 'high',
          message: 'Webhook HMAC signature verification failed.',
          points: 95,
        },
      ],
      samplePayload: `ref=${reference}`,
      createdAt: new Date().toISOString(),
    };
    state.fraudEvents.unshift(fraudEntry);
    persistState();
    broadcastEvent('fraud_triggered', (authed) => ({
      fraudEntry,
      state: serializeClientState(authed),
    }));
    return { status: 401, body: { error: 'Invalid webhook signature.' } };
  }

  const tx = state.transactions.find((t) => t.reference === reference);
  if (!tx) {
    return { status: 404, body: { error: 'Transaction reference not found.' } };
  }

  if (tx.status === 'completed') {
    return { status: 200, body: { idempotent: true, tx, state: serializeClientState(false) } };
  }

  state.wallet.coinBalance += tx.coinsDelta;
  state.wallet.lifetimePurchased += tx.coinsDelta;
  tx.status = 'completed';
  tx.balanceAfter = state.wallet.coinBalance;
  tx.webhookVerified = true;
  persistState();

  broadcastEvent('balance_updated', (authed) => ({
    authenticated: authed,
    coinBalance: state.wallet.coinBalance,
    lowBalanceAlert: state.wallet.coinBalance <= LOW_BALANCE_THRESHOLD,
    creditedCoins: tx.coinsDelta,
    reference: tx.reference,
    provider,
    state: serializeClientState(authed),
  }));

  return {
    status: 200,
    body: {
      credited: true,
      tx,
      state: serializeClientState(false),
    },
  };
}

function readBlueprintsFromDisk() {
  const dirs = [
    { root: 'laravel', category: 'Laravel PHP' },
    { root: 'react-native', category: 'React Native' },
    { root: 'docs', category: 'Documentation' },
  ];
  const files: Array<{ path: string; category: string; language: string; content: string }> = [];

  function walk(absDir: string, relPrefix: string, category: string) {
    if (!fs.existsSync(absDir)) return;
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const fullPath = path.join(absDir, entry.name);
      const relPath = `${relPrefix}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(fullPath, relPath, category);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        const language =
          ext === '.php'
            ? entry.name.endsWith('.blade.php')
              ? 'blade'
              : 'php'
            : ext === '.md'
              ? 'markdown'
              : 'typescript';
        files.push({
          path: relPath,
          category,
          language,
          content: fs.readFileSync(fullPath, 'utf8'),
        });
      }
    }
  }

  for (const d of dirs) {
    walk(path.join(__dirname, d.root), d.root, d.category);
  }
  return files;
}

async function startServer() {
  const app = express();
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    }),
  );

  app.get('/api/auth/session', (req, res) => {
    const claims = getChatSessionClaims(req);
    if (!claims) {
      res.json({ authenticated: false });
      return;
    }
    const account = state.authAccounts?.find((a) => a.userId === claims.userId);
    res.json({
      authenticated: true,
      user: {
        id: claims.userId,
        email: claims.email,
        name: account?.name || state.user.name,
      },
      expiresAt: new Date(claims.exp).toISOString(),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const nowMs = Date.now();
    const recentFailures = (loginFailures.get(normalizedEmail) || []).filter(
      (ts) => nowMs - ts <= 60_000,
    );
    if (recentFailures.length >= 5) {
      res.status(429).json({
        error: 'Too many failed login attempts. Please wait 60 seconds and try again.',
      });
      return;
    }

    const account = state.authAccounts?.find(
      (a) => a.email.toLowerCase() === normalizedEmail,
    );
    if (!account || !verifyPassword(password, account.passwordHash)) {
      recentFailures.push(nowMs);
      loginFailures.set(normalizedEmail, recentFailures);
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    loginFailures.delete(normalizedEmail);
    state.user.email = account.email;
    state.user.name = account.name;
    const syncedLogin = syncNearbyProfilesToConversations(
      state.profiles,
      state.conversations,
      state.user.location ?? HUB_LOCATIONS.kampala,
      { maxRadiusKm: DEFAULT_AUTO_CHAT_RADIUS_KM, onlineOnly: false },
    );
    state.conversations = syncedLogin.conversations;
    persistState();

    const token = signChatSessionToken(
      { userId: account.userId, email: account.email },
      CHAT_SESSION_SECRET,
    );
    setChatSessionCookie(res, token);
    res.json({
      authenticated: true,
      user: { id: account.userId, email: account.email, name: account.name },
      state: serializeClientState(true),
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };
    const trimmedName = (name || '').trim();
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (trimmedName.length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ error: 'Enter a valid email address.' });
      return;
    }
    const strength = validatePasswordStrength(password || '');
    if (!strength.valid) {
      res.status(400).json({ error: strength.error });
      return;
    }

    const exists = state.authAccounts?.some(
      (a) => a.email.toLowerCase() === normalizedEmail,
    );
    if (exists) {
      res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
      return;
    }

    const newAccount: AuthAccount = {
      userId: `usr_${Date.now().toString(36)}`,
      email: normalizedEmail,
      name: trimmedName,
      passwordHash: hashPassword(password!),
    };
    state.authAccounts = [...(state.authAccounts || []), newAccount];
    state.user.id = newAccount.userId;
    state.user.email = newAccount.email;
    state.user.name = newAccount.name;
    const syncedReg = syncNearbyProfilesToConversations(
      state.profiles,
      state.conversations,
      state.user.location ?? HUB_LOCATIONS.kampala,
      { maxRadiusKm: DEFAULT_AUTO_CHAT_RADIUS_KM, onlineOnly: false },
    );
    state.conversations = syncedReg.conversations;
    persistState();

    const token = signChatSessionToken(
      { userId: newAccount.userId, email: newAccount.email },
      CHAT_SESSION_SECRET,
    );
    setChatSessionCookie(res, token);
    res.status(201).json({
      authenticated: true,
      user: { id: newAccount.userId, email: newAccount.email, name: newAccount.name },
      state: serializeClientState(true),
    });
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearChatSessionCookie(res);
    res.json({
      authenticated: false,
      state: serializeClientState(false),
    });
  });

  app.get('/api/bootstrap', (req, res) => {
    const authenticated = Boolean(getChatSessionClaims(req));
    res.json(serializeClientState(authenticated));
  });

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    const client = { res, req };
    sseClients.add(client);
    req.on('close', () => {
      sseClients.delete(client);
    });
  });

  app.post('/api/profiles/:id/like', (req, res) => {
    const profile = state.profiles.find((p) => p.id === req.params.id);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }
    profile.liked = !profile.liked;
    persistState();
    res.json({ profile, state: serializeClientState(Boolean(getChatSessionClaims(req))) });
  });

  app.post('/api/location/update', (req, res) => {
    const { lat, lng, label } = req.body as {
      lat?: number;
      lng?: number;
      label?: string;
    };
    const nextLat = Number(lat);
    const nextLng = Number(lng);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
      res.status(400).json({ error: 'Valid latitude and longitude are required.' });
      return;
    }

    const prevOrigin = state.user.location ?? HUB_LOCATIONS.kampala;
    const dLat = nextLat - prevOrigin.lat;
    const dLng = nextLng - prevOrigin.lng;
    const nextOrigin: GeoPoint = {
      lat: nextLat,
      lng: nextLng,
      label: label?.trim() || 'Live GPS Position',
    };

    // Preserve realistic local distances when switching city hubs or GPS origin
    const movedFar = calculateHaversineKm(prevOrigin, nextOrigin) > 50;
    state.profiles = state.profiles.map((p) => {
      const updatedLat = movedFar ? Number((p.lat + dLat).toFixed(4)) : p.lat;
      const updatedLng = movedFar ? Number((p.lng + dLng).toFixed(4)) : p.lng;
      const distanceKm = calculateHaversineKm(nextOrigin, {
        lat: updatedLat,
        lng: updatedLng,
      });
      return {
        ...p,
        lat: updatedLat,
        lng: updatedLng,
        distanceKm,
        city: movedFar && label ? label.split(' ')[0] : p.city,
      };
    });

    state.user.location = nextOrigin;
    state.user.city = nextOrigin.label;
    const syncedLoc = syncNearbyProfilesToConversations(
      state.profiles,
      state.conversations,
      nextOrigin,
      { maxRadiusKm: DEFAULT_AUTO_CHAT_RADIUS_KM, onlineOnly: false },
    );
    state.conversations = syncedLoc.conversations;
    persistState();
    res.json({
      origin: nextOrigin,
      addedNearbyCount: syncedLoc.addedMatchIds.length,
      state: serializeClientState(Boolean(getChatSessionClaims(req))),
    });
  });

  app.post('/api/chats/sync-nearby', (req, res) => {
    if (!getChatSessionClaims(req)) {
      res.status(401).json({ error: 'Secure chat login required.' });
      return;
    }
    const { radiusKm, onlineOnly } = req.body as {
      radiusKm?: number | null;
      onlineOnly?: boolean;
    };
    const safeRadius =
      radiusKm === null ? null : Number.isFinite(Number(radiusKm)) ? Number(radiusKm) : DEFAULT_AUTO_CHAT_RADIUS_KM;
    const origin = state.user.location ?? HUB_LOCATIONS.kampala;
    const synced = syncNearbyProfilesToConversations(state.profiles, state.conversations, origin, {
      maxRadiusKm: safeRadius,
      onlineOnly: Boolean(onlineOnly),
    });
    state.conversations = synced.conversations;
    if (synced.addedMatchIds.length > 0) {
      persistState();
    }
    res.json({
      addedCount: synced.addedMatchIds.length,
      addedMatchIds: synced.addedMatchIds,
      nearbyCount: synced.nearbyMatchIds.length,
      state: serializeClientState(true),
    });
  });

  app.post('/api/chats/start', (req, res) => {
    if (!getChatSessionClaims(req)) {
      res.status(401).json({ error: 'Secure chat login required.' });
      return;
    }
    const { matchId } = req.body as { matchId?: string };
    const profile = state.profiles.find((p) => p.id === matchId);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }
    profile.liked = true;
    let conv = state.conversations.find((c) => c.matchId === matchId);
    if (!conv) {
      conv = {
        id: `chat_${profile.name.toLowerCase()}`,
        matchId: profile.id,
        freeMessagesUsed: 0,
        totalMessagesSent: 0,
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: `msg_welcome_${Date.now()}`,
            chatId: `chat_${profile.name.toLowerCase()}`,
            sender: 'match',
            text: `You matched with ${profile.name}! Your first 4 outbound messages in this chat are free.`,
            createdAt: new Date().toISOString(),
            isFreeMessage: false,
            coinsCharged: 0,
            syncStatus: 'synced',
          },
        ],
      };
      state.conversations.unshift(conv);
      persistState();
    }
    res.json({ conversation: conv, state: serializeClientState(true) });
  });

  app.post('/api/chats/:chatId/messages', (req, res) => {
    if (!getChatSessionClaims(req)) {
      res.status(401).json({ error: 'Secure chat login required.' });
      return;
    }
    const { text, clientTempId } = req.body as { text?: string; clientTempId?: string };
    const result = processMessageSend(req.params.chatId, text ?? '', clientTempId);
    res.status(result.status).json(result.body);
  });

  app.post('/api/wallet/topup', (req, res) => {
    const { usdAmount, provider, phoneNumber } = req.body as {
      usdAmount?: number;
      provider?: PaymentProvider;
      phoneNumber?: string;
    };

    const amount = Number(usdAmount);
    if (!Number.isFinite(amount) || amount < MIN_TOPUP_USD) {
      res.status(400).json({ error: 'Minimum top-up is $1.00 USD (100 coins).' });
      return;
    }
    if (provider !== 'flutterwave' && provider !== 'mtn_momo') {
      res.status(400).json({ error: 'Select Flutterwave or MTN MoMo.' });
      return;
    }
    if (provider === 'mtn_momo' && (!phoneNumber || phoneNumber.trim().length < 7)) {
      res.status(400).json({ error: 'Enter a valid MTN MoMo phone number.' });
      return;
    }

    const oneHourAgo = Date.now() - 3_600_000;
    const recentTopUps = state.transactions.filter(
      (t) => t.type === 'top_up' && Date.parse(t.createdAt) >= oneHourAgo,
    ).length;

    const fraudEval = evaluateAntiSpamAndFraud({
      topUpCountLastHour: recentTopUps,
      topUpUsdAmount: amount,
    });

    if (!fraudEval.allowed) {
      const fraudEntry: FraudEventLog = {
        id: `frd_${Date.now()}`,
        actor: state.user.email,
        channel: 'payment',
        allowed: false,
        riskScore: fraudEval.riskScore,
        triggeredRules: fraudEval.triggeredRules,
        samplePayload: `${provider} $${amount.toFixed(2)}`,
        createdAt: new Date().toISOString(),
      };
      state.fraudEvents.unshift(fraudEntry);
      persistState();
      res.status(429).json({
        error: fraudEval.triggeredRules[0]?.message || 'Top-up flagged by fraud rules.',
        fraudEval,
        state: serializeClientState(Boolean(getChatSessionClaims(req))),
      });
      return;
    }

    const coins = calculateCoinsForUsd(amount);
    const prefix = provider === 'flutterwave' ? 'FLW' : 'MOMO';
    const reference = `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const tx: WalletTransaction = {
      id: `tx_${Date.now()}`,
      reference,
      type: 'top_up',
      provider,
      usdAmount: Number(amount.toFixed(2)),
      coinsDelta: coins,
      balanceAfter: state.wallet.coinBalance,
      status: 'pending',
      description:
        provider === 'flutterwave'
          ? `Flutterwave Checkout ($${amount.toFixed(2)} · ${coins} coins)`
          : `MTN MoMo Collection (${phoneNumber?.trim()})`,
      createdAt: new Date().toISOString(),
      webhookVerified: false,
      phoneOrMaskedAccount:
        provider === 'mtn_momo' ? phoneNumber?.trim() : 'Card / Mobile Money',
    };

    state.transactions.unshift(tx);
    persistState();

    res.status(201).json({
      transaction: tx,
      webhookEndpoint:
        provider === 'flutterwave' ? '/api/webhooks/flutterwave' : '/api/webhooks/mtn-momo',
      state: serializeClientState(Boolean(getChatSessionClaims(req))),
    });
  });

  app.post('/api/webhooks/flutterwave', (req, res) => {
    const rawBody =
      (req as express.Request & { rawBody?: string }).rawBody || JSON.stringify(req.body);
    const sig = req.header('verif-hash');
    const reference = String(req.body?.txRef || req.body?.data?.tx_ref || '');
    const result = processVerifiedWebhook(
      'flutterwave',
      reference,
      rawBody,
      sig,
      FLW_WEBHOOK_SECRET,
    );
    res.status(result.status).json(result.body);
  });

  app.post('/api/webhooks/mtn-momo', (req, res) => {
    const rawBody =
      (req as express.Request & { rawBody?: string }).rawBody || JSON.stringify(req.body);
    const sig = req.header('x-momo-signature');
    const reference = String(req.body?.externalId || '');
    const result = processVerifiedWebhook(
      'mtn_momo',
      reference,
      rawBody,
      sig,
      MOMO_WEBHOOK_SECRET,
    );
    res.status(result.status).json(result.body);
  });

  app.post('/api/wallet/simulate-gateway-callback', (req, res) => {
    const { reference, tamperSignature } = req.body as {
      reference?: string;
      tamperSignature?: boolean;
    };
    const tx = state.transactions.find((t) => t.reference === reference);
    if (!tx || !tx.provider) {
      res.status(404).json({ error: 'Pending transaction not found.' });
      return;
    }

    const payloadObj =
      tx.provider === 'flutterwave'
        ? {
            event: 'charge.completed',
            status: 'successful',
            txRef: tx.reference,
            amount: tx.usdAmount,
            currency: 'USD',
          }
        : {
            financialTransactionId: `MOMO-FIN-${Date.now()}`,
            externalId: tx.reference,
            amount: String(tx.usdAmount),
            currency: 'USD',
            status: 'SUCCESSFUL',
          };

    const rawPayload = JSON.stringify(payloadObj);
    const secret = tx.provider === 'flutterwave' ? FLW_WEBHOOK_SECRET : MOMO_WEBHOOK_SECRET;
    const signature = tamperSignature
      ? 'tampered_invalid_signature_0000'
      : signWebhookPayload(rawPayload, secret);

    const result = processVerifiedWebhook(
      tx.provider,
      tx.reference,
      rawPayload,
      signature,
      secret,
    );

    res.status(result.status).json({
      ...result.body,
      state: serializeClientState(Boolean(getChatSessionClaims(req))),
      signedPayloadPreview: payloadObj,
      signaturePreview: `${signature.slice(0, 18)}...`,
    });
  });

  app.post('/api/fraud/evaluate', (req, res) => {
    const { text, topUpCountLastHour, topUpUsdAmount } = req.body as {
      text?: string;
      topUpCountLastHour?: number;
      topUpUsdAmount?: number;
    };
    const evaluation = evaluateAntiSpamAndFraud({
      text,
      topUpCountLastHour,
      topUpUsdAmount,
      recentTimestampsMs: [],
      recentMessageHashes: [],
    });

    const log: FraudEventLog = {
      id: `frd_${Date.now()}`,
      actor: 'rule_simulator',
      channel: text !== undefined ? 'chat' : 'payment',
      allowed: evaluation.allowed,
      riskScore: evaluation.riskScore,
      triggeredRules: evaluation.triggeredRules,
      samplePayload: text ?? `Top-Up $${topUpUsdAmount ?? 0} (${topUpCountLastHour ?? 0}/hr)`,
      createdAt: new Date().toISOString(),
    };
    state.fraudEvents.unshift(log);
    state.fraudEvents = state.fraudEvents.slice(0, 30);
    persistState();
    res.json({ evaluation, log, state: serializeClientState(Boolean(getChatSessionClaims(req))) });
  });

  app.post('/api/sync', (req, res) => {
    if (!getChatSessionClaims(req)) {
      res.status(401).json({ error: 'Secure chat login required.' });
      return;
    }
    const { messages } = req.body as {
      messages?: Array<{ clientTempId: string; chatId: string; text: string }>;
    };
    const results: Array<{ clientTempId: string; status: number; error?: string }> = [];

    for (const item of messages ?? []) {
      const outcome = processMessageSend(item.chatId, item.text, item.clientTempId);
      results.push({
        clientTempId: item.clientTempId,
        status: outcome.status,
        error:
          'error' in outcome.body && typeof outcome.body.error === 'string'
            ? outcome.body.error
            : undefined,
      });
    }

    res.json({
      syncedCount: results.filter((r) => r.status < 300).length,
      results,
      state: serializeClientState(true),
    });
  });

  app.post('/api/backup/restore', (req, res) => {
    const incoming = req.body as Partial<PlatformState>;
    if (
      !incoming ||
      !incoming.wallet ||
      !Array.isArray(incoming.conversations) ||
      !Array.isArray(incoming.transactions)
    ) {
      res.status(400).json({ error: 'Invalid backup structure.' });
      return;
    }
    state = {
      ...state,
      wallet: incoming.wallet,
      profiles: Array.isArray(incoming.profiles) ? incoming.profiles : state.profiles,
      conversations: incoming.conversations,
      transactions: incoming.transactions,
      fraudEvents: Array.isArray(incoming.fraudEvents) ? incoming.fraudEvents : state.fraudEvents,
    };
    persistState();
    broadcastEvent('balance_updated', (authed) => ({
      coinBalance: state.wallet.coinBalance,
      lowBalanceAlert: state.wallet.coinBalance <= LOW_BALANCE_THRESHOLD,
      state: serializeClientState(authed),
    }));
    res.json({ restored: true, state: serializeClientState(Boolean(getChatSessionClaims(req))) });
  });

  app.post('/api/reset-demo', (req, res) => {
    state = createInitialState();
    persistState();
    broadcastEvent('balance_updated', (authed) => ({
      coinBalance: state.wallet.coinBalance,
      lowBalanceAlert: false,
      state: serializeClientState(authed),
    }));
    res.json(serializeClientState(Boolean(getChatSessionClaims(req))));
  });

  app.get('/api/blueprints', (_req, res) => {
    res.json({ files: readBlueprintsFromDisk() });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kora platform running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
