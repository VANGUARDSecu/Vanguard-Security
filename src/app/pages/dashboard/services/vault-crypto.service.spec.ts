import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { VaultCryptoService } from './vault-crypto.service';

describe('VaultCryptoService (SCRUM-98 zero-knowledge web vault)', () => {
  let service: VaultCryptoService;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), VaultCryptoService],
    });
    service = TestBed.inject(VaultCryptoService);
  });

  it('starts an empty, unlocked vault when no data exists and persists only ciphertext', async () => {
    const items = await service.unlock('master-pw');
    expect(items).toEqual([]);
    expect(service.isUnlocked()).toBe(true);

    await service.persist([
      { id: '1', title: 'Facebook', category: 'Login', username: 'me@x.com', password: 'p@ss', updatedAt: 'now' },
    ]);

    const envelopeRaw = localStorage.getItem('vanguard_vault_envelope');
    expect(envelopeRaw).toBeTruthy();
    // No plaintext credential must be present in the stored envelope.
    expect(envelopeRaw).not.toContain('p@ss');
    expect(envelopeRaw).not.toContain('me@x.com');
    // The legacy plaintext key must never be written.
    expect(localStorage.getItem('vanguard_personal_vault_items')).toBeNull();
  });

  it('migrates a legacy plaintext vault to an encrypted envelope and purges the plaintext', async () => {
    localStorage.setItem(
      'vanguard_personal_vault_items',
      JSON.stringify([
        { id: '9', title: 'Legacy', category: 'Login', username: 'legacy@x.com', password: 'legacyPass', updatedAt: 'old' },
      ]),
    );
    expect(service.hasLegacyPlaintext()).toBe(true);

    const items = await service.unlock('master-pw');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Legacy');

    // Plaintext purged, envelope written, and envelope contains no plaintext.
    expect(localStorage.getItem('vanguard_personal_vault_items')).toBeNull();
    const env = localStorage.getItem('vanguard_vault_envelope');
    expect(env).toBeTruthy();
    expect(env).not.toContain('legacyPass');
  });

  it('round-trips: persist then unlock again with the same password returns items', async () => {
    await service.unlock('pw');
    await service.persist([
      { id: '2', title: 'GitHub', category: 'Login', username: 'dev', password: 'tok', updatedAt: 'now' },
    ]);
    service.lock();
    expect(service.isUnlocked()).toBe(false);

    const items = await service.unlock('pw');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('GitHub');
  });

  it('fails to unlock an existing encrypted vault with the wrong password', async () => {
    await service.unlock('right');
    await service.persist([
      { id: '3', title: 'X', category: 'Login', username: 'u', password: 'p', updatedAt: 'now' },
    ]);
    service.lock();
    await expect(service.unlock('wrong')).rejects.toThrow(/VAULT_DECRYPT_FAILED/);
  });

  it('lock() clears in-memory key so persist throws until unlocked again', async () => {
    await service.unlock('pw');
    service.lock();
    await expect(service.persist([])).rejects.toThrow(/locked/i);
  });

  it('SCRUM-108 Option C: unlockWithLoginPassword encrypts/decrypts with the login password (shared format)', async () => {
    // Create a vault using the login password as the only secret.
    await service.unlockWithLoginPassword('LoginPass#1');
    await service.persist([
      { id: 'c1', title: 'Roblox', category: 'Login', username: 'player@x.com', password: 'R0blox!', updatedAt: 'now' },
    ]);
    service.lock();

    // Re-unlock with the same login password returns the item.
    const items = await service.unlockWithLoginPassword('LoginPass#1');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Roblox');

    // Wrong login password fails (zero-knowledge: server-independent).
    service.lock();
    await expect(service.unlockWithLoginPassword('WrongLogin')).rejects.toThrow(/VAULT_DECRYPT_FAILED/);
  });

  it('SCRUM-109: re-encrypts the vault on password change (old password stops working, new works)', async () => {
    // Create a vault under the OLD login password.
    await service.unlockWithLoginPassword('OldPass#1');
    await service.persist([
      { id: 'c1', title: 'Roblox', category: 'Login', username: 'player@x.com', password: 'R0blox!', updatedAt: 'now' },
    ]);
    service.lock();

    // Change password → re-encrypt.
    await service.reencryptForPasswordChange('OldPass#1', 'NewPass#2');
    service.lock();

    // New password unlocks and preserves the data.
    const items = await service.unlockWithLoginPassword('NewPass#2');
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Roblox');

    // Old password no longer works.
    service.lock();
    await expect(service.unlockWithLoginPassword('OldPass#1')).rejects.toThrow(/VAULT_DECRYPT_FAILED/);
  });

  it('SCRUM-109: re-encrypt throws when the old password is wrong (no silent data loss)', async () => {
    await service.unlockWithLoginPassword('OldPass#1');
    await service.persist([
      { id: 'c1', title: 'X', category: 'Login', username: 'u', password: 'p', updatedAt: 'now' },
    ]);
    service.lock();
    await expect(service.reencryptForPasswordChange('WrongOld', 'NewPass#2')).rejects.toThrow(/VAULT_DECRYPT_FAILED/);
  });
});
