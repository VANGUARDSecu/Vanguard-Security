/**
 * Zero-Knowledge Vault Crypto (SCRUM-96)
 * ======================================
 * Framework-agnostic client-side crypto for the Vanguard vault, shared by the
 * Angular web app and the browser extension. Uses the native Web Crypto API
 * only (no third-party dependencies) so it runs identically in the browser and
 * in an MV3 service worker.
 *
 * Design:
 *   - A master password is stretched into a 256-bit AES-GCM key via PBKDF2
 *     (SHA-256, high iteration count per OWASP). The derived key never leaves
 *     the client and is never sent to the server.
 *   - Vault items are serialized to JSON and encrypted with AES-GCM (random
 *     96-bit IV; GCM provides built-in authentication/tamper detection).
 *   - The ciphertext is wrapped in an `EncryptedVaultEnvelope` carrying a
 *     `version` and `kdf` descriptor so a future migration (e.g. Argon2id) can
 *     be performed without breaking existing vaults.
 *
 * The server only ever stores the opaque envelope. It cannot decrypt it.
 */

/** Current envelope format version. Bump when the on-disk shape changes. */
export const VAULT_ENVELOPE_VERSION = '1.0.0';

/**
 * OWASP-recommended minimum for PBKDF2-HMAC-SHA256 (as of 2023). Kept as a
 * constant so it can be raised over time; the value used is recorded in the
 * envelope's `kdf.iterations` so older vaults remain decryptable.
 */
export const PBKDF2_DEFAULT_ITERATIONS = 600_000;

export interface VaultKdfParams {
  /** Key derivation function identifier. */
  name: 'PBKDF2';
  /** Underlying hash. */
  hash: 'SHA-256';
  /** Iteration count actually used for this envelope. */
  iterations: number;
}

/**
 * Opaque, server-stored encrypted vault blob. Contains no plaintext.
 */
export interface EncryptedVaultEnvelope {
  /** Envelope format version (for forward migration). */
  version: string;
  /** Symmetric cipher used. */
  cipher: 'AES-GCM-256';
  /** Key derivation parameters (enables future KDF upgrades, e.g. Argon2id). */
  kdf: VaultKdfParams;
  /** Base64 PBKDF2 salt (16 bytes). */
  salt: string;
  /** Base64 AES-GCM IV (12 bytes). */
  iv: string;
  /** Base64 AES-GCM ciphertext (includes the GCM auth tag). */
  ciphertext: string;
  /** ISO timestamp of last encryption. */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Base64 helpers (work in browser, service worker, and Node test runners)
// ---------------------------------------------------------------------------

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getCrypto(): Crypto {
  const c = (globalThis as any).crypto as Crypto | undefined;
  if (!c || !c.subtle) {
    throw new Error('Web Crypto API is not available in this environment.');
  }
  return c;
}

// ---------------------------------------------------------------------------
// Key derivation & vault encryption
// ---------------------------------------------------------------------------

/** Generate a cryptographically random salt (16 bytes). */
export function generateSalt(): Uint8Array {
  return getCrypto().getRandomValues(new Uint8Array(16));
}

/**
 * Derive a non-extractable AES-GCM 256 key from a master password using PBKDF2.
 * The returned CryptoKey can be used for encrypt/decrypt but never exported.
 */
export async function deriveKey(
  masterPassword: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_DEFAULT_ITERATIONS,
): Promise<CryptoKey> {
  if (!masterPassword) {
    throw new Error('Master password is required to derive a vault key.');
  }
  const subtle = getCrypto().subtle;
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(masterPassword) as unknown as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt an arbitrary JSON-serializable vault payload (e.g. an array of
 * PersonalVaultItem) into an EncryptedVaultEnvelope.
 *
 * Accepts a master password (derives a fresh key with a new random salt) OR a
 * pre-derived CryptoKey plus the salt that produced it.
 */
export async function encryptVault<T>(
  payload: T,
  secret: { masterPassword: string; iterations?: number } | { key: CryptoKey; salt: Uint8Array; iterations: number },
): Promise<EncryptedVaultEnvelope> {
  const subtle = getCrypto().subtle;

  let key: CryptoKey;
  let salt: Uint8Array;
  let iterations: number;

  if ('masterPassword' in secret) {
    salt = generateSalt();
    iterations = secret.iterations ?? PBKDF2_DEFAULT_ITERATIONS;
    key = await deriveKey(secret.masterPassword, salt, iterations);
  } else {
    key = secret.key;
    salt = secret.salt;
    iterations = secret.iterations;
  }

  const iv = getCrypto().getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    plaintext as unknown as BufferSource,
  );

  return {
    version: VAULT_ENVELOPE_VERSION,
    cipher: 'AES-GCM-256',
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations },
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Decrypt an EncryptedVaultEnvelope back into the original payload.
 * Throws if the master password is wrong or the ciphertext has been tampered
 * with (AES-GCM authentication failure).
 */
export async function decryptVault<T>(
  envelope: EncryptedVaultEnvelope,
  masterPassword: string,
): Promise<T> {
  const subtle = getCrypto().subtle;
  const salt = base64ToBytes(envelope.salt);
  const iterations = envelope.kdf?.iterations ?? PBKDF2_DEFAULT_ITERATIONS;
  const key = await deriveKey(masterPassword, salt, iterations);

  let decrypted: ArrayBuffer;
  try {
    decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) as unknown as BufferSource },
      key,
      base64ToBytes(envelope.ciphertext) as unknown as BufferSource,
    );
  } catch {
    // AES-GCM throws on wrong key or tampered ciphertext. Normalize the error.
    throw new Error('VAULT_DECRYPT_FAILED: wrong master password or corrupted vault.');
  }
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

/** Derive the key once and return it with its salt — useful for an unlock session. */
export async function unlockSession(
  masterPassword: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_DEFAULT_ITERATIONS,
): Promise<{ key: CryptoKey; salt: Uint8Array; iterations: number }> {
  const key = await deriveKey(masterPassword, salt, iterations);
  return { key, salt, iterations };
}
