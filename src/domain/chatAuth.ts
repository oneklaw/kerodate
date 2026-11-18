import crypto from 'node:crypto';

export interface ChatSessionClaims {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters.' };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must include at least one letter and one number.' };
  }
  return { valid: true };
}

export function hashPassword(password: string, existingSalt?: string): string {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  const actualBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function signChatSessionToken(
  claims: Omit<ChatSessionClaims, 'iat' | 'exp'>,
  secret: string,
  ttlMs = 1000 * 60 * 60 * 12,
  nowMs = Date.now(),
): string {
  const fullClaims: ChatSessionClaims = {
    ...claims,
    iat: nowMs,
    exp: nowMs + ttlMs,
  };
  const payloadB64 = Buffer.from(JSON.stringify(fullClaims), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyChatSessionToken(
  token: string | undefined,
  secret: string,
  nowMs = Date.now(),
): ChatSessionClaims | null {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, providedSig] = parts;
  if (!payloadB64 || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  const a = Buffer.from(expectedSig, 'utf8');
  const b = Buffer.from(providedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as ChatSessionClaims;
    if (!claims.userId || !claims.email || typeof claims.exp !== 'number') {
      return null;
    }
    if (nowMs >= claims.exp) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}
