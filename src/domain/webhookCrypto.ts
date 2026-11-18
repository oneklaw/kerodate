import crypto from 'node:crypto';

export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookSignature(
  payload: string,
  providedSignature: string | undefined,
  secret: string,
): boolean {
  if (!providedSignature || !secret) {
    return false;
  }
  const expected = signWebhookPayload(payload, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(providedSignature.trim(), 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
