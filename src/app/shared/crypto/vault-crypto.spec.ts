import { describe, it, expect } from 'vitest';
import {
  encryptVault,
  decryptVault,
  deriveKey,
  generateSalt,
  base64ToBytes,
  bytesToBase64,
  EncryptedVaultEnvelope,
  VAULT_ENVELOPE_VERSION,
} from './vault-crypto';

interface Item {
  id: string;
  title: string;
  username: string;
  password: string;
}

const SAMPLE: Item[] = [
  { id: '1', title: 'Facebook', username: 'alex@me.com', password: 'S3cret!Pass' },
  { id: '2', title: 'GitHub', username: 'alexdev', password: 'g1thub#Token' },
];

describe('vault-crypto (SCRUM-96 zero-knowledge)', () => {
  it('round-trips encrypt -> decrypt with the correct master password', async () => {
    const envelope = await encryptVault(SAMPLE, { masterPassword: 'Correct Horse Battery!' });
    const decrypted = await decryptVault<Item[]>(envelope, 'Correct Horse Battery!');
    expect(decrypted).toEqual(SAMPLE);
  });

  it('produces a versioned envelope that contains no plaintext', async () => {
    const envelope = await encryptVault(SAMPLE, { masterPassword: 'pw' });
    expect(envelope.version).toBe(VAULT_ENVELOPE_VERSION);
    expect(envelope.cipher).toBe('AES-GCM-256');
    expect(envelope.kdf.name).toBe('PBKDF2');
    expect(envelope.kdf.iterations).toBeGreaterThanOrEqual(600_000);

    // The serialized envelope must not leak any recognizable plaintext.
    const serialized = JSON.stringify(envelope);
    expect(serialized).not.toContain('S3cret!Pass');
    expect(serialized).not.toContain('alex@me.com');
    expect(serialized).not.toContain('Facebook');
  });

  it('fails to decrypt with the wrong master password', async () => {
    const envelope = await encryptVault(SAMPLE, { masterPassword: 'right-password' });
    await expect(decryptVault(envelope, 'wrong-password')).rejects.toThrow(/VAULT_DECRYPT_FAILED/);
  });

  it('detects tampering with the ciphertext (AES-GCM authentication)', async () => {
    const envelope = await encryptVault(SAMPLE, { masterPassword: 'pw' });
    const bytes = base64ToBytes(envelope.ciphertext);
    bytes[0] ^= 0xff; // flip a bit
    const tampered: EncryptedVaultEnvelope = { ...envelope, ciphertext: bytesToBase64(bytes) };
    await expect(decryptVault(tampered, 'pw')).rejects.toThrow(/VAULT_DECRYPT_FAILED/);
  });

  it('uses a unique random salt and IV per encryption', async () => {
    const a = await encryptVault(SAMPLE, { masterPassword: 'pw' });
    const b = await encryptVault(SAMPLE, { masterPassword: 'pw' });
    expect(a.salt).not.toEqual(b.salt);
    expect(a.iv).not.toEqual(b.iv);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it('supports encrypting with a pre-derived session key (unlock session)', async () => {
    const salt = generateSalt();
    const key = await deriveKey('pw', salt);
    const envelope = await encryptVault(SAMPLE, { key, salt, iterations: 600_000 });
    const decrypted = await decryptVault<Item[]>(envelope, 'pw');
    expect(decrypted).toEqual(SAMPLE);
  });

  it('round-trips an empty vault', async () => {
    const envelope = await encryptVault<Item[]>([], { masterPassword: 'pw' });
    const decrypted = await decryptVault<Item[]>(envelope, 'pw');
    expect(decrypted).toEqual([]);
  });
});
