import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  encryptVault,
  decryptVault,
  deriveKey,
  generateSalt,
  base64ToBytes,
  EncryptedVaultEnvelope,
} from '../../../shared/crypto/vault-crypto';
import { PersonalVaultItem } from '../models/dashboard.models';

const LEGACY_PLAINTEXT_KEY = 'vanguard_personal_vault_items';
const ENVELOPE_KEY = 'vanguard_vault_envelope';

/**
 * VaultCryptoService (SCRUM-98)
 * =============================
 * Zero-knowledge persistence for the web-app personal vault. Replaces the old
 * plaintext localStorage store. Vault items are encrypted client-side with a
 * key derived from the user's master password; only the opaque envelope is
 * persisted (localStorage cache + backend `/vault` sync). The derived key is
 * held in memory for the unlocked session only and never persisted.
 */
@Injectable({ providedIn: 'root' })
export class VaultCryptoService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly apiBase = 'http://localhost:3000';

  /** In-memory session key material. Null while locked. */
  private sessionKey: CryptoKey | null = null;
  private sessionSalt: Uint8Array | null = null;
  private sessionIterations = 0;

  readonly isUnlocked = signal<boolean>(false);

  /** True if a plaintext legacy vault exists and should be migrated. */
  hasLegacyPlaintext(): boolean {
    if (!this.isBrowser) return false;
    const legacy = localStorage.getItem(LEGACY_PLAINTEXT_KEY);
    return !!legacy && legacy !== '[]';
  }

  private readEnvelope(): EncryptedVaultEnvelope | null {
    if (!this.isBrowser) return null;
    const raw = localStorage.getItem(ENVELOPE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as EncryptedVaultEnvelope;
    } catch {
      return null;
    }
  }

  /**
   * Unlock the vault with the master password. Returns the decrypted items.
   * - If an encrypted envelope exists, derive the key from its salt and decrypt.
   * - Else if a legacy plaintext vault exists, migrate it: encrypt under a new
   *   salt, persist the envelope, and purge the plaintext.
   * - Else start an empty, unlocked vault.
   */
  async unlock(masterPassword: string): Promise<PersonalVaultItem[]> {
    const envelope = this.readEnvelope();

    if (envelope) {
      const items = await decryptVault<PersonalVaultItem[]>(envelope, masterPassword);
      this.sessionSalt = base64ToBytes(envelope.salt);
      this.sessionIterations = envelope.kdf?.iterations ?? 600_000;
      this.sessionKey = await deriveKey(masterPassword, this.sessionSalt, this.sessionIterations);
      this.isUnlocked.set(true);
      return items;
    }

    // No envelope yet — possibly migrate legacy plaintext, else empty vault.
    let items: PersonalVaultItem[] = [];
    if (this.hasLegacyPlaintext()) {
      try {
        items = JSON.parse(localStorage.getItem(LEGACY_PLAINTEXT_KEY) || '[]');
      } catch {
        items = [];
      }
    }

    this.sessionSalt = generateSalt();
    this.sessionIterations = 600_000;
    this.sessionKey = await deriveKey(masterPassword, this.sessionSalt, this.sessionIterations);
    this.isUnlocked.set(true);

    // Persist the (possibly migrated) vault as ciphertext, then purge plaintext.
    await this.persist(items);
    if (this.isBrowser) {
      localStorage.removeItem(LEGACY_PLAINTEXT_KEY);
    }
    return items;
  }

  /**
   * SCRUM-108 (Option C): unlock the vault using the user's Vanguard LOGIN
   * PASSWORD as the key-derivation secret. There is no separate master
   * password — the login password typed at sign-in is the same secret that
   * derives the AES-GCM key here. Because the key is derived client-side and
   * never transmitted, zero-knowledge is preserved. This produces an identical
   * envelope format to the browser extension (shared vault-crypto module), so
   * the same vault decrypts in both the web app and the extension.
   */
  async unlockWithLoginPassword(loginPassword: string): Promise<PersonalVaultItem[]> {
    return this.unlock(loginPassword);
  }

  /** Lock the vault: drop all in-memory key material. */
  lock(): void {
    this.sessionKey = null;
    this.sessionSalt = null;
    this.sessionIterations = 0;
    this.isUnlocked.set(false);
  }

  /**
   * SCRUM-109: Re-encrypt the vault when the Vanguard login password changes.
   *
   * Under Option C the vault key is derived from the login password, so a
   * password change makes the existing envelope undecryptable unless we re-key
   * it: decrypt with the OLD password, then re-encrypt (fresh salt) with the
   * NEW password and persist/sync. Call this as part of the change-password
   * flow BEFORE the old password stops working.
   *
   * Throws if the old password cannot decrypt the current vault (so the caller
   * can prompt the user instead of silently losing data).
   */
  async reencryptForPasswordChange(
    oldPassword: string,
    newPassword: string,
    userId?: string,
  ): Promise<void> {
    const envelope = this.readEnvelope();
    // No vault yet → nothing to re-encrypt; just establish a new-password session.
    if (!envelope) {
      this.sessionSalt = generateSalt();
      this.sessionIterations = 600_000;
      this.sessionKey = await deriveKey(newPassword, this.sessionSalt, this.sessionIterations);
      this.isUnlocked.set(true);
      await this.persist([], userId);
      return;
    }

    // 1. Decrypt with the OLD password (throws VAULT_DECRYPT_FAILED if wrong).
    const items = await decryptVault<PersonalVaultItem[]>(envelope, oldPassword);

    // 2. Re-key under the NEW password with a fresh salt.
    this.sessionSalt = generateSalt();
    this.sessionIterations = 600_000;
    this.sessionKey = await deriveKey(newPassword, this.sessionSalt, this.sessionIterations);
    this.isUnlocked.set(true);

    // 3. Persist the re-encrypted envelope (local + backend).
    await this.persist(items, userId);
  }

  /**
   * Encrypt and persist the given items using the current session key.
   * Writes the envelope to localStorage and best-effort syncs to the backend.
   * No-op (throws) if the vault is locked.
   */
  async persist(items: PersonalVaultItem[], userId?: string): Promise<void> {
    if (!this.sessionKey || !this.sessionSalt) {
      throw new Error('Vault is locked; cannot persist.');
    }
    const envelope = await encryptVault(items, {
      key: this.sessionKey,
      salt: this.sessionSalt,
      iterations: this.sessionIterations,
    });

    if (this.isBrowser) {
      localStorage.setItem(ENVELOPE_KEY, JSON.stringify(envelope));
    }

    if (userId) {
      try {
        await firstValueFrom(
          this.http.put(`${this.apiBase}/vault`, envelope, { params: { userId } }),
        );
      } catch {
        // Offline / backend down: keep the local encrypted cache; sync later.
      }
    }
  }

  /** Pull the encrypted envelope from the backend into the local cache. */
  async syncFromBackend(userId: string): Promise<void> {
    if (!this.isBrowser || !userId) return;
    try {
      const res = await firstValueFrom(
        this.http.get<{ envelope: EncryptedVaultEnvelope | null }>(`${this.apiBase}/vault`, {
          params: { userId },
        }),
      );
      if (res?.envelope) {
        localStorage.setItem(ENVELOPE_KEY, JSON.stringify(res.envelope));
      }
    } catch {
      // Keep local cache on failure.
    }
  }
}
