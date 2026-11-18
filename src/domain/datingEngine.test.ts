import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCoinsForUsd,
  calculateUsdForCoins,
  evaluateAntiSpamAndFraud,
  evaluateMessageCharge,
  FREE_MESSAGES_PER_CHAT,
  LOW_BALANCE_THRESHOLD,
} from './datingEngine';
import { signWebhookPayload, verifyWebhookSignature } from './webhookCrypto';

test('coin conversion enforces $1 = 100 coins and minimum $1 top-up', () => {
  assert.equal(calculateCoinsForUsd(1), 100);
  assert.equal(calculateCoinsForUsd(5), 500);
  assert.equal(calculateCoinsForUsd(12.5), 1250);
  assert.equal(calculateCoinsForUsd(0.5), 0);
  assert.equal(calculateUsdForCoins(100), 1);
});

test('first 4 messages in every new chat are free and 5th deducts 1 coin', () => {
  for (let used = 0; used < FREE_MESSAGES_PER_CHAT; used += 1) {
    const decision = evaluateMessageCharge(used, 0);
    assert.equal(decision.allowed, true);
    assert.equal(decision.isFree, true);
    assert.equal(decision.coinsCharged, 0);
    assert.equal(decision.freeRemainingAfter, FREE_MESSAGES_PER_CHAT - used - 1);
  }

  const fifthNoCoins = evaluateMessageCharge(4, 0);
  assert.equal(fifthNoCoins.allowed, false);
  assert.equal(fifthNoCoins.lowBalanceAlert, true);

  const fifthWithCoins = evaluateMessageCharge(4, 16);
  assert.equal(fifthWithCoins.allowed, true);
  assert.equal(fifthWithCoins.isFree, false);
  assert.equal(fifthWithCoins.coinsCharged, 1);
  assert.equal(fifthWithCoins.newBalance, 15);
  assert.equal(fifthWithCoins.lowBalanceAlert, 15 <= LOW_BALANCE_THRESHOLD);
});

test('anti-spam engine blocks phishing links, burst velocity, and duplicate spam', () => {
  const clean = evaluateAntiSpamAndFraud({
    text: 'Hey! Would you like to grab coffee on Saturday afternoon?',
    recentTimestampsMs: [1000, 5000],
    recentMessageHashes: [],
    nowMs: 10_000,
  });
  assert.equal(clean.allowed, true);
  assert.equal(clean.triggeredRules.length, 0);

  const phishing = evaluateAntiSpamAndFraud({
    text: 'Add me on telegram https://t.me/fastcrypto for USDT returns',
    recentTimestampsMs: [],
    recentMessageHashes: [],
    nowMs: 10_000,
  });
  assert.equal(phishing.allowed, false);
  assert.ok(phishing.riskScore >= 60);

  const burst = evaluateAntiSpamAndFraud({
    text: 'Hello there',
    recentTimestampsMs: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
    recentMessageHashes: [],
    nowMs: 10_000,
  });
  assert.equal(burst.allowed, false);
  assert.ok(burst.triggeredRules.some((r) => r.code === 'RATE_LIMIT_BURST'));

  const duplicate = evaluateAntiSpamAndFraud({
    text: 'Copy paste message',
    recentTimestampsMs: [],
    recentMessageHashes: [clean.messageHash],
    nowMs: 10_000,
  });
  assert.equal(duplicate.allowed, true);

  const firstHash = duplicate.messageHash;
  const thirdDuplicate = evaluateAntiSpamAndFraud({
    text: 'Copy paste message',
    recentTimestampsMs: [],
    recentMessageHashes: [firstHash, firstHash],
    nowMs: 10_000,
  });
  assert.equal(thirdDuplicate.allowed, false);
  assert.ok(thirdDuplicate.triggeredRules.some((r) => r.code === 'DUPLICATE_SPAM_TEMPLATE'));
});

test('webhook HMAC-SHA256 verification validates authentic payloads and rejects tampered ones', () => {
  const payload = JSON.stringify({ reference: 'FLW-1001', amountUsd: 5, coins: 500 });
  const secret = 'kora_test_webhook_secret';
  const sig = signWebhookPayload(payload, secret);

  assert.equal(verifyWebhookSignature(payload, sig, secret), true);
  assert.equal(verifyWebhookSignature(payload, 'deadbeef', secret), false);
  assert.equal(verifyWebhookSignature(payload + ' ', sig, secret), false);
});
