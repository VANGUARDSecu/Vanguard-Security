import { Component, inject, signal, computed, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { TotpAccount } from '../../models/dashboard.models';
import { base32Decode, parseOtpAuthUri, buildOtpAuthUri, generateTotp } from '../../../../shared/crypto/totp';
import jsQR from 'jsqr';

export interface AuthenticatorPreset {
  issuer: string;
  icon: string;
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

  // Search & filter state
  readonly searchQuery = signal<string>('');

  readonly servicePresets: AuthenticatorPreset[] = [
    { issuer: 'GitHub', icon: '🐙' },
    { issuer: 'Google', icon: '🔍' },
    { issuer: 'Microsoft', icon: '🪟' },
    { issuer: 'AWS', icon: '☁️' },
    { issuer: 'Discord', icon: '💬' },
    { issuer: 'Cloudflare', icon: '⚡' },
    { issuer: 'Facebook', icon: '📘' },
    { issuer: 'Binance', icon: '🪙' },
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

  // Live preview code for secret validation
  readonly previewCode = signal<string | null>(null);

  // QR Code Inspector Modal State
  readonly activeQrViewAccount = signal<TotpAccount | null>(null);

  // Revoke / Lockout Warning Modal State
  readonly accountPendingRevocation = signal<TotpAccount | null>(null);

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
  @ViewChild('qrVideo') qrVideoRef?: ElementRef<HTMLVideoElement>;
  readonly isCameraActive = signal<boolean>(false);
  readonly isCameraLoading = signal<boolean>(false);
  private cameraStream: MediaStream | null = null;
  private scanFrameId: number | null = null;
  private scanCanvas: HTMLCanvasElement | null = null;
  private barcodeDetector: any = null;

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
    this.previewCode.set(null);
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
    this.updatePreviewCode();
    this.formErrorMessage.set(null);
    this.formSuccessMessage.set(null);
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.stopCameraScan();
    this.showAddModal.set(false);
    this.editingAccountId.set(null);
    this.previewCode.set(null);
    this.formErrorMessage.set(null);
    this.formSuccessMessage.set(null);
  }

  openQrView(acc: TotpAccount): void {
    this.activeQrViewAccount.set(acc);
  }

  closeQrView(): void {
    this.activeQrViewAccount.set(null);
  }

  openRevokeModal(acc: TotpAccount): void {
    this.accountPendingRevocation.set(acc);
  }

  closeRevokeModal(): void {
    this.accountPendingRevocation.set(null);
  }

  confirmRevokeAccount(): void {
    const acc = this.accountPendingRevocation();
    if (!acc) return;
    this.dashboardService.deleteTotpAccount(acc.id);
    this.accountPendingRevocation.set(null);
  }

  getQrCodeUrl(acc: TotpAccount): string {
    const uri = buildOtpAuthUri(acc);
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(uri)}`;
  }

  getOtpAuthUri(acc: TotpAccount): string {
    return buildOtpAuthUri(acc);
  }

  selectPreset(preset: AuthenticatorPreset): void {
    this.formIssuer = preset.issuer;
    this.formErrorMessage.set(null);
    this.formSuccessMessage.set(
      `Selected ${preset.issuer}. Enter your account identifier and paste the secret key from ${preset.issuer}.`
    );
  }

  async updatePreviewCode(): Promise<void> {
    const rawSecret = this.formSecret.trim();
    if (!rawSecret) {
      this.previewCode.set(null);
      return;
    }

    // Auto-detect if user pasted otpauth:// URI into secret field
    if (rawSecret.toLowerCase().startsWith('otpauth:')) {
      this.applyOtpAuthUri(rawSecret);
      if (this.formSecret) {
        try {
          const code = await generateTotp(this.formSecret, {
            digits: this.formDigits,
            period: this.formPeriod,
            algorithm: this.formAlgorithm,
          });
          this.previewCode.set(code);
        } catch {}
      }
      return;
    }

    const cleanSecret = rawSecret.replace(/[\s\-:_]/g, '').toUpperCase();
    try {
      base32Decode(cleanSecret);
      const code = await generateTotp(cleanSecret, {
        digits: this.formDigits,
        period: this.formPeriod,
        algorithm: this.formAlgorithm,
      });
      this.previewCode.set(code);
      this.formErrorMessage.set(null);
    } catch {
      this.previewCode.set(null);
    }
  }

  applyOtpAuthUri(uriInput?: string): boolean {
    const raw = (uriInput ?? this.formOtpAuthUri).trim();
    if (!raw) {
      this.formErrorMessage.set('Please enter a secret key or paste an otpauth:// URI.');
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
        `Parsed ${parsed.issuer} (${parsed.accountName}) — ${parsed.digits} digits, ${parsed.algorithm}, ${parsed.period}s.`
      );
      void generateTotp(parsed.secret, {
        digits: parsed.digits,
        period: parsed.period,
        algorithm: parsed.algorithm,
      }).then((code) => {
        this.previewCode.set(code);
      }).catch(() => {
        this.previewCode.set(null);
      });
      return true;
    } catch (err: any) {
      this.formErrorMessage.set(err?.message || 'Could not parse URI or secret key.');
      return false;
    }
  }

  /**
   * Multi-tier QR decoder:
   * 1. Native Chromium BarcodeDetector (GPU-accelerated, handles glare, scale, rotation, dark mode)
   * 2. jsQR on base canvas
   * 3. jsQR on downsampled canvas (max 800px) for high-res desktop screenshots
   * 4. jsQR on center crop (targeting reticle area)
   * 5. jsQR on high-contrast binarized canvas (monitor glare / washed out webcam feed)
   */
  async decodeQrImage(
    source: CanvasImageSource,
    width: number,
    height: number
  ): Promise<string | null> {
    if (width <= 0 || height <= 0) return null;

    // Tier 1: Hardware-accelerated BarcodeDetector if supported in browser
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        if (!this.barcodeDetector) {
          this.barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        }
        const barcodes = await this.barcodeDetector.detect(source);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          return barcodes[0].rawValue;
        }
      } catch {}
    }

    const decodeFn = (jsQR as any)?.default || jsQR;
    if (typeof decodeFn !== 'function') return null;

    const tryJsQrOnCanvas = (c: HTMLCanvasElement): string | null => {
      try {
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx || c.width <= 0 || c.height <= 0) return null;
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const code = decodeFn(imgData.data, c.width, c.height, {
          inversionAttempts: 'attemptBoth',
        });
        return code?.data || null;
      } catch {
        return null;
      }
    };

    // Tier 2: jsQR on base canvas
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = width;
    baseCanvas.height = height;
    const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
    if (!baseCtx) return null;
    baseCtx.drawImage(source, 0, 0, width, height);

    let result = tryJsQrOnCanvas(baseCanvas);
    if (result) return result;

    // Tier 3: Downsampled canvas if image is large (e.g. desktop full-screen screenshots > 800px)
    if (width > 800 || height > 800) {
      const scale = Math.min(800 / width, 800 / height);
      const scaledW = Math.max(10, Math.round(width * scale));
      const scaledH = Math.max(10, Math.round(height * scale));
      const scaledCanvas = document.createElement('canvas');
      scaledCanvas.width = scaledW;
      scaledCanvas.height = scaledH;
      const sCtx = scaledCanvas.getContext('2d', { willReadFrequently: true });
      if (sCtx) {
        sCtx.drawImage(baseCanvas, 0, 0, scaledW, scaledH);
        result = tryJsQrOnCanvas(scaledCanvas);
        if (result) return result;
      }
    }

    // Tier 4: Center crop (targeting zone)
    const cropSize = Math.round(Math.min(width, height) * 0.7);
    if (cropSize >= 50) {
      const cropX = Math.round((width - cropSize) / 2);
      const cropY = Math.round((height - cropSize) / 2);
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropSize;
      cropCanvas.height = cropSize;
      const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
      if (cropCtx) {
        cropCtx.drawImage(baseCanvas, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);
        result = tryJsQrOnCanvas(cropCanvas);
        if (result) return result;
      }
    }

    // Tier 5: High-contrast binarization (helps with monitor glare / washed out webcam feed)
    try {
      const grayData = baseCtx.getImageData(0, 0, width, height);
      const d = grayData.data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
      }
      const avg = sum / (d.length / 4);
      for (let i = 0; i < d.length; i += 4) {
        const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
        const bw = v > avg ? 255 : 0;
        d[i] = bw;
        d[i + 1] = bw;
        d[i + 2] = bw;
      }
      baseCtx.putImageData(grayData, 0, 0);
      result = tryJsQrOnCanvas(baseCanvas);
      if (result) return result;
    } catch {}

    return null;
  }

  handleQrScanSuccess(rawData: string): void {
    this.stopCameraScan();
    this.formOtpAuthUri = rawData;
    if (this.applyOtpAuthUri(rawData)) {
      this.enrollMode.set('manual');
      this.formSuccessMessage.set(
        `Successfully scanned 2FA QR code for ${this.formIssuer || 'application'}!`
      );
    }
  }

  async onQrFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    this.formErrorMessage.set(null);
    this.formSuccessMessage.set(null);

    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image file.'));
        img.src = objectUrl;
      });

      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      const rawData = await this.decodeQrImage(img, width, height);
      URL.revokeObjectURL(objectUrl);

      if (rawData) {
        this.handleQrScanSuccess(rawData);
      } else {
        this.formErrorMessage.set(
          'No QR code detected in this image. Please ensure the QR code is clearly visible and not blurry, or enter the secret key manually.'
        );
      }
    } catch (err: any) {
      this.formErrorMessage.set(
        err?.message || 'Unable to decode QR image. Please paste the secret key manually.'
      );
    }
  }

  async startCameraScan(videoEl?: HTMLVideoElement): Promise<void> {
    this.stopCameraScan();
    this.formErrorMessage.set(null);
    this.formSuccessMessage.set(null);

    const videoElement = videoEl || this.qrVideoRef?.nativeElement;
    if (!videoElement) {
      this.formErrorMessage.set('Webcam video display element is not ready.');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.formErrorMessage.set('Webcam camera access is not supported in this browser environment.');
      return;
    }

    this.isCameraLoading.set(true);

    try {
      try {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
          },
        });
      } catch {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }

      videoElement.srcObject = this.cameraStream;
      videoElement.setAttribute('playsinline', 'true');
      videoElement.muted = true;
      await videoElement.play();

      this.isCameraLoading.set(false);
      this.isCameraActive.set(true);

      const scanLoop = async () => {
        if (!this.isCameraActive()) return;

        try {
          if (
            videoElement.readyState >= (videoElement.HAVE_CURRENT_DATA || 2) &&
            videoElement.videoWidth > 0 &&
            videoElement.videoHeight > 0
          ) {
            // First check native BarcodeDetector if available
            if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
              try {
                if (!this.barcodeDetector) {
                  this.barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
                }
                const barcodes = await this.barcodeDetector.detect(videoElement);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  this.handleQrScanSuccess(barcodes[0].rawValue);
                  return;
                }
              } catch {}
            }

            // Fallback to multi-tier canvas decoding
            if (!this.scanCanvas) {
              this.scanCanvas = document.createElement('canvas');
            }
            const canvas = this.scanCanvas;
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
              const rawData = await this.decodeQrImage(canvas, canvas.width, canvas.height);
              if (rawData) {
                this.handleQrScanSuccess(rawData);
                return;
              }
            }
          }
        } catch {}

        if (this.isCameraActive()) {
          this.scanFrameId = requestAnimationFrame(scanLoop);
        }
      };

      this.scanFrameId = requestAnimationFrame(scanLoop);
    } catch (err: any) {
      this.isCameraLoading.set(false);
      this.isCameraActive.set(false);
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        this.formErrorMessage.set(
          'Camera permission denied. Please allow camera access in your browser or paste the secret key manually.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        this.formErrorMessage.set('No webcam device found on this system. Please enter the secret key manually.');
      } else {
        this.formErrorMessage.set('Could not initialize camera. Please paste the secret key manually.');
      }
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
    this.isCameraLoading.set(false);
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
    const acc = this.activeTotpAccounts().find((a) => a.id === id);
    if (acc) {
      this.openRevokeModal(acc);
    } else {
      this.dashboardService.deleteTotpAccount(id);
    }
  }

  saveAccount(): void {
    // If on URI mode, ensure parsed
    if (this.enrollMode() === 'uri' && this.formOtpAuthUri.trim() && !this.formSecret.trim()) {
      if (!this.applyOtpAuthUri(this.formOtpAuthUri)) {
        return;
      }
    }

    // Auto-detect if user pasted otpauth:// URI into secret input field
    if (this.formSecret.trim().toLowerCase().startsWith('otpauth:')) {
      if (!this.applyOtpAuthUri(this.formSecret.trim())) {
        return;
      }
    }

    const issuer = this.formIssuer.trim();
    const accountName = this.formAccountName.trim() || 'Primary Account';
    const secret = this.formSecret.trim().replace(/[\s\-:_]/g, '').toUpperCase();

    if (!issuer) {
      this.formErrorMessage.set('Service or Application name is required (e.g. GitHub, Google, AWS).');
      return;
    }
    if (!secret) {
      this.formErrorMessage.set('Secret key is required. Paste the setup key from your application.');
      return;
    }

    try {
      base32Decode(secret);
    } catch {
      this.formErrorMessage.set(
        'Invalid Base32 secret key. Allowed characters are letters A-Z and digits 2-7.'
      );
      return;
    }

    const editId = this.editingAccountId();
    if (editId) {
      this.dashboardService.updateTotpAccount(editId, {
        issuer,
        accountName,
        secret,
        digits: this.formDigits,
        period: this.formPeriod,
        algorithm: this.formAlgorithm,
      });
    } else {
      this.dashboardService.addTotpAccount({
        issuer,
        accountName,
        secret,
        digits: this.formDigits,
        period: this.formPeriod,
        algorithm: this.formAlgorithm,
      });
    }

    this.closeAddModal();
  }
}
