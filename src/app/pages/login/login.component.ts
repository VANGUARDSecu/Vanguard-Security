import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService, ApproveSsoPayload, UserProfile } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Form group definition
  readonly loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false],
  });

  // State signals
  readonly showPassword = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly submitted = signal<boolean>(false);

  // SSO state signals
  readonly ssoParams = signal<Record<string, string> | null>(null);
  readonly currentUser = this.authService.currentUser;

  readonly clientDisplayName = computed<string>(() => {
    const sso = this.ssoParams();
    if (!sso) return '';
    return sso['client_name'] || sso['clientName'] || sso['client_id'] || 'Client Application';
  });

  readonly isAccountMismatch = computed<boolean>(() => {
    const sso = this.ssoParams();
    const user = this.currentUser();
    const hint = sso?.['login_hint'];
    if (!sso || !hint || !user) return false;
    return user.email.toLowerCase().trim() !== hint.toLowerCase().trim();
  });

  // Single timed notification state with auto-dismiss
  readonly notification = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  private notificationTimer: any = null;

  ngOnInit(): void {
    // Check if URL contains SSO/OIDC parameters
    this.route.queryParams.subscribe((params) => {
      if (params['client_id'] && params['redirect_uri']) {
        const ssoData = {
          client_id: params['client_id'],
          client_name: params['client_name'] || params['clientName'] || '',
          redirect_uri: params['redirect_uri'],
          response_type: params['response_type'] || 'code',
          scope: params['scope'] || 'openid profile email roles',
          state: params['state'] || '',
          code_challenge: params['code_challenge'] || '',
          code_challenge_method: params['code_challenge_method'] || 'S256',
          nonce: params['nonce'] || '',
          login_hint: params['login_hint'] || '',
          prompt: params['prompt'] || '',
        };
        this.ssoParams.set(ssoData);

        // Pre-fill email from login_hint if provided and not yet authenticated
        if (!this.authService.isLoggedIn() && params['login_hint']) {
          this.loginForm.patchValue({ email: params['login_hint'] });
        }
      }

      // If user is already logged in:
      // If NOT SSO, redirect straight to dashboard
      // If SSO, stay on login page to prompt one-click approval or switch account
      if (this.authService.isLoggedIn() && !this.ssoParams()) {
        const user = this.authService.currentUser();
        const meta = user?.user_metadata || {};
        const isTemp = meta['is_temporary_password'] === true || meta['isTemporaryPassword'] === true;
        if (!isTemp) {
          this.authService.isPasswordResetRequired.set(false);
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('vanguard_reset_required');
          }
        }
        this.router.navigate(['/dashboard']);
        return;
      }
    });

    // Pre-fill remembered email if cached (and not already filled from login_hint)
    const rememberedEmail = this.authService.getRememberedEmail();
    if (rememberedEmail && !this.loginForm.get('email')?.value) {
      this.loginForm.patchValue({
        email: rememberedEmail,
        rememberMe: true,
      });
    }
  }

  togglePassword(): void {
    this.showPassword.update((val) => !val);
  }

  toggleRememberMe(): void {
    const current = this.loginForm.get('rememberMe')?.value;
    this.loginForm.patchValue({ rememberMe: !current });
  }

  showNotification(type: 'success' | 'error', message: string, durationMs = 5000): void {
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }

    this.notification.set({ type, message });

    this.notificationTimer = setTimeout(() => {
      this.dismissNotification();
    }, durationMs);
  }

  dismissNotification(): void {
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }
    this.notification.set(null);
  }

  onSubmit(): void {
    this.submitted.set(true);

    if (this.loginForm.invalid) {
      this.showNotification('error', 'Please fill in all required fields properly.');
      return;
    }

    // Clear stale reset-required flag upon fresh login attempt
    this.authService.isPasswordResetRequired.set(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('vanguard_reset_required');
    }

    this.isLoading.set(true);
    const { email, password, rememberMe } = this.loginForm.value;
    const sso = this.ssoParams();

    this.authService.login({ email: email.trim(), password, isSso: !!sso }).subscribe({
      next: (response) => {
        this.isLoading.set(false);

        // Handle Remember Me caching
        if (rememberMe) {
          this.authService.setRememberedEmail(email.trim());
        } else {
          this.authService.clearRememberedEmail();
        }

        if (sso) {
          // Mandatory SSO MFA Enforcement (SCRUM-61)
          this.initiateSsoMfaForUser(response.user, response.hasTotp);
        } else if (response.requireMfa) {
          this.showNotification('success', 'Credentials verified! Redirecting to 2-Step Verification...', 3000);
          setTimeout(() => {
            this.router.navigate(['/verify-otp'], {
              queryParams: {
                email: email.trim(),
                mode: 'signin',
                hasTotp: response.hasTotp ? 'true' : 'false',
              },
            });
          }, 600);
        } else {
          this.showNotification('success', 'Login successful! Redirecting...', 3000);
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 600);
        }
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.showNotification('error', err.message || 'Invalid email or password.');
      },
    });
  }

  onContinueSso(): void {
    const user = this.currentUser();
    if (user) {
      this.initiateSsoMfaForUser(user);
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

  initiateSsoMfaForUser(user?: UserProfile, hasTotp = false): void {
    const sso = this.ssoParams();
    if (!sso) return;

    this.isLoading.set(true);
    this.showNotification('success', 'Credentials verified! Initiating SSO Multi-Factor Authentication challenge...', 3000);

    const currentUser = user || this.authService.currentUser();
    const email = currentUser?.email || this.loginForm.get('email')?.value?.trim();
    const fullName = this.resolveUserFullName(currentUser, email);
    const role = currentUser?.role || 'user';
    const dept = currentUser?.user_metadata?.['department'] || 'Corporate Security';

    this.authService.getPushMfaPreference(email).subscribe({
      next: (pref) => {
        if (pref.enabled !== false) {
          // Push MFA is enabled: initiate out-of-band push challenge
          this.authService.initiatePushMfa({
            client_id: sso['client_id'],
            redirect_uri: sso['redirect_uri'],
            email,
            userId: currentUser?.id,
            name: fullName,
            role,
            department: dept,
            response_type: sso['response_type'] || 'code',
            scope: sso['scope'] || 'openid profile email roles',
            state: sso['state'] || '',
            nonce: sso['nonce'] || '',
            code_challenge: sso['code_challenge'] || '',
            code_challenge_method: sso['code_challenge_method'] || 'S256',
          }).subscribe({
            next: (pushRes) => {
              this.isLoading.set(false);
              const queryParams: any = {
                challengeId: pushRes.challengeId,
                email: pushRes.email,
                mode: 'signin',
                method: 'push_approval',
                numberCode: pushRes.numberMatching?.code?.toString() || '',
                clientName: pushRes.clientName,
                clientType: pushRes.clientType,
                appIcon: pushRes.appIcon || '🛡️',
                hasTotp: hasTotp ? 'true' : 'false',
              };
              Object.assign(queryParams, sso);
              this.router.navigate(['/verify-otp'], { queryParams });
            },
            error: () => {
              // Fallback to standard email OTP if push challenge initiation errors
              this.fallbackToEmailOtp(sso, email, currentUser, fullName, role, dept, hasTotp);
            },
          });
        } else {
          this.fallbackToEmailOtp(sso, email, currentUser, fullName, role, dept, hasTotp);
        }
      },
      error: () => {
        this.fallbackToEmailOtp(sso, email, currentUser, fullName, role, dept, hasTotp);
      },
    });
  }

  private fallbackToEmailOtp(
    sso: Record<string, string>,
    email: string,
    currentUser: UserProfile | null | undefined,
    fullName: string,
    role: string,
    dept: string,
    hasTotp: boolean,
  ): void {
    this.authService.initiateSsoMfa({
      client_id: sso['client_id'],
      redirect_uri: sso['redirect_uri'],
      email,
      userId: currentUser?.id,
      name: fullName,
      role,
      department: dept,
      response_type: sso['response_type'] || 'code',
      scope: sso['scope'] || 'openid profile email roles',
      state: sso['state'] || '',
      nonce: sso['nonce'] || '',
      code_challenge: sso['code_challenge'] || '',
      code_challenge_method: sso['code_challenge_method'] || 'S256',
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const queryParams: any = {
          challengeId: res.challengeId,
          email: res.email,
          clientName: res.clientName || this.clientDisplayName(),
          mode: 'signin',
          method: 'email_otp',
          hasTotp: hasTotp ? 'true' : 'false',
        };
        Object.assign(queryParams, sso);
        this.router.navigate(['/verify-otp'], { queryParams });
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.showNotification('error', err.message || 'Failed to initiate SSO MFA challenge.');
      },
    });
  }

  approveSsoForUser(user?: UserProfile): void {
    const sso = this.ssoParams();
    if (!sso) return;

    this.isLoading.set(true);
    this.showNotification('success', 'Authorizing SSO access to application...', 4000);

    const currentUser = user || this.authService.currentUser();
    const email = currentUser?.email || this.loginForm.get('email')?.value?.trim();
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
      email: currentUser?.email || this.loginForm.get('email')?.value?.trim(),
      name: fullName,
      role: role,
      roles: [role, 'Vanguard Authenticated'],
      department: dept,
      userId: currentUser?.id,
    };

    this.authService.approveSsoAuthorization(payload).subscribe({
      next: (res) => {
        try {
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
            status: 'Connected',
            connectedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            lastActiveAt: 'Active Session',
            icon: '🌐',
            description: `${appName} integrated via Vanguard SSO with account ${payload.email}.`,
          };
          const normOrigin = originUrl.toLowerCase().trim().replace(/\/$/, '');
          const filtered = stored.filter((c: any) => {
            const cOrigin = (c.originUrl || '').toLowerCase().trim().replace(/\/$/, '');
            return c.clientId !== sso['client_id'] && (!normOrigin || cOrigin !== normOrigin) && c.clientName !== appName;
          });
          localStorage.setItem('vanguard_connected_apps', JSON.stringify([newConn, ...filtered]));
        } catch {}

        if (res.redirectUrl) {
          window.location.href = res.redirectUrl;
        } else {
          window.location.href = `${sso['redirect_uri']}?code=${res.code}${sso['state'] ? '&state=' + encodeURIComponent(sso['state']) : ''}`;
        }
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.showNotification('error', err.message || 'Failed to authorize SSO session.');
      },
    });
  }

  switchAccount(): void {
    const sso = this.ssoParams();
    const hint = sso?.['login_hint'];
    this.authService.logout();
    if (sso) {
      setTimeout(() => {
        this.router.navigate(['/login'], { queryParams: sso });
        if (hint) {
          this.loginForm.patchValue({ email: hint });
        }
      }, 50);
    }
  }

  onCancelSso(): void {
    const sso = this.ssoParams();
    if (!sso) return;

    try {
      const redirectUri = new URL(sso['redirect_uri']);
      redirectUri.searchParams.set('error', 'access_denied');
      redirectUri.searchParams.set('error_description', 'User cancelled Vanguard SSO authentication');
      if (sso['state']) {
        redirectUri.searchParams.set('state', sso['state']);
      }
      window.location.href = redirectUri.toString();
    } catch {
      window.location.href = `${sso['redirect_uri']}?error=access_denied&error_description=User+cancelled+Vanguard+SSO+authentication${sso['state'] ? '&state=' + encodeURIComponent(sso['state']) : ''}`;
    }
  }

  onGoogleLogin(): void {
    this.showNotification('success', 'Connecting to Google Authentication...', 6000);
    this.authService.getGoogleOAuthUrl().subscribe({
      next: (response) => {
        if (response.url) {
          window.location.href = response.url;
        } else {
          this.showNotification('error', 'Google authentication URL was not received.');
        }
      },
      error: (err: Error) => {
        this.showNotification('error', err.message || 'Google login is currently unavailable.');
      },
    });
  }
}
