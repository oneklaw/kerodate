import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  signChatSessionToken,
  validatePasswordStrength,
  verifyChatSessionToken,
  verifyPassword,
} from './chatAuth';

test('scrypt password hashing and verification reject invalid passwords', () => {
  const hash = hashPassword('KeroDate2026');
  assert.equal(verifyPassword('KeroDate2026', hash), true);
  assert.equal(verifyPassword('wrongpass', hash), false);
  assert.equal(verifyPassword('KeroDate2026', 'malformed'), false);
});

test('password strength enforces 8+ chars with letter and digit', () => {
  assert.equal(validatePasswordStrength('short1').valid, false);
  assert.equal(validatePasswordStrength('onlyletters').valid, false);
  assert.equal(validatePasswordStrength('SecurePass9').valid, true);
});

test('chat session token validates authentic signature and rejects tampered or expired tokens', () => {
  const secret = 'kero_chat_session_secret';
  const now = 1_700_000_000_000;
  const token = signChatSessionToken(
    { userId: 'usr_1', email: 'onekalitkenneth@gmail.com' },
    secret,
    60_000,
    now,
  );

  const claims = verifyChatSessionToken(token, secret, now + 10_000);
  assert.equal(claims?.userId, 'usr_1');
  assert.equal(claims?.email, 'onekalitkenneth@gmail.com');

  // Tampered payload
  const tampered = `x${token.slice(1)}`;
  assert.equal(verifyChatSessionToken(tampered, secret, now + 10_000), null);

  // Expired token
  assert.equal(verifyChatSessionToken(token, secret, now + 65_000), null);
});
