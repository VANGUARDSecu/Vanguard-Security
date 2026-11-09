import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { TotpAccount } from '../../models/dashboard.models';
import { base32Decode, parseOtpAuthUri, buildOtpAuthUri } from '../../../../shared/crypto/totp';

export interface AuthenticatorPreset {
  issuer: string;
  icon: string;
  category: string;
}

@Component({
  selector: 'app-user-authenticator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-authenticator.html',
  styleUrl: './user-authenticator.css',
})
export class UserAuthenticator implements OnDestroy {
  readonly dashboardService = inject(DashboardService);

  readonly totpAccounts = this.dashboardService.totpAccounts;
  readonly activeTotpAccounts = this.dashboardService.activeTotpAccounts;
  readonly totpSecondsRemaining = this.dashboardService.totpSecondsRemaining;

  // Search & filter state (SCRUM-166: 3rd-Party Authenticator Parity)
  readonly searchQuery = signal<string>('');
  readonly selectedCategory = signal<string>('all');

  readonly servicePresets: AuthenticatorPreset[] = [
    { issuer: 'Google', icon: '🔍', category: 'cloud' },
    { issuer: 'GitHub', icon: '🐙', category: 'developer' },
    { issuer: 'Facebook', icon: '📘', category: 'social' },
    { issuer: 'Figma', icon: '🎨', category: 'design' },
    { issuer: 'AWS', icon: '☁️', category: 'cloud' },
    { issuer: 'Microsoft', icon: '🪟', category: 'cloud' },
    { issuer: 'Discord', icon: '💬', category: 'social' },
    { issuer: 'Cloudflare', icon: '⚡', category: 'developer' },
  ];

  readonly filteredTotpAccounts = computed<TotpAccount[]>(() => {
    const query = this.searchQuery().toLowerCase().trim();
    return this.activeTotpAccounts().filter((acc) => {
      if (!query) return true;
      return (
        acc.issuer.toLowerCase().includes(query) ||
        acc.accountName.toLowerCase().includes(query)
      );
    });
  });

  // Percentage for timer bar
  readonly timePercent = computed(() => {
    return Math.round((this.totpSecondsRemaining() / 30) * 100);
  });

  // Copied code & URI feedback
  readonly copiedAccountId = signal<string | null>(null);
  readonly copiedUriAccountId = signal<string | null>(null);

  // Add / Edit Account Modal
  readonly showAddModal = signal<boolean>(false);
  readonly enrollMode = signal<'manual' | 'uri' | 'qr'>('manual');
  readonly editingAccountId = signal<string | null>(null);

  formIssuer = '';
  formAccountName = '';
  formSecret = '';
  formDigits: 6 | 8 = 6;
  formPeriod: 30 | 60 = 30;
  formAlgorithm: 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1';
  formOtpAuthUri = '';

  readonly formErrorMessage = signal<string | null>(null);
  readonly formSuccessMessage = signal<string | null>(null);

  // Camera / QR Scanner state
  readonly isCameraActive = signal<boolean>(false);
  private cameraStream: MediaStream | null = null;
  private scanFrameId: number | null = null;

  ngOnDestroy(): void {
    this.stopCameraScan();
  }

  openAddModal(mode: 'manual' | 'uri' | 'qr' = 'manual'): void {
    this.editingAccountId.set(null);
    this.enrollMode.set(mode);
    this.formIssuer = '';
    this.formAccountName = '';
    this.formSecret = '';
    this.formDigits = 6;
    this.formPeriod = 30;
    this.formAlgorithm = 'SHA1';
    this.formOtpAuthUri = '';
    this.formErrorMessage.set(null);
    this.formSuccessMessage.set(null);
    this.showAddModal.set(true);
  }

  openEditModal(acc: TotpAccount): void {
    this.editingAccountId.set(acc.id);
    this.enrollMode.set('manual');
    this.formIssuer = acc.issuer;
    this.formAccountName = acc.accountName;
    this.formSecret = acc.secret;
    this.formDigits = acc.digits || 6;
    this.formPeriod = acc.period || 30;
    this.formAlgorithm = acc.algorithm || 'SHA1';
    this.formOtpAuthUri = buildOtpAuthUri(acc);
    this.formErrorMessage.set(null);
    this.formSuccessMessage.set(null);
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.stopCameraScan();
    this.showAddModal.set(false);
    this.editingAccountId.set(null);
    this.formErrorMessage.set(null);
    this.formSuccessMessage.set(null);
  }

  selectPreset(preset: AuthenticatorPreset): void {
    this.formIssuer = preset.issuer;
    this.formErrorMessage.set(null);
  }

  applyOtpAuthUri(uriInput?: string): boolean {
    const raw = (uriInput ?? this.formOtpAuthUri).trim();
    if (!raw) {
      this.formErrorMessage.set('Please paste an otpauth://totp/... URI first.');
      return false;
    }
    try {
      const parsed = parseOtpAuthUri(raw);
      this.formIssuer = parsed.issuer;
      this.formAccountName = parsed.accountName;
      this.formSecret = parsed.secret;
      this.formDigits = parsed.digits;
      this.formPeriod = parsed.period;
      this.formAlgorithm = parsed.algorithm;
      this.formErrorMessage.set(null);
      this.formSuccessMessage.set(
        `Parsed ${parsed.issuer} (${parsed.accountName}) — ${parsed.digits} digits, ${parsed.algorithm}, ${parsed.period}s period.`
      );
      return true;
    } catch (err: any) {
      this.formErrorMessage.set(err?.message || 'Could not parse otpauth:// URI.');
      return false;
    }
  }

  async onQrFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    this.formErrorMessage.set(null);
    this.formSuccessMessage.set(null);

    try {
      // 1. Check if BarcodeDetector API is available in browser (Chrome/Edge/Android/macOS)
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        const bitmap = await createImageBitmap(file);
        const BarcodeDetectorCtor = (window as any).BarcodeDetector;
        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        const codes = await detector.detect(bitmap);
        if (codes && codes.length > 0 && codes[0].rawValue) {
          this.formOtpAuthUri = codes[0].rawValue;
          if (this.applyOtpAuthUri(codes[0].rawValue)) {
            this.enrollMode.set('manual');
            return;
          }
        }
      }

      // 2. Fallback: Check if file text/name or metadata embeds an otpauth URI
      const text = await file.text().catch(() => '');
      const match = text.match(/otpauth:\/\/totp\/[^\s"'<>]+/i);
      if (match) {
        this.formOtpAuthUri = match[0];
        if (this.applyOtpAuthUri(match[0])) {
          this.enrollMode.set('manual');
          return;
        }
      }

      this.formErrorMessage.set(
        'Could not detect a QR code in this image or browser BarcodeDetector is unsupported. Please paste the otpauth:// URI or Base32 secret key.'
      );
    } catch {
      this.formErrorMessage.set(
        'Unable to decode QR image. Please paste the otpauth:// URI or Base32 secret key.'
      );
    }
  }

  async startCameraScan(videoElement: HTMLVideoElement): Promise<void> {
    this.formErrorMessage.set(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.formErrorMessage.set('Camera access is not supported in this browser environment.');
      return;
    }

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      videoElement.srcObject = this.cameraStream;
      await videoElement.play();
      this.isCameraActive.set(true);

      if ('BarcodeDetector' in window) {
        const BarcodeDetectorCtor = (window as any).BarcodeDetector;
        const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        const scanLoop = async () => {
          if (!this.isCameraActive()) return;
          try {
            const codes = await detector.detect(videoElement);
            if (codes && codes.length > 0 && codes[0].rawValue) {
              this.stopCameraScan();
              this.formOtpAuthUri = codes[0].rawValue;
              if (this.applyOtpAuthUri(codes[0].rawValue)) {
                this.enrollMode.set('manual');
              }
              return;
            }
          } catch {}
          this.scanFrameId = requestAnimationFrame(scanLoop);
        };
        this.scanFrameId = requestAnimationFrame(scanLoop);
      }
    } catch {
      this.formErrorMessage.set('Camera permission denied or no camera available.');
      this.isCameraActive.set(false);
    }
  }

  stopCameraScan(): void {
    if (this.scanFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.scanFrameId);
      this.scanFrameId = null;
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((t) => t.stop());
      this.cameraStream = null;
    }
    this.isCameraActive.set(false);
  }

  formatCode(code?: string): string {
    if (!code) return '------';
    const trimmed = code.trim();
    if (trimmed.length === 6) {
      return `${trimmed.slice(0, 3)} ${trimmed.slice(3)}`;
    }
    if (trimmed.length === 8) {
      return `${trimmed.slice(0, 4)} ${trimmed.slice(4)}`;
    }
    return trimmed;
  }

  copyCode(code?: string, id?: string): void {
    if (!code || !id) return;
    navigator.clipboard?.writeText(code).then(() => {
      this.copiedAccountId.set(id);
      setTimeout(() => {
        if (this.copiedAccountId() === id) {
          this.copiedAccountId.set(null);
        }
      }, 2500);
    });
  }

  copyOtpAuthUri(acc: TotpAccount): void {
    const uri = buildOtpAuthUri(acc);
    navigator.clipboard?.writeText(uri).then(() => {
      this.copiedUriAccountId.set(acc.id);
      setTimeout(() => {
        if (this.copiedUriAccountId() === acc.id) {
          this.copiedUriAccountId.set(null);
        }
      }, 2500);
    });
  }

  deleteAccount(id: string, issuer: string): void {
    if (
      confirm(
        `Are you sure you want to remove the 2FA authenticator code for ${issuer}? You will no longer be able to generate one-time codes for this account.`
      )
    ) {
      this.dashboardService.deleteTotpAccount(id);
    }
  }

  saveAccount(): void {
    if (this.enrollMode() === 'uri' && this.formOtpAuthUri.trim() && !this.formSecret.trim()) {
      if (!this.applyOtpAuthUri(this.formOtpAuthUri)) {
        return;
      }
    }

    const issuer = this.formIssuer.trim();
    const accountName = this.formAccountName.trim();
    const secret = this.formSecret.trim().replace(/\s+/g, '').toUpperCase();

    if (!issuer) {
      this.formErrorMessage.set('Service/Issuer name is required.');
      return;
    }
    if (!secret) {
      this.formErrorMessage.set('Secret key is required.');
      return;
    }

    try {
      base32Decode(secret);
    } catch {
      this.formErrorMessage.set(
        'Invalid Base32 secret key. Only letters A-Z and digits 2-7 are allowed.'
      );
      return;
    }

    const editId = this.editingAccountId();
    if (editId) {
      this.dashboardService.updateTotpAccount(editId, {
        issuer,
        accountName: accountName || 'Primary Account',
        secret,
        digits: this.formDigits,
        period: this.formPeriod,
        algorithm: this.formAlgorithm,
      });
    } else {
      this.dashboardService.addTotpAccount({
        issuer,
        accountName: accountName || 'Primary Account',
        secret,
        digits: this.formDigits,
        period: this.formPeriod,
        algorithm: this.formAlgorithm,
      });
    }

    this.closeAddModal();
  }
}
