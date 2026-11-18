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
import { signWebhookPayload, verifyWebhookSignature } from './src/domain/webhookCrypto.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const FLW_WEBHOOK_SECRET = process.env.FLW_WEBHOOK_SECRET || 'kora_flw_webhook_secret_2026';
const MOMO_WEBHOOK_SECRET = process.env.MOMO_WEBHOOK_SECRET || 'kora_momo_hmac_secret_2026';
const DATA_FILE = path.join(__dirname, '.kora-store.json');

interface PlatformState {
  user: {
    id: string;
    name: string;
    email: string;
    city: string;
    lowBalanceThreshold: number;
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
  lastSyncedAt: string;
}

function createInitialState(): PlatformState {
  const now = Date.now();
  const iso = (offsetMinutes: number) => new Date(now - offsetMinutes * 60_000).toISOString();

  return {
    user: {
      id: 'usr_kora_01',
      name: 'Kenneth',
      email: 'onekalitkenneth@gmail.com',
      city: 'Kampala · London',
      lowBalanceThreshold: LOW_BALANCE_THRESHOLD,
    },
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
        lastActive: 'Active 8m ago',
        distanceKm: 3,
        liked: true,
      },
      {
        id: 'prof_julian',
        name: 'Julian',
        age: 31,
        city: 'London',
        occupation: 'Curator & Writer',
        bio: 'Contemporary sculpture curator looking for someone who enjoys long museum afternoons.',
        interests: ['Sculpture', 'Film', 'Cycling'],
        imageUrl: '/src/assets/images/profile_julian_1794994399452.jpg',
        verified: true,
        lastActive: 'Active 14m ago',
        distanceKm: 5,
        liked: true,
      },
      {
        id: 'prof_nadia',
        name: 'Nadia',
        age: 28,
        city: 'Milan',
        occupation: 'Industrial Designer',
        bio: 'Ceramics, espresso on quiet terraces, and weekend train trips to the coast.',
        interests: ['Ceramics', 'Espresso', 'Travel'],
        imageUrl: '/src/assets/images/profile_nadia_1794994398255.jpg',
        verified: true,
        lastActive: 'Active now',
        distanceKm: 2,
        liked: false,
      },
      {
        id: 'prof_david',
        name: 'David',
        age: 32,
        city: 'Nairobi',
        occupation: 'Botanical Photographer',
        bio: 'Documenting urban greenhouses and cooking West African comfort food on Sundays.',
        interests: ['Botany', '35mm Film', 'Cooking'],
        imageUrl: '/src/assets/images/profile_david_1794994398521.jpg',
        verified: true,
        lastActive: 'Active 25m ago',
        distanceKm: 7,
        liked: false,
      },
      {
        id: 'prof_elena',
        name: 'Elena',
        age: 29,
        city: 'Copenhagen',
        occupation: 'Editorial Bookbinder',
        bio: 'Independent bookstores, Scandinavian timber furniture, and quiet evening walks.',
        interests: ['Typography', 'Bookshops', 'Rowing'],
        imageUrl: '/src/assets/images/profile_elena_1794994399857.jpg',
        verified: true,
        lastActive: 'Active 1h ago',
        distanceKm: 11,
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
}

function loadState(): PlatformState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw) as PlatformState;
    }
  } catch {
    // Fall back to fresh initial state if file is unreadable
  }
  const initial = createInitialState();
  fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  return initial;
}

let state: PlatformState = loadState();
const sseClients = new Set<express.Response>();

function persistState() {
  state.lastSyncedAt = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

function broadcastEvent(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
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
    broadcastEvent('message_received', { chatId, message: reply, state });
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
      body: { deduplicated: true, state },
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
    broadcastEvent('fraud_triggered', { fraudEntry, state });
    return {
      status: 422,
      body: {
        error: spamCheck.triggeredRules[0]?.message || 'Blocked by anti-spam protection.',
        fraudEvaluation: spamCheck,
        state,
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
        state,
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

  broadcastEvent('balance_updated', {
    coinBalance: state.wallet.coinBalance,
    lowBalanceAlert: charge.lowBalanceAlert,
    state,
  });

  scheduleMatchReply(conv.id, conv.matchId);

  return {
    status: 201,
    body: {
      message: newMsg,
      charge,
      state,
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
    broadcastEvent('fraud_triggered', { fraudEntry, state });
    return { status: 401, body: { error: 'Invalid webhook signature.' } };
  }

  const tx = state.transactions.find((t) => t.reference === reference);
  if (!tx) {
    return { status: 404, body: { error: 'Transaction reference not found.' } };
  }

  if (tx.status === 'completed') {
    return { status: 200, body: { idempotent: true, tx, state } };
  }

  state.wallet.coinBalance += tx.coinsDelta;
  state.wallet.lifetimePurchased += tx.coinsDelta;
  tx.status = 'completed';
  tx.balanceAfter = state.wallet.coinBalance;
  tx.webhookVerified = true;
  persistState();

  broadcastEvent('balance_updated', {
    coinBalance: state.wallet.coinBalance,
    lowBalanceAlert: state.wallet.coinBalance <= LOW_BALANCE_THRESHOLD,
    creditedCoins: tx.coinsDelta,
    reference: tx.reference,
    provider,
    state,
  });

  return {
    status: 200,
    body: {
      credited: true,
      tx,
      state,
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

  app.get('/api/bootstrap', (_req, res) => {
    res.json(state);
  });

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
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
    res.json({ profile, state });
  });

  app.post('/api/chats/start', (req, res) => {
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
    res.json({ conversation: conv, state });
  });

  app.post('/api/chats/:chatId/messages', (req, res) => {
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
        state,
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
      state,
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
    res.json({ evaluation, log, state });
  });

  app.post('/api/sync', (req, res) => {
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

    res.json({ syncedCount: results.filter((r) => r.status < 300).length, results, state });
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
    broadcastEvent('balance_updated', {
      coinBalance: state.wallet.coinBalance,
      lowBalanceAlert: state.wallet.coinBalance <= LOW_BALANCE_THRESHOLD,
      state,
    });
    res.json({ restored: true, state });
  });

  app.post('/api/reset-demo', (_req, res) => {
    state = createInitialState();
    persistState();
    broadcastEvent('balance_updated', {
      coinBalance: state.wallet.coinBalance,
      lowBalanceAlert: false,
      state,
    });
    res.json(state);
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
