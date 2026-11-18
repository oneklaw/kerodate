export interface EncryptedBackupEnvelope {
  format: 'KORA-AES256-GCM-V1';
  createdAt: string;
  salt: string;
  iv: string;
  ciphertext: string;
  checksum: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function sha256Base64(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return bytesToBase64(new Uint8Array(digest));
}

export async function createEncryptedBackup<T>(
  payload: T,
  passphrase: string,
): Promise<EncryptedBackupEnvelope> {
  if (!passphrase || passphrase.length < 6) {
    throw new Error('Encryption passphrase must be at least 6 characters.');
  }

  const plaintext = JSON.stringify(payload);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    new TextEncoder().encode(plaintext),
  );

  const checksum = await sha256Base64(plaintext);

  return {
    format: 'KORA-AES256-GCM-V1',
    createdAt: new Date().toISOString(),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    checksum,
  };
}

export async function restoreEncryptedBackup<T>(
  envelope: EncryptedBackupEnvelope,
  passphrase: string,
): Promise<T> {
  if (envelope?.format !== 'KORA-AES256-GCM-V1') {
    throw new Error('Unsupported backup file format.');
  }
  if (!passphrase) {
    throw new Error('Passphrase is required to decrypt backup.');
  }

  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const key = await deriveAesKey(passphrase, salt);

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer,
    );
  } catch {
    throw new Error('Decryption failed. Verify your passphrase and backup integrity.');
  }

  const plaintext = new TextDecoder().decode(decryptedBuffer);
  const actualChecksum = await sha256Base64(plaintext);
  if (actualChecksum !== envelope.checksum) {
    throw new Error('Backup integrity checksum mismatch.');
  }

  return JSON.parse(plaintext) as T;
}
