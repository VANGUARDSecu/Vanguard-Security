import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { PersonalVaultItem } from '../../models/dashboard.models';

@Component({
  selector: 'app-user-personal-vault',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-personal-vault.html',
  styleUrl: './user-personal-vault.css'
})
export class UserPersonalVault {
  readonly dashboardService = inject(DashboardService);

  readonly vaultItems = this.dashboardService.vaultItems;
  readonly filteredVaultItems = this.dashboardService.filteredVaultItems;
  readonly vaultCategoryFilter = this.dashboardService.vaultCategoryFilter;
  readonly vaultSearchQuery = this.dashboardService.vaultSearchQuery;

  // SCRUM-114: zero-knowledge unlock gate. The vault must be unlocked with the
  // Vanguard login password before credentials can be viewed/added/synced.
  readonly isUnlocked = this.dashboardService.isVaultUnlocked;
  unlockPassword = '';
  readonly unlockError = signal<string | null>(null);
  readonly isUnlocking = signal<boolean>(false);

  // Modals & UI States
  readonly showAddModal = signal<boolean>(false);
  readonly showGeneratorModal = signal<boolean>(false);
  readonly editingItemId = signal<string | null>(null);

  // Visibility toggle for passwords (key: item.id, value: boolean)
  readonly revealedPasswords = signal<Record<string, boolean>>({});
  readonly copiedItemId = signal<string | null>(null);

  // Add / Edit Form State
  modalTitle = 'Add New Credential';
  formTitle = '';
  formCategory: 'Login' | 'Card' | 'Identity' | 'Secure Note' = 'Login';
  formUsername = '';
  formPassword = '';
  formTotpSecret = '';
  formUrl = '';
  formNotes = '';
  formFavorite = false;
  readonly formErrorMessage = signal<string | null>(null);

  // Password Generator State
  genLength = 20;
  genUppercase = true;
  genLowercase = true;
  genNumbers = true;
  genSymbols = true;
  readonly generatedPassword = signal<string>('');
  readonly generatorCopied = signal<boolean>(false);

  // Password Strength
  readonly formPasswordStrength = computed(() =>
    this.dashboardService.calculatePasswordStrength(this.formPassword)
  );

  readonly generatedPasswordStrength = computed(() =>
    this.dashboardService.calculatePasswordStrength(this.generatedPassword())
  );

  // Summary Metrics
  readonly totalItemsCount = computed(() => this.vaultItems().length);
  readonly favoritesCount = computed(() => this.vaultItems().filter((i) => i.favorite).length);
  readonly loginsCount = computed(() => this.vaultItems().filter((i) => i.category === 'Login').length);
  readonly notesCount = computed(() => this.vaultItems().filter((i) => i.category === 'Secure Note').length);

  constructor() {
    this.regeneratePassword();
  }

  /** SCRUM-114: unlock the vault with the Vanguard login password. */
  async unlock(): Promise<void> {
    this.unlockError.set(null);
    if (!this.unlockPassword) {
      this.unlockError.set('Enter your Vanguard password to unlock the vault.');
      return;
    }
    this.isUnlocking.set(true);
    try {
      await this.dashboardService.unlockVault(this.unlockPassword);
      this.unlockPassword = '';
    } catch (e: any) {
      this.unlockError.set(
        /VAULT_DECRYPT_FAILED/.test(e?.message || '')
          ? 'Wrong password — could not decrypt your vault.'
          : 'Could not unlock the vault.',
      );
    } finally {
      this.isUnlocking.set(false);
    }
  }

  /** SCRUM-114: lock the vault (clears decrypted items + key from memory). */
  lock(): void {
    this.dashboardService.lockVault();
  }

  setCategory(category: string): void {
    this.dashboardService.setVaultCategory(category);
  }

  setSearch(q: string): void {
    this.dashboardService.setVaultSearch(q);
  }

  togglePasswordVisibility(id: string): void {
    this.revealedPasswords.update((map) => ({
      ...map,
      [id]: !map[id]
    }));
  }

  isPasswordRevealed(id: string): boolean {
    return !!this.revealedPasswords()[id];
  }

  copyToClipboard(text: string | undefined, itemId: string): void {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      this.copiedItemId.set(itemId);
      setTimeout(() => {
        if (this.copiedItemId() === itemId) {
          this.copiedItemId.set(null);
        }
      }, 2500);
    });
  }

  toggleFavorite(id: string): void {
    this.dashboardService.toggleFavoriteVaultItem(id);
  }

  deleteItem(id: string): void {
    if (confirm('Are you sure you want to permanently delete this credential from your vault?')) {
      this.dashboardService.deleteVaultItem(id);
    }
  }

  openAddModal(): void {
    this.editingItemId.set(null);
    this.modalTitle = 'Add New Credential';
    this.formTitle = '';
    this.formCategory = 'Login';
    this.formUsername = '';
    this.formPassword = '';
    this.formTotpSecret = '';
    this.formUrl = '';
    this.formNotes = '';
    this.formFavorite = false;
    this.formErrorMessage.set(null);
    this.showAddModal.set(true);
  }

  openEditModal(item: PersonalVaultItem): void {
    this.editingItemId.set(item.id);
    this.modalTitle = 'Edit Credential';
    this.formTitle = item.title;
    this.formCategory = item.category;
    this.formUsername = item.username;
    this.formPassword = item.password || '';
    this.formTotpSecret = item.totpSecret || '';
    this.formUrl = item.url || '';
    this.formNotes = item.notes || '';
    this.formFavorite = !!item.favorite;
    this.formErrorMessage.set(null);
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
    this.editingItemId.set(null);
    this.formErrorMessage.set(null);
  }

  saveCredential(): void {
    if (!this.formTitle.trim()) {
      this.formErrorMessage.set('Credential title is required.');
      return;
    }

    const editId = this.editingItemId();
    if (editId) {
      this.dashboardService.updateVaultItem(editId, {
        title: this.formTitle.trim(),
        category: this.formCategory,
        username: this.formUsername.trim(),
        password: this.formPassword,
        totpSecret: this.formTotpSecret.trim(),
        url: this.formUrl.trim(),
        notes: this.formNotes.trim(),
        favorite: this.formFavorite
      });
    } else {
      this.dashboardService.addVaultItem({
        title: this.formTitle.trim(),
        category: this.formCategory,
        username: this.formUsername.trim(),
        password: this.formPassword,
        totpSecret: this.formTotpSecret.trim(),
        url: this.formUrl.trim(),
        notes: this.formNotes.trim(),
        favorite: this.formFavorite
      });
    }

    this.closeAddModal();
  }

  // Password Generator Actions
  openGeneratorModal(): void {
    this.regeneratePassword();
    this.showGeneratorModal.set(true);
  }

  closeGeneratorModal(): void {
    this.showGeneratorModal.set(false);
  }

  regeneratePassword(): void {
    const pw = this.dashboardService.generateStrongPassword({
      length: this.genLength,
      uppercase: this.genUppercase,
      lowercase: this.genLowercase,
      numbers: this.genNumbers,
      symbols: this.genSymbols
    });
    this.generatedPassword.set(pw);
  }

  copyGeneratedPassword(): void {
    const pw = this.generatedPassword();
    if (!pw) return;
    navigator.clipboard?.writeText(pw).then(() => {
      this.generatorCopied.set(true);
      setTimeout(() => this.generatorCopied.set(false), 2500);
    });
  }

  useGeneratedPasswordInForm(): void {
    this.formPassword = this.generatedPassword();
    this.closeGeneratorModal();
  }
}
