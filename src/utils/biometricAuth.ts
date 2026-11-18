export interface BiometricEnrollment {
  enrolled: boolean;
  mode: 'webauthn' | 'passkey_pin';
  credentialId?: string;
  pinHash?: string;
  enrolledAt: string;
}

const STORAGE_KEY = 'kora_biometric_enrollment_v1';

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function getBiometricEnrollment(): BiometricEnrollment | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BiometricEnrollment;
  } catch {
    return null;
  }
}

export function clearBiometricEnrollment(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function isHardwareBiometricAvailable(): Promise<boolean> {
  try {
    if (
      typeof window === 'undefined' ||
      !window.PublicKeyCredential ||
      !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    ) {
      return false;
    }
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function enrollBiometricLock(
  userId: string,
  userEmail: string,
  fallbackPin: string,
): Promise<BiometricEnrollment> {
  if (!fallbackPin || fallbackPin.trim().length < 4) {
    throw new Error('Recovery PIN must be at least 4 characters.');
  }
  const pinHash = await sha256Hex(`kora-pin:${userId}:${fallbackPin.trim()}`);
  const hwAvailable = await isHardwareBiometricAvailable();

  if (hwAvailable && navigator.credentials?.create) {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Kora Dating Platform' },
          user: {
            id: new TextEncoder().encode(userId),
            name: userEmail,
            displayName: 'Kora Member',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 30_000,
        },
      })) as PublicKeyCredential | null;

      if (cred) {
        const enrollment: BiometricEnrollment = {
          enrolled: true,
          mode: 'webauthn',
          credentialId: toBase64Url(cred.rawId),
          pinHash,
          enrolledAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(enrollment));
        return enrollment;
      }
    } catch {
      // Fall through cleanly to Passkey PIN vault if platform prompt is cancelled/unavailable
    }
  }

  const enrollment: BiometricEnrollment = {
    enrolled: true,
    mode: 'passkey_pin',
    pinHash,
    enrolledAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(enrollment));
  return enrollment;
}

export async function verifyBiometricUnlock(
  userId: string,
  pinAttempt?: string,
): Promise<{ ok: boolean; method: 'webauthn' | 'passkey_pin'; error?: string }> {
  const enrollment = getBiometricEnrollment();
  if (!enrollment || !enrollment.enrolled) {
    return { ok: true, method: 'passkey_pin' };
  }

  if (enrollment.mode === 'webauthn' && enrollment.credentialId && navigator.credentials?.get && !pinAttempt) {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const rawId = fromBase64Url(enrollment.credentialId);
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: rawId.buffer as ArrayBuffer, type: 'public-key' }],
          userVerification: 'required',
          timeout: 30_000,
        },
      });
      if (assertion) {
        return { ok: true, method: 'webauthn' };
      }
    } catch {
      return {
        ok: false,
        method: 'webauthn',
        error: 'Biometric prompt failed. Enter your recovery PIN to unlock.',
      };
    }
  }

  if (!pinAttempt || pinAttempt.trim().length === 0) {
    return { ok: false, method: 'passkey_pin', error: 'Enter your security PIN to unlock.' };
  }

  const attemptHash = await sha256Hex(`kora-pin:${userId}:${pinAttempt.trim()}`);
  if (attemptHash === enrollment.pinHash) {
    return { ok: true, method: 'passkey_pin' };
  }
  return { ok: false, method: 'passkey_pin', error: 'Incorrect security PIN.' };
}
