import { Component, OnInit, OnDestroy, inject, signal, computed, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService, ApproveSsoPayload, UserProfile, VerifySsoMfaResponse } from '../../services/auth.service';

export type VerificationMethod = 'email_otp' | 'totp' | 'push_approval';

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './verify-otp.component.html',
  styleUrl: './verify-otp.component.css',
})
export class VerifyOtpComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  // State signals
  readonly email = signal<string>('');
  readonly mode = signal<'signup' | 'signin' | 'recovery'>('signup');
  readonly method = signal<VerificationMethod>('email_otp');
  readonly hasTotp = signal<boolean>(false);

  // Push MFA state signals (SCRUM-85)
  readonly numberCode = signal<string>('');
  readonly clientAppIcon = signal<string>('🛡️');
  readonly clientType = signal<'web' | 'mobile'>('web');
  readonly pushSecondsRemaining = signal<number>(60);
  readonly pushStatusText = signal<string>('Waiting for mobile approval...');
  readonly pushRetryCount = signal<number>(0);
  readonly pushRetriesRemaining = signal<number>(3);
  private pushPollInterval: any = null;
  private pushCountdownInterval: any = null;

  // SSO state signals (SCRUM-61)
  readonly challengeId = signal<string | null>(null);
  readonly ssoParams = signal<Record<string, string> | null>(null);
  // Client name as stored in the backend client registry (clientName in the SSO challenge response).
  readonly serverClientName = signal<string | null>(null);
  readonly isSsoVerification = computed<boolean>(() => !!this.challengeId() || !!this.ssoParams());
  readonly clientDisplayName = computed<string>(() => {
    const sso = this.ssoParams();
    if (!sso) return '';
    // The name comes from the server, so this page and the mobile approval prompt show the same name.
    return this.serverClientName() || sso['client_id'] || 'Client Application';
  });
  
  // Dynamic code length: SSO MFA and TOTP are strictly 6 digits; Email OTP for direct portal signup is 8 digits
  readonly codeLength = computed<number>(() => (this.isSsoVerification() || this.method() === 'totp' ? 6 : 8));
  readonly separatorIndex = computed<number>(() => (this.codeLength() === 6 ? 2 : 3));
  readonly digits = signal<string[]>(new Array(6).fill(''));
  
  readonly isLoading = signal<boolean>(false);
  readonly submitted = signal<boolean>(false);
  readonly resendCountdown = signal<number>(0);

  // Notification signal with auto-dismiss
  readonly notification = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  private notificationTimer: any = null;
  private resendInterval: any = null;

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const emailParam = params['email'] || this.authService.pendingEmail() || 'user@vanguard.security';
      const modeParam = (params['mode'] || this.authService.pendingMode() || 'signup') as
        | 'signup'
        | 'signin'
        | 'recovery';
      const hasTotpParam = params['hasTotp'] === 'true';
      const methodParam = (params['method'] || (hasTotpParam ? 'totp' : 'email_otp')) as VerificationMethod;

      this.email.set(emailParam);
      this.mode.set(modeParam);
      this.hasTotp.set(hasTotpParam);
      this.method.set(methodParam);

      if (params['numberCode']) {
        this.numberCode.set(params['numberCode']);
      }
      if (params['appIcon']) {
        this.clientAppIcon.set(params['appIcon']);
      }
      if (params['clientType']) {
        this.clientType.set(params['clientType']);
      }

      if (params['challengeId']) {
        this.challengeId.set(params['challengeId']);
      }

      if (params['clientName'] || params['client_name']) {
        // Display only: the server's client registry name, passed by the login page or backend.
        this.serverClientName.set(params['clientName'] || params['client_name']);
      }
      if (params['client_id'] && params['redirect_uri']) {
        this.ssoParams.set({
          client_id: params['client_id'],
          redirect_uri: params['redirect_uri'],
          response_type: params['response_type'] || 'code',
          scope: params['scope'] || 'openid profile email roles',
          state: params['state'] || '',
          code_challenge: params['code_challenge'] || '',
          code_challenge_method: params['code_challenge_method'] || 'S256',
          nonce: params['nonce'] || '',
        });

        // If SSO params are present but challengeId is missing, auto-initiate challenge
        if (!this.challengeId() && emailParam) {
          this.authService.initiateSsoMfa({
            client_id: params['client_id'],
            redirect_uri: params['redirect_uri'],
            email: emailParam,
            response_type: params['response_type'] || 'code',
            scope: params['scope'] || 'openid profile email roles',
            state: params['state'] || '',
            nonce: params['nonce'] || '',
            code_challenge: params['code_challenge'] || '',
            code_challenge_method: params['code_challenge_method'] || 'S256',
          }).subscribe({
            next: (res) => {
              this.challengeId.set(res.challengeId);
              this.serverClientName.set(res.clientName || null);
              this.startResendTimer(res.resendCooldownSeconds || 60);
            },
            error: (err: Error) => {
              this.showNotification('error', err.message || 'Failed to initiate SSO MFA challenge.');
            },
          });
        }
      }

      if (methodParam === 'push_approval' && this.challengeId()) {
        this.pushRetryCount.set(0);
        this.pushRetriesRemaining.set(3);
        this.startPushPolling(this.challengeId()!);
      } else if (!this.isSsoVerification()) {
        // For non-SSO flows, send initial OTP email on page load
        this.isLoading.set(true);
        
        if (modeParam === 'recovery') {
          // Recovery mode uses forgotPassword
          this.authService.forgotPassword(emailParam).subscribe({
            next: (res) => {
              this.isLoading.set(false);
              this.startResendTimer(60);
              this.clearOtpInputs();
            },
            error: (err: Error) => {
              this.isLoading.set(false);
              this.showNotification('error', err.message || 'Failed to send recovery code.');
              this.startResendTimer(30);
            },
          });
        } else {
          // Signup/signin modes use resendOtp
          const otpType = modeParam === 'signup' ? 'signup' : 'signin';
          this.authService.resendOtp(emailParam, otpType).subscribe({
            next: (res) => {
              this.isLoading.set(false);
              this.startResendTimer(45);
              this.clearOtpInputs();
            },
            error: (err: Error) => {
              this.isLoading.set(false);
              this.showNotification('error', err.message || 'Failed to send verification code.');
              this.startResendTimer(30);
            },
          });
        }
      } else {
        // SSO flows already handled above in initiateSsoMfa call
        this.clearOtpInputs();
        this.startResendTimer(this.isSsoVerification() ? 60 : 30);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    if (this.resendInterval) clearInterval(this.resendInterval);
    if (this.pushPollInterval) clearInterval(this.pushPollInterval);
    if (this.pushCountdownInterval) clearInterval(this.pushCountdownInterval);
  }

  startPushPolling(challengeId: string): void {
    this.clearTimers();
    this.pushSecondsRemaining.set(60);
    this.pushStatusText.set('Waiting for mobile approval...');

    // Countdown timer
    this.pushCountdownInterval = setInterval(() => {
      const current = this.pushSecondsRemaining();
      if (current <= 1) {
        clearInterval(this.pushCountdownInterval);
        this.pushSecondsRemaining.set(0);
        this.pushStatusText.set('Push verification challenge expired');
        this.showNotification('error', 'Push verification expired. Please try again or switch to Email code.');
      } else {
        this.pushSecondsRemaining.set(current - 1);
      }
    }, 1000);

    // Status polling loop (every 1.5 seconds)
    this.pushPollInterval = setInterval(() => {
      this.authService.checkPushStatus(challengeId).subscribe({
        next: (res) => {
          if (res.status === 'approved') {
            clearInterval(this.pushPollInterval);
            clearInterval(this.pushCountdownInterval);
            this.pushStatusText.set('Identity Approved! Redirecting...');
            this.handleSsoRedirect({ code: res.code, redirectUrl: res.redirectUrl });
          } else if (res.status === 'denied') {
            clearInterval(this.pushPollInterval);
            clearInterval(this.pushCountdownInterval);
            this.pushStatusText.set('Sign-in rejected on mobile device');
            this.showNotification('error', 'Sign-in request was declined on your mobile device.');
          } else if (res.status === 'fraud_reported') {
            clearInterval(this.pushPollInterval);
            clearInterval(this.pushCountdownInterval);
            this.pushStatusText.set('Sign-in blocked (Fraud reported)');
            this.showNotification('error', 'Security Alert: Sign-in was flagged as unauthorized. Session blocked.');
          } else if (res.status === 'expired') {
            clearInterval(this.pushPollInterval);
            clearInterval(this.pushCountdownInterval);
            this.pushStatusText.set('Push verification expired');
            this.showNotification('error', 'Push verification challenge expired.');
          }
        },
      });
    }, 1500);
  }

  switchToEmailOtp(): void {
    this.clearTimers();
    const sso = this.ssoParams();
    const email = this.email();

    if (!sso || !email) {
      this.method.set('email_otp');
      this.clearOtpInputs();
      return;
    }

    this.isLoading.set(true);
    this.authService.initiateSsoMfa({
      client_id: sso['client_id'],
      redirect_uri: sso['redirect_uri'],
      email,
      response_type: sso['response_type'] || 'code',
      scope: sso['scope'] || 'openid profile email roles',
      state: sso['state'] || '',
      nonce: sso['nonce'] || '',
      code_challenge: sso['code_challenge'] || '',
      code_challenge_method: sso['code_challenge_method'] || 'S256',
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.challengeId.set(res.challengeId);
        this.serverClientName.set(res.clientName || null);
        this.method.set('email_otp');
        this.clearOtpInputs();
        this.startResendTimer(res.resendCooldownSeconds || 60);
        this.showNotification('success', 'Switched to Email OTP. Enter the 6-digit verification code sent to your email.', 4000);
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.showNotification('error', err.message || 'Failed to dispatch Email OTP.');
      },
    });
  }

  openAuthenticatorApp(): void {
    const id = this.challengeId();
    const deepLink = id ? `vanguard-auth://mfa/challenge?id=${encodeURIComponent(id)}` : 'vanguard-auth://mfa';
    const webAuthUrl = 'http://localhost:8082';

    this.showNotification('success', 'Opening Vanguard Authenticator...', 2500);

    if (typeof window !== 'undefined') {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        // Attempt opening custom protocol scheme on native mobile
        window.location.href = deepLink;
        setTimeout(() => {
          window.open(webAuthUrl, '_blank');
        }, 1200);
      } else {
        // On desktop/laptop web browsers, launch the mobile-vanguard authenticator instance
        window.open(webAuthUrl, '_blank');
      }
    }
  }

  retryPushChallenge(): void {
    const challengeId = this.challengeId();
    if (!challengeId) return;

    this.isLoading.set(true);
    this.authService.retryPushChallenge(challengeId).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.numberCode.set(res.numberMatching.code.toString());
        this.pushRetryCount.set(res.retryCount);
        this.pushRetriesRemaining.set(res.retriesRemaining);
        this.pushSecondsRemaining.set(res.expiresInSeconds);
        this.pushStatusText.set('Waiting for mobile approval...');
        this.showNotification('success', res.message, 4000);
        // Restart polling with fresh 60-second window
        this.startPushPolling(challengeId);
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.showNotification('error', err.message || 'Failed to retry push challenge.');
      },
    });
  }

  setMethod(newMethod: VerificationMethod): void {
    this.method.set(newMethod);
    this.clearOtpInputs();
    if (newMethod === 'totp') {
      this.showNotification('success', 'Switched to Authenticator App mode. Enter the 6-digit code from your app.', 4000);
    } else {
      const len = this.codeLength();
      this.showNotification('success', `Switched to Email OTP mode. Enter the ${len}-digit code sent to your email.`, 4000);
    }
  }

  clearOtpInputs(): void {
    const len = this.codeLength();
    this.digits.set(new Array(len).fill(''));
    setTimeout(() => {
      const firstInput = this.otpInputs?.first?.nativeElement;
      if (firstInput) firstInput.focus();
    }, 50);
  }

  onDigitInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, ''); // Keep only numeric
    const currentDigits = [...this.digits()];
    const len = this.codeLength();

    if (value.length > 0) {
      currentDigits[index] = value.charAt(value.length - 1);
      this.digits.set(currentDigits);

      // Auto-advance to next box
      if (index < len - 1) {
        const nextInput = this.otpInputs.toArray()[index + 1]?.nativeElement;
        if (nextInput) nextInput.focus();
      }
    } else {
      currentDigits[index] = '';
      this.digits.set(currentDigits);
    }

    // Auto submit if all digits entered
    if (this.digits().length === len && this.digits().every((d) => d.length === 1)) {
      this.onSubmit();
    }
  }

  onKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      const currentDigits = [...this.digits()];
      if (!currentDigits[index] && index > 0) {
        const prevInput = this.otpInputs.toArray()[index - 1]?.nativeElement;
        if (prevInput) {
          prevInput.focus();
          currentDigits[index - 1] = '';
          this.digits.set(currentDigits);
        }
      } else {
        currentDigits[index] = '';
        this.digits.set(currentDigits);
      }
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const len = this.codeLength();
    const numericData = pastedData.replace(/\D/g, '').slice(0, len);

    if (numericData.length > 0) {
      const currentDigits = new Array(len).fill('');
      for (let i = 0; i < numericData.length; i++) {
        currentDigits[i] = numericData[i];
      }
      this.digits.set(currentDigits);

      const targetIndex = Math.min(numericData.length, len - 1);
      const targetInput = this.otpInputs.toArray()[targetIndex]?.nativeElement;
      if (targetInput) targetInput.focus();

      if (numericData.length === len) {
        this.onSubmit();
      }
    }
  }

  startResendTimer(seconds: number): void {
    if (this.resendInterval) clearInterval(this.resendInterval);
    this.resendCountdown.set(seconds);

    this.resendInterval = setInterval(() => {
      const current = this.resendCountdown();
      if (current > 1) {
        this.resendCountdown.set(current - 1);
      } else {
        this.resendCountdown.set(0);
        clearInterval(this.resendInterval);
      }
    }, 1000);
  }

  onResendOtp(): void {
    if (this.resendCountdown() > 0 || this.isLoading()) return;

    this.isLoading.set(true);
    const email = this.email();

    // 1. SSO MFA Resend Mode (SCRUM-61: 60-second cooldown throttle)
    if (this.isSsoVerification() && this.challengeId()) {
      this.authService.resendSsoOtp({ challengeId: this.challengeId()! }).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.showNotification(
            'success',
            res.message || 'New 6-digit verification code dispatched!',
            5000,
          );
          this.startResendTimer(res.resendCooldownSeconds || 60);
          this.clearOtpInputs();
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.showNotification('error', err.message || 'Failed to resend SSO verification code.');
        },
      });
      return;
    }

    if (this.mode() === 'recovery') {
      this.authService.forgotPassword(email).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.showNotification(
            'success',
            res.message || 'New recovery code dispatched to your email!',
            5000
          );
          this.startResendTimer(60);
          this.clearOtpInputs();
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.showNotification('error', err.message || 'Failed to resend recovery code. Please try again.');
        },
      });
      return;
    }

    const type = this.mode() === 'signup' ? 'signup' : 'signin';

    this.authService.resendOtp(email, type).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.showNotification('success', res.message || 'New verification code dispatched to your email!', 5000);
        this.startResendTimer(45);
        this.clearOtpInputs();
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.showNotification('error', err.message || 'Failed to resend code. Please try again.');
      },
    });
  }

  showNotification(type: 'success' | 'error', message: string, durationMs = 5000): void {
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    this.notification.set({ type, message });

    this.notificationTimer = setTimeout(() => {
      this.dismissNotification();
    }, durationMs);
  }

  dismissNotification(): void {
    if (this.notificationTimer) clearTimeout(this.notificationTimer);
    this.notification.set(null);
  }

  onSubmit(): void {
    const code = this.digits().join('');
    const len = this.codeLength();

    if (code.length < len) {
      this.showNotification('error', `Please enter the complete ${len}-digit verification code.`);
      return;
    }

    this.isLoading.set(true);
    const email = this.email();
    const currentMethod = this.method();

    // 1. SSO MFA Verification Mode (SCRUM-61)
    if (this.isSsoVerification() && this.challengeId()) {
      this.authService.verifySsoMfa({
        challengeId: this.challengeId()!,
        code,
        method: currentMethod,
      }).subscribe({
        next: (res) => {
          this.handleSsoRedirect(res);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.showNotification('error', err.message || 'Invalid or expired SSO verification code.');
        },
      });
      return;
    }

    if (currentMethod === 'totp') {
      this.authService.verifyTotp(email, code).subscribe({
        next: (res) => {
          this.handleVerificationSuccess(res?.user);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.showNotification('error', err.message || 'Invalid authenticator code. Please check your app.');
        },
      });
    } else if (this.mode() === 'recovery') {
      this.authService.verifyOtp(email, code, 'recovery').subscribe({
        next: () => {
          this.isLoading.set(false);
          this.showNotification('success', 'Recovery code verified! Redirecting to reset password...', 3000);
          setTimeout(() => {
            this.router.navigate(['/reset-password']);
          }, 800);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.showNotification('error', err.message || 'Invalid or expired recovery code.');
        },
      });
    } else {
      const otpType = this.mode() === 'signup' ? 'signup' : 'email';
      this.authService.verifyOtp(email, code, otpType).subscribe({
        next: (res) => {
          this.handleVerificationSuccess(res?.user);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.showNotification('error', err.message || 'Invalid or expired verification code.');
        },
      });
    }
  }

  private handleSsoRedirect(res: { code?: string; redirectUrl?: string; message?: string }): void {
    const sso = this.ssoParams();
    this.isLoading.set(true);
    this.showNotification('success', 'Identity and 2FA verified! Authorizing access to client application...', 4000);

    try {
      if (sso) {
        const originUrl = new URL(sso['redirect_uri']).origin;
        const stored = JSON.parse(localStorage.getItem('vanguard_connected_apps') || '[]');
        const appName = this.clientDisplayName();
        const newConn = {
          id: `conn_${sso['client_id']}`,
          clientId: sso['client_id'],
          clientName: appName,
          protocol: 'OpenID Connect 1.0 (PKCE)',
          scopes: (sso['scope'] || 'openid profile email roles').split(' '),
          redirectUri: sso['redirect_uri'],
          originUrl,
          status: 'Connected' as const,
          connectedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          lastActiveAt: 'Active Session',
          icon: '🌐',
          description: `${appName} integrated via Vanguard SSO with account ${this.email()}.`,
        };
        const normOrigin = originUrl.toLowerCase().trim().replace(/\/$/, '');
        const filtered = stored.filter((c: any) => {
          const cOrigin = (c.originUrl || '').toLowerCase().trim().replace(/\/$/, '');
          return c.clientId !== sso['client_id'] && (!normOrigin || cOrigin !== normOrigin) && c.clientName !== appName;
        });
        localStorage.setItem('vanguard_connected_apps', JSON.stringify([newConn, ...filtered]));
      }
    } catch {}

    if (res.redirectUrl) {
      window.location.href = res.redirectUrl;
    } else if (sso) {
      window.location.href = `${sso['redirect_uri']}?code=${res.code}${sso['state'] ? '&state=' + encodeURIComponent(sso['state']) : ''}`;
    }
  }

  private resolveUserFullName(user?: UserProfile | null, fallbackEmail?: string): string {
    const meta = (user as any)?.user_metadata || {};
    const firstName = user?.firstName || meta['first_name'] || meta['firstName'] || meta['given_name'] || '';
    const lastName = user?.lastName || meta['last_name'] || meta['lastName'] || meta['family_name'] || '';
    const combined = `${firstName} ${lastName}`.trim();
    if (combined) return combined;

    if (user?.name && user.name.trim()) return user.name.trim();
    if (meta['name'] && typeof meta['name'] === 'string' && meta['name'].trim()) {
      return meta['name'].trim();
    }

    const email = user?.email || fallbackEmail || '';
    if (typeof window !== 'undefined' && email) {
      try {
        const storedDir = localStorage.getItem('vanguard_directory_users');
        if (storedDir) {
          const dirUsers: any[] = JSON.parse(storedDir);
          const match = dirUsers.find((d) => d.email?.toLowerCase().trim() === email.toLowerCase().trim());
          if (match?.name?.trim()) return match.name.trim();
        }
      } catch {}
    }

    return email ? email.split('@')[0] : 'Enterprise User';
  }

  private handleVerificationSuccess(user?: UserProfile): void {
    const sso = this.ssoParams();
    if (sso && sso['client_id'] && sso['redirect_uri']) {
      this.isLoading.set(true);
      this.showNotification('success', 'Identity and 2FA verified! Authorizing access to client application...', 4000);

      const currentUser = user || this.authService.currentUser();
      const email = currentUser?.email || this.email();
      const fullName = this.resolveUserFullName(currentUser, email);
      const role = currentUser?.role || 'user';
      const dept = currentUser?.user_metadata?.['department'] || 'Corporate Security';

      const payload: ApproveSsoPayload = {
        client_id: sso['client_id'],
        redirect_uri: sso['redirect_uri'],
        response_type: sso['response_type'] || 'code',
        scope: sso['scope'] || 'openid profile email roles',
        state: sso['state'] || '',
        nonce: sso['nonce'] || '',
        code_challenge: sso['code_challenge'] || '',
        code_challenge_method: sso['code_challenge_method'] || 'S256',
        email: currentUser?.email || this.email(),
        name: fullName,
        role: role,
        roles: [role, 'Vanguard Authenticated'],
        department: dept,
        userId: currentUser?.id,
      };

      this.authService.approveSsoAuthorization(payload).subscribe({
        next: (res) => {
          this.handleSsoRedirect(res);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.showNotification('error', err.message || 'SSO authorization failed.');
        },
      });
      return;
    }

    this.isLoading.set(false);
    this.showNotification('success', 'Verification successful! Redirecting to secure vault...', 3000);
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 800);
  }

  onCancelSso(): void {
    const sso = this.ssoParams();
    if (!sso) return;

    try {
      const redirectUri = new URL(sso['redirect_uri']);
      redirectUri.searchParams.set('error', 'access_denied');
      redirectUri.searchParams.set('error_description', 'User cancelled MFA verification for Vanguard SSO');
      if (sso['state']) {
        redirectUri.searchParams.set('state', sso['state']);
      }
      window.location.href = redirectUri.toString();
    } catch {
      window.location.href = `${sso['redirect_uri']}?error=access_denied&error_description=User+cancelled+MFA+verification+for+Vanguard+SSO${sso['state'] ? '&state=' + encodeURIComponent(sso['state']) : ''}`;
    }
  }
}
