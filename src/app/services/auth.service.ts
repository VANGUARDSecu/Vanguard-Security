import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap, throwError, finalize, shareReplay } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { environment } from '../../environments/environment';
import { UserConnectedApp } from '../pages/dashboard/models/dashboard.models';

export interface UserProfile {
  id?: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  role?: 'admin' | 'security_officer' | 'user';
  accountType?: 'individual' | 'company';
  isTemporaryPassword?: boolean;
  avatarUrl?: string;
  user_metadata?: Record<string, any>;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  phone?: string;
  accountType?: 'individual' | 'company';
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  requireOtp?: boolean;
  requireMfa?: boolean;
  hasTotp?: boolean;
  enrolledMethods?: string[];
  user?: UserProfile;
  session?: AuthSession;
}

export interface ApproveSsoPayload {
  client_id: string;
  redirect_uri: string;
  response_type?: string;
  scope?: string;
  state?: string;
  nonce?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  email: string;
  name?: string;
  role?: string;
  roles?: string[];
  department?: string;
  userId?: string;
}

export interface ApproveSsoResponse {
  success: boolean;
  code: string;
  redirectUrl: string;
}

export interface InitiateSsoMfaPayload {
  client_id: string;
  redirect_uri: string;
  email: string;
  userId?: string;
  response_type?: string;
  scope?: string;
  state?: string;
  nonce?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  name?: string;
  role?: string;
  department?: string;
}

export interface InitiateSsoMfaResponse {
  success: boolean;
  challengeId: string;
  email: string;
  clientId: string;
  clientName: string;
  redirectUri: string;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
  message: string;
}

export interface VerifySsoMfaPayload {
  challengeId: string;
  code: string;
  method?: 'email_otp' | 'totp' | 'push_approval' | 'frontend_approval';
}

export interface VerifySsoMfaResponse {
  success: boolean;
  message: string;
  code: string;
  redirectUrl: string;
}

export interface ResendSsoOtpPayload {
  challengeId: string;
}

export interface ResendSsoOtpResponse {
  success: boolean;
  message: string;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
}

export interface InitiatePushMfaPayload extends InitiateSsoMfaPayload {}

export interface InitiatePushMfaResponse {
  success: boolean;
  challengeId: string;
  email: string;
  clientId: string;
  clientName: string;
  clientType: 'web' | 'mobile';
  appIcon?: string;
  numberMatching: {
    enabled: boolean;
    code: number;
  };
  expiresInSeconds: number;
  message: string;
}

export interface PushStatusResponse {
  success: boolean;
  challengeId: string;
  status: 'pending' | 'approved' | 'denied' | 'fraud_reported' | 'expired' | 'not_found';
  verified?: boolean;
  code?: string;
  redirectUrl?: string;
  resolutionReason?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly API_URL = `${environment.apiUrl}/auth`;
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly supabaseService = inject(SupabaseService);

  // Signals for state management
  readonly currentUser = signal<UserProfile | null>(this.loadStoredUser());
  readonly token = signal<string | null>(this.loadStoredToken());
  readonly refreshToken = signal<string | null>(this.loadStoredRefreshToken());
  readonly tokenExpiresAt = signal<number | null>(this.loadStoredExpiresAt());

  // Proactive token auto-renewal (SCRUM-142 / NFR-02 300s TTL)
  private refreshInFlight$: Observable<AuthResponse> | null = null;
  private autoRefreshTimer: any = null;
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isPasswordResetRequired = signal<boolean>(this.loadStoredResetRequired());

  readonly userRole = computed<'admin' | 'security_officer' | 'user'>(() => {
    const u = this.currentUser();
    const r = u?.role || (u?.user_metadata?.['role'] as any);
    if (r === 'admin' || r === 'Super Administrator') return 'admin';
    if (r === 'security_officer' || r === 'Security Officer') return 'security_officer';
    return 'user';
  });

  readonly isAdmin = computed<boolean>(() => {
    const r = this.userRole();
    return r === 'admin' || r === 'security_officer';
  });

  // Transient state for multi-step OTP / MFA / Recovery flow
  readonly pendingEmail = signal<string>('');
  readonly pendingMode = signal<'signup' | 'signin' | 'recovery'>('signup');

  constructor() {
    this.checkForOAuthCallback();
    this.initSessionAutoRefresh();
  }

  private loadStoredUser(): UserProfile | null {
    if (!this.isBrowser) return null;
    try {
      const stored = localStorage.getItem('vanguard_user');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      const meta = parsed.user_metadata || {};
      let role: 'admin' | 'security_officer' | 'user' = 'user';
      if (parsed.role === 'admin' || meta['role'] === 'admin') {
        role = 'admin';
      } else if (parsed.role === 'security_officer' || meta['role'] === 'security_officer') {
        role = 'security_officer';
      }
      const rawAccountType = parsed.accountType || meta['account_type'];
      const isTenant = Boolean(meta['tenant_id'] || meta['account_type'] === 'company' || parsed.accountType === 'company');
      const accountType: 'individual' | 'company' =
        rawAccountType === 'individual'
          ? 'individual'
          : (isTenant || role === 'admin' ? 'company' : 'individual');
      const isTemporaryPassword = Boolean(
        parsed.isTemporaryPassword ||
        meta['is_temporary_password'] === true ||
        meta['isTemporaryPassword'] === true
      );

      return {
        ...parsed,
        firstName: parsed.firstName || meta['first_name'] || meta['firstName'] || meta['given_name'] || meta['name']?.split(' ')[0] || '',
        lastName: parsed.lastName || meta['last_name'] || meta['lastName'] || meta['family_name'] || meta['name']?.split(' ').slice(1).join(' ') || '',
        companyName: parsed.companyName || meta['company_name'] || meta['companyName'] || 'Vanguard Security Inc.',
        phone: parsed.phone || meta['phone'] || '',
        role,
        accountType,
        isTemporaryPassword,
        avatarUrl: parsed.avatarUrl || meta['avatar_url'] || meta['picture'] || '',
      };
    } catch {
      return null;
    }
  }

  private loadStoredToken(): string | null {
    if (!this.isBrowser) return null;
    try {
      return localStorage.getItem('vanguard_token');
    } catch {
      return null;
    }
  }

  private loadStoredRefreshToken(): string | null {
    if (!this.isBrowser) return null;
    try {
      return localStorage.getItem('vanguard_refresh_token');
    } catch {
      return null;
    }
  }

  private loadStoredExpiresAt(): number | null {
    if (!this.isBrowser) return null;
    try {
      const val = localStorage.getItem('vanguard_token_expires_at');
      return val ? parseInt(val, 10) : null;
    } catch {
      return null;
    }
  }

  private loadStoredResetRequired(): boolean {
    if (!this.isBrowser) return false;
    try {
      const isRecoveryUrl =
        window.location.search.includes('type=recovery') ||
        window.location.hash.includes('type=recovery');
      if (isRecoveryUrl) {
        return true;
      }

      const user = this.loadStoredUser();
      if (user) {
        const meta = user.user_metadata || {};
        const isTemp = meta['is_temporary_password'] === true || meta['isTemporaryPassword'] === true;
        if (!isTemp) {
          localStorage.removeItem('vanguard_reset_required');
          return false;
        }
        return true;
      }

      // If no active user session and not in recovery URL, clear any stale flag
      localStorage.removeItem('vanguard_reset_required');
      return false;
    } catch {
      return false;
    }
  }

  private isOAuthChallenging = false;

  get isChallengingOAuth(): boolean {
    return this.isOAuthChallenging;
  }

  /**
   * Safely decodes base64url-encoded JWT payloads without throwing InvalidCharacterError
   */
  parseJwtPayload(token: string): Record<string, any> {
    try {
      if (!token) return {};
      const parts = token.split('.');
      if (parts.length < 2) return {};
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) {
        base64 += '=';
      }
      const jsonStr = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonStr) || {};
    } catch (e) {
      console.warn('Failed to parse JWT payload:', e);
      return {};
    }
  }

  private checkForOAuthCallback(): void {
    if (!this.isBrowser) return;

    try {
      // 1. Check URL Hash (e.g. #access_token=... from Google OAuth or email confirmation)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken) {
          const payload = this.parseJwtPayload(accessToken);
          let email = (payload['email'] || '').trim().toLowerCase();
          let userId = payload['sub'] || ('vanguard_user_' + Date.now());
          const meta: Record<string, any> = payload['user_metadata'] || {};
          const firstName =
            meta['full_name']?.split(' ')[0] ||
            meta['name']?.split(' ')[0] ||
            meta['first_name'] ||
            '';
          const lastName =
            meta['full_name']?.split(' ').slice(1).join(' ') ||
            meta['name']?.split(' ').slice(1).join(' ') ||
            meta['last_name'] ||
            '';

          if (type === 'recovery') {
            const userProfile: UserProfile = {
              id: userId,
              email: email || 'verified_user@vanguard.security',
              firstName,
              lastName,
              role: 'user',
              accountType: 'individual',
            };
            this.setSession(userProfile, {
              access_token: accessToken,
              refresh_token: refreshToken || undefined,
            });
            window.history.replaceState(null, '', window.location.pathname);
            this.isPasswordResetRequired.set(true);
            if (this.isBrowser) localStorage.setItem('vanguard_reset_required', 'true');
            this.router.navigate(['/reset-password']);
            return;
          }

          // SCRUM-163: Zero-Trust OAuth 2-Step Verification Challenge
          this.isOAuthChallenging = true;
          window.history.replaceState(null, '', window.location.pathname);

          const initiateChallenge = (resolvedEmail: string) => {
            const finalEmail = resolvedEmail || email || 'verified_user@vanguard.security';
            this.challengeOAuthOtp({
              email: finalEmail,
              provider: 'google',
              session: {
                access_token: accessToken,
                refresh_token: refreshToken || undefined,
              },
              userMetadata: meta,
            }).subscribe({
              next: (res) => {
                this.isOAuthChallenging = false;
                const targetEmail = res.email || finalEmail;
                this.pendingEmail.set(targetEmail);
                this.pendingMode.set('signin');
                let pendingSso: Record<string, string> | null = null;
                try {
                  const raw = sessionStorage.getItem('vanguard_sso_pending');
                  if (raw) pendingSso = JSON.parse(raw);
                } catch {}

                const queryParams: Record<string, string> = {
                  email: targetEmail,
                  mode: 'signin',
                  hasTotp: res.hasTotp ? 'true' : 'false',
                  provider: 'google',
                };
                if (pendingSso) {
                  Object.assign(queryParams, pendingSso);
                  queryParams['method'] = 'push_approval';
                }
                this.router.navigate(['/verify-otp'], {
                  queryParams,
                });
              },
              error: (err) => {
                this.isOAuthChallenging = false;
                console.warn('OAuth challenge initiation failed:', err);
                const rawErr = err?.error?.message || err?.message || 'Failed to initiate 2-Step Verification.';
                const errorMsg = Array.isArray(rawErr) ? rawErr.join(', ') : rawErr;
                let pendingSso: Record<string, string> | null = null;
                try {
                  const raw = sessionStorage.getItem('vanguard_sso_pending');
                  if (raw) pendingSso = JSON.parse(raw);
                } catch {}
                this.router.navigate(['/login'], {
                  queryParams: { error: errorMsg, ...(pendingSso || {}) },
                });
              },
            });
          };

          if (!email && this.isBrowser) {
            this.supabaseService.client.auth.getUser(accessToken).then(({ data }) => {
              initiateChallenge(data?.user?.email || '');
            }).catch(() => {
              initiateChallenge('');
            });
          } else {
            initiateChallenge(email);
          }
          return;
        }
      }

      // 2. Check URL Search Query params (e.g. ?code=... from PKCE OAuth or ?token_hash=...)
      const queryParams = new URLSearchParams(window.location.search);
      const code = queryParams.get('code');
      const tokenHash = queryParams.get('token_hash');
      const type = queryParams.get('type');

      if (code) {
        this.supabaseService.client.auth
          .exchangeCodeForSession(code)
          .then(({ data, error }) => {
            if (error) {
              console.warn('Supabase exchangeCodeForSession notice:', error.message);
              return;
            }
            if (data?.session) {
              const user = data.session.user;
              const meta = user.user_metadata || {};
              const email = user.email || 'verified_user@vanguard.security';

              if (type === 'recovery') {
                const userProfile: UserProfile = {
                  id: user.id,
                  email,
                  firstName:
                    meta['full_name']?.split(' ')[0] ||
                    meta['name']?.split(' ')[0] ||
                    meta['first_name'] ||
                    'User',
                  lastName:
                    meta['full_name']?.split(' ').slice(1).join(' ') ||
                    meta['name']?.split(' ').slice(1).join(' ') ||
                    meta['last_name'] ||
                    '',
                  role: 'user',
                  accountType: 'individual',
                };
                this.setSession(userProfile, {
                  access_token: data.session.access_token,
                  refresh_token: data.session.refresh_token,
                  expires_at: data.session.expires_at,
                });
                window.history.replaceState(null, '', window.location.pathname);
                this.isPasswordResetRequired.set(true);
                if (this.isBrowser) localStorage.setItem('vanguard_reset_required', 'true');
                this.router.navigate(['/reset-password']);
                return;
              }

              // SCRUM-163: Zero-Trust OAuth 2-Step Verification Challenge
              this.isOAuthChallenging = true;
              window.history.replaceState(null, '', window.location.pathname);
              this.challengeOAuthOtp({
                email,
                provider: 'google',
                session: {
                  access_token: data.session.access_token,
                  refresh_token: data.session.refresh_token,
                  expires_at: data.session.expires_at,
                },
                userMetadata: meta,
              }).subscribe({
                next: (res) => {
                  this.isOAuthChallenging = false;
                  const targetEmail = res.email || email;
                  this.pendingEmail.set(targetEmail);
                  this.pendingMode.set('signin');
                  let pendingSso: Record<string, string> | null = null;
                  try {
                    const raw = sessionStorage.getItem('vanguard_sso_pending');
                    if (raw) pendingSso = JSON.parse(raw);
                  } catch {}

                  const queryParams: Record<string, string> = {
                    email: targetEmail,
                    mode: 'signin',
                    hasTotp: res.hasTotp ? 'true' : 'false',
                    provider: 'google',
                  };
                  if (pendingSso) {
                    Object.assign(queryParams, pendingSso);
                    queryParams['method'] = 'push_approval';
                  }
                  this.router.navigate(['/verify-otp'], {
                    queryParams,
                  });
                },
                error: (err) => {
                  this.isOAuthChallenging = false;
                  console.warn('OAuth challenge initiation failed:', err);
                  const rawErr = err?.error?.message || err?.message || 'Failed to initiate 2-Step Verification.';
                  const errorMsg = Array.isArray(rawErr) ? rawErr.join(', ') : rawErr;
                  let pendingSso: Record<string, string> | null = null;
                  try {
                    const raw = sessionStorage.getItem('vanguard_sso_pending');
                    if (raw) pendingSso = JSON.parse(raw);
                  } catch {}
                  this.router.navigate(['/login'], {
                    queryParams: { error: errorMsg, ...(pendingSso || {}) },
                  });
                },
              });
            }
          })
          .catch((e) => {
            console.warn('Supabase exchangeCodeForSession exception:', e);
          });
        return;
      }

      if (tokenHash) {
        let email = 'user@vanguard.security';
        const userProfile: UserProfile = { id: 'user_' + Date.now(), email };
        this.setSession(userProfile, {
          access_token: 'vanguard_verified_' + Date.now(),
        });

        window.history.replaceState(null, '', window.location.pathname);
        if (type === 'recovery') {
          this.isPasswordResetRequired.set(true);
          if (this.isBrowser) localStorage.setItem('vanguard_reset_required', 'true');
          this.router.navigate(['/reset-password']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      }
    } catch (e) {
      console.error('Failed to parse auth callback params', e);
    }
  }

  /* ==========================================
     Remember Me Helpers
     ========================================== */
  getRememberedEmail(): string {
    if (!this.isBrowser) return '';
    try {
      return localStorage.getItem('vanguard_remembered_email') || '';
    } catch {
      return '';
    }
  }

  setRememberedEmail(email: string): void {
    if (!this.isBrowser) return;
    try {
      if (email) {
        localStorage.setItem('vanguard_remembered_email', email);
      } else {
        this.clearRememberedEmail();
      }
    } catch {}
  }

  clearRememberedEmail(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem('vanguard_remembered_email');
    } catch {}
  }

  /* ==========================================
     Auth Actions
     ========================================== */
  /**
   * SCRUM-163: Initiates 2-Step OTP challenge for OAuth-authenticated sessions
   */
  challengeOAuthOtp(payload: {
    email: string;
    provider?: string;
    session?: {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
      [key: string]: any;
    };
    userMetadata?: Record<string, any>;
  }): Observable<{
    success: boolean;
    requireMfa: boolean;
    hasTotp: boolean;
    email: string;
    message: string;
  }> {
    return this.http.post<{
      success: boolean;
      requireMfa: boolean;
      hasTotp: boolean;
      email: string;
      message: string;
    }>(`${this.API_URL}/oauth-challenge`, payload);
  }

  login(credentials: { email: string; password: string; isSso?: boolean }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap((response) => {
        if (response.success) {
          this.pendingEmail.set(credentials.email);
          this.pendingMode.set('signin');

          if ((!response.requireMfa || credentials.isSso) && response.user && response.session) {
            this.setSession(response.user, response.session);
          }
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // SCRUM-129: removed attemptLocalDirectoryAuth — a failed server login
        // must not be rescued by locally cached directory credentials. A network
        // or credential failure is surfaced as a real error.
        let errorMessage = 'An unexpected error occurred. Please try again.';
        if (error.error && error.error.message) {
          errorMessage = Array.isArray(error.error.message)
            ? error.error.message.join(', ')
            : error.error.message;
        } else if (error.status === 0) {
          errorMessage = `Unable to connect to the backend server. Is it running on ${environment.apiUrl}?`;
        }
        return throwError(() => new Error(errorMessage));
      })
    );
  }


  signup(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/signup`, payload).pipe(
      tap((response) => {
        if (response.success) {
          this.pendingEmail.set(payload.email);
          this.pendingMode.set('signup');

          if (!response.requireOtp && response.user && response.session) {
            this.setSession(response.user, response.session);
          }
        }
      }),
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Registration failed. Please try again.';
        if (error.error && error.error.message) {
          errorMessage = Array.isArray(error.error.message)
            ? error.error.message.join(', ')
            : error.error.message;
        } else if (error.status === 0) {
          errorMessage = 'Unable to connect to the backend server.';
        }
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  verifyOtp(email: string, token: string, type: 'signup' | 'email' | 'recovery' = 'signup'): Observable<AuthResponse> {
    const cleanedToken = token.trim();

    // Check if we have a pending directory employee verification (used only to
    // enrich the verified response with display metadata — never to authenticate).
    const pendingDir = this.isBrowser ? localStorage.getItem('vanguard_pending_dir_user') : null;
    let pendingData: any = null;
    try {
      if (pendingDir) pendingData = JSON.parse(pendingDir);
    } catch {}

    // SCRUM-129: the developer bypass codes (123456 / 12345678) that created a
    // session from cached localStorage data have been removed. Only a
    // server-verified OTP response can establish a session.
    return this.http
      .post<AuthResponse>(`${this.API_URL}/verify-otp`, { email, token: cleanedToken, type })
      .pipe(
        tap((response) => {
          if (response.success && response.user && response.session) {
            if (pendingData && pendingData.user) {
              response.user.role = pendingData.user.role || response.user.role;
              response.user.firstName = pendingData.user.firstName || response.user.firstName;
              response.user.lastName = pendingData.user.lastName || response.user.lastName;
            }
            if (this.isBrowser) localStorage.removeItem('vanguard_pending_dir_user');
            this.setSession(response.user, response.session);
            if (type === 'recovery') {
              this.isPasswordResetRequired.set(true);
              if (this.isBrowser) localStorage.setItem('vanguard_reset_required', 'true');
            }
          }
        }),
        catchError((error: HttpErrorResponse) => {
          // SCRUM-129: no developer-code fallback. A failed server verification
          // is a real failure; it never establishes a session from cached data.
          let errorMessage = 'Invalid or expired verification code.';
          if (error.error && error.error.message) {
            errorMessage = Array.isArray(error.error.message)
              ? error.error.message.join(', ')
              : error.error.message;
          }
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  verifyTotp(email: string, code: string): Observable<AuthResponse> {
    const cleanedCode = code.trim();
    const pendingDir = this.isBrowser ? localStorage.getItem('vanguard_pending_dir_user') : null;
    let pendingData: any = null;
    try {
      if (pendingDir) pendingData = JSON.parse(pendingDir);
    } catch {}

    // SCRUM-129/126: removed the client-side bypass that accepted 123456 or ANY
    // 6-digit code and fabricated a session. Real TOTP is verified server-side.
    return this.http
      .post<AuthResponse>(`${this.API_URL}/mfa/verify`, { code: cleanedCode })
      .pipe(
        tap((response) => {
          if (response.success && response.user && response.session) {
            if (pendingData && pendingData.user) {
              response.user.role = pendingData.user.role || response.user.role;
              response.user.firstName = pendingData.user.firstName || response.user.firstName;
              response.user.lastName = pendingData.user.lastName || response.user.lastName;
            }
            if (this.isBrowser) localStorage.removeItem('vanguard_pending_dir_user');
            this.setSession(response.user, response.session);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          // SCRUM-129: no developer-code fallback; a failed verification is a
          // real failure and never fabricates a session.
          let errorMessage = 'Invalid Authenticator code.';
          if (error.error && error.error.message) {
            errorMessage = Array.isArray(error.error.message)
              ? error.error.message.join(', ')
              : error.error.message;
          }
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  resendOtp(email: string, type: 'signup' | 'email_change' | 'sms' | 'email' | 'signin' = 'signin'): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<{ success: boolean; message: string }>(`${this.API_URL}/resend-otp`, { email, type })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          return throwError(() => new Error(error.error?.message || 'Failed to resend verification code.'));
        })
      );
  }

  sendInviteEmail(payload: {
    email: string;
    name: string;
    role: string;
    department: string;
    temporaryPassword: string;
    loginUrl?: string;
    tenantId?: string;
  }): Observable<{ success: boolean; message: string; emailResult?: any }> {
    return this.http
      .post<{ success: boolean; message: string; emailResult?: any }>(
        `${this.API_URL}/send-invite-email`,
        payload
      )
      .pipe(
        catchError((error: HttpErrorResponse) => {
          let msg = error.error?.message;
          if (!msg) {
            if (error.status === 0 || error.message?.includes('Failed to fetch')) {
              msg = `Unable to connect to backend authentication service (${this.API_URL}). Please ensure the backend server is running.`;
            } else {
              msg = 'Could not dispatch credentials email to employee.';
            }
          } else if (typeof msg === 'string' && msg.includes('Failed to fetch')) {
            msg = 'Unable to connect to backend authentication service (http://localhost:3000). Please ensure the backend server is running.';
          }
          return throwError(() => new Error(msg));
        })
      );
  }

  enrollTotp(email: string): Observable<{ success: boolean; secret: string; qrImageUrl: string; message: string }> {
    return this.http
      .post<{ success: boolean; secret: string; qrImageUrl: string; message: string }>(`${this.API_URL}/enroll-totp`, { email })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          return throwError(() => new Error(error.error?.message || 'Failed to generate Authenticator QR code.'));
        })
      );
  }

  confirmEnrollTotp(email: string, code: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<{ success: boolean; message: string }>(`${this.API_URL}/confirm-totp`, { email, code })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          return throwError(() => new Error(error.error?.message || 'Failed to verify Authenticator code.'));
        })
      );
  }

  unenrollTotp(factorId: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .delete<{ success: boolean; message: string }>(`${this.API_URL}/mfa/${encodeURIComponent(factorId)}`)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          return throwError(() => new Error(error.error?.message || 'Failed to remove Authenticator.'));
        })
      );
  }

  listMfaFactors(type?: string): Observable<{ success: boolean; factors: any[] }> {
    const url = type ? `${this.API_URL}/mfa/factors?type=${encodeURIComponent(type)}` : `${this.API_URL}/mfa/factors`;
    return this.http
      .get<{ success: boolean; factors: any[] }>(url)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          return throwError(() => new Error(error.error?.message || 'Failed to list MFA factors.'));
        })
      );
  }

  setSession(user: UserProfile, session: AuthSession): void {
    this.isOAuthChallenging = false;
    const meta = user.user_metadata || {};
    let resolvedRole: 'admin' | 'security_officer' | 'user' = 'user';

    // 1. Cross reference with local directory users:
    // Any employee invited or created from the directory must strictly be an employee ('user')
    if (this.isBrowser) {
      try {
        const storedDir = localStorage.getItem('vanguard_directory_users');
        if (storedDir) {
          const dirUsers: any[] = JSON.parse(storedDir);
          const matched = dirUsers.find(
            (d) => d.email?.trim().toLowerCase() === user.email?.trim().toLowerCase(),
          );
          if (matched) {
            resolvedRole = matched.role === 'Security Officer' ? 'security_officer' : 'user';
          } else if (user.role === 'admin' || meta['role'] === 'admin') {
            resolvedRole = 'admin';
          } else if (user.role === 'security_officer' || meta['role'] === 'security_officer') {
            resolvedRole = 'security_officer';
          }
        } else if (user.role === 'admin' || meta['role'] === 'admin') {
          resolvedRole = 'admin';
        } else if (user.role === 'security_officer' || meta['role'] === 'security_officer') {
          resolvedRole = 'security_officer';
        }
      } catch {
        if (user.role === 'admin' || meta['role'] === 'admin') resolvedRole = 'admin';
      }
    } else {
      if (user.role === 'admin' || meta['role'] === 'admin') resolvedRole = 'admin';
      else if (user.role === 'security_officer' || meta['role'] === 'security_officer') resolvedRole = 'security_officer';
    }

    let firstName = user.firstName || meta['first_name'] || meta['firstName'] || meta['given_name'] || (meta['name'] ? meta['name'].split(' ')[0] : '') || '';
    let lastName = user.lastName || meta['last_name'] || meta['lastName'] || meta['family_name'] || (meta['name'] ? meta['name'].split(' ').slice(1).join(' ') : '') || '';

    if (!firstName && !lastName && this.isBrowser) {
      try {
        const storedDir = localStorage.getItem('vanguard_directory_users');
        if (storedDir) {
          const dirUsers: any[] = JSON.parse(storedDir);
          const matched = dirUsers.find(
            (d) => d.email?.trim().toLowerCase() === user.email?.trim().toLowerCase(),
          );
          if (matched?.name) {
            const parts = matched.name.trim().split(' ');
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
          }
        }
      } catch {}
    }

    const resolvedFullName = (user as any).name || (firstName || lastName ? `${firstName} ${lastName}`.trim() : meta['name'] || '');

    const isTenant = Boolean(meta['tenant_id'] || meta['account_type'] === 'company' || user.accountType === 'company');
    const resolvedAccountType: 'individual' | 'company' =
      user.accountType === 'individual' || meta['account_type'] === 'individual'
        ? 'individual'
        : (isTenant || resolvedRole === 'admin' ? 'company' : 'individual');

    const isTemp = Boolean(
      meta['is_temporary_password'] === true ||
      meta['isTemporaryPassword'] === true ||
      user.isTemporaryPassword === true ||
      (user as any).is_temporary_password === true
    );

    const normalizedUser: UserProfile = {
      ...user,
      firstName,
      lastName,
      name: resolvedFullName || undefined,
      companyName: user.companyName || meta['company_name'] || meta['companyName'] || 'Vanguard Security Inc.',
      phone: user.phone || meta['phone'] || '',
      role: resolvedRole,
      accountType: resolvedAccountType,
      isTemporaryPassword: isTemp,
      avatarUrl: user.avatarUrl || meta['avatar_url'] || meta['picture'] || '',
      user_metadata: {
        ...meta,
        first_name: firstName,
        last_name: lastName,
        name: resolvedFullName || undefined,
        role: resolvedRole,
        account_type: resolvedAccountType,
        is_temporary_password: isTemp,
      },
    };

    // SCRUM-155: Flag password reset required if explicitly undergoing a recovery flow OR authenticated with temporary password
    if (this.pendingMode() === 'recovery' || isTemp) {
      this.isPasswordResetRequired.set(true);
      if (this.isBrowser) {
        localStorage.setItem('vanguard_reset_required', 'true');
      }
    } else {
      this.isPasswordResetRequired.set(false);
      if (this.isBrowser) {
        localStorage.removeItem('vanguard_reset_required');
      }
    }

    this.currentUser.set(normalizedUser);
    this.token.set(session.access_token);
    if (session.refresh_token) {
      this.refreshToken.set(session.refresh_token);
    }
    if (session.expires_at) {
      this.tokenExpiresAt.set(session.expires_at);
    }

    if (this.isBrowser) {
      // SCRUM-153 & SCRUM-155: If the active user has changed, wipe previous user's cached directory, apps, & tenant state
      const prevUserRaw = localStorage.getItem('vanguard_user');
      if (prevUserRaw) {
        try {
          const prev = JSON.parse(prevUserRaw);
          const isDifferent = (prev?.id && user.id && prev.id !== user.id) ||
                              (prev?.email && user.email && prev.email.toLowerCase().trim() !== user.email.toLowerCase().trim());
          if (isDifferent) {
            const preservedKeys = new Set([
              'vanguard_remembered_email',
              'vanguard_audit_events',
              'vanguard_employee_provisioned_apps',
            ]);
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && (k.startsWith('vanguard_') || k.startsWith('sb-')) && !preservedKeys.has(k)) {
                keysToRemove.push(k);
              }
            }
            keysToRemove.forEach((k) => localStorage.removeItem(k));
          }
        } catch {}
      }

      // SCRUM-172: Record LOGIN movement in local audit trail
      if (normalizedUser.email) {
        try {
          const now = new Date();
          const existing = JSON.parse(localStorage.getItem('vanguard_audit_events') || '[]');
          const loginEvt = {
            id: 'log-login-' + Date.now(),
            action: `User signed in to Vanguard Portal (${normalizedUser.email})`,
            timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            isoTimestamp: now.toISOString(),
            actor: normalizedUser.email,
            source: 'client-ui',
            authoritative: false,
            target: 'Vanguard Identity Portal',
            protocol: 'OIDC / JWT',
            clientIp: '127.0.0.1 (Local)',
            location: 'Local Workstation',
            device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
            status: 'success',
            riskScore: 'Low',
            eventType: 'SSO_LOGIN',
            severity: 'INFO',
            requestId: 'req-login-' + Date.now().toString(36),
          };
          localStorage.setItem('vanguard_audit_events', JSON.stringify([loginEvt, ...existing].slice(0, 500)));
        } catch {}
      }

      localStorage.setItem('vanguard_user', JSON.stringify(normalizedUser));
      localStorage.setItem('vanguard_token', session.access_token);
      if (session.refresh_token) {
        localStorage.setItem('vanguard_refresh_token', session.refresh_token);
      }
      if (session.expires_at) {
        localStorage.setItem('vanguard_token_expires_at', String(session.expires_at));
      }

      if (session.access_token && session.refresh_token) {
        try {
          this.supabaseService.client.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }).catch(() => {});
        } catch {}
      }
    }

    // Schedule proactive auto-renewal 60s before token expiration (SCRUM-142)
    this.scheduleAutoRefresh(session.expires_at);
  }

  forgotPassword(email: string): Observable<{ success: boolean; message: string; email?: string }> {
    return this.http
      .post<{ success: boolean; message: string; email?: string }>(`${this.API_URL}/forgot-password`, { email })
      .pipe(
        tap((res) => {
          if (res.success) {
            this.pendingEmail.set(email);
            this.pendingMode.set('recovery');
          }
        }),
        catchError((error: HttpErrorResponse) => {
          let errorMessage = 'Failed to process password reset. Please try again.';
          if (error.error && error.error.message) {
            errorMessage = Array.isArray(error.error.message)
              ? error.error.message.join(', ')
              : error.error.message;
          } else if (error.status === 0) {
            errorMessage = 'Unable to connect to the backend server.';
          }
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  resetPassword(password: string, accessToken?: string): Observable<{ success: boolean; message: string }> {
    const token = accessToken || this.token() || '';
    const currentEmail = this.currentUser()?.email || this.pendingEmail() || this.loadStoredUser()?.email;
    const isLocalDirectorySession = token.startsWith('vanguard_') || (token && token.split('.').length !== 3);

    // Sync to localStorage directory cache if present
    if (this.isBrowser && (isLocalDirectorySession || currentEmail)) {
      try {
        const stored = localStorage.getItem('vanguard_directory_users');
        if (stored) {
          const users: any[] = JSON.parse(stored);
          const idx = currentEmail
            ? users.findIndex((u) => u.email?.toLowerCase().trim() === currentEmail.toLowerCase().trim())
            : users.findIndex((u) => !!u.temporaryPassword);

          if (idx !== -1) {
            users[idx].password = password.trim();
            users[idx].accountStatus = 'Active';
            users[idx].lastLogin = 'Just now';
            delete users[idx].temporaryPassword;
            delete users[idx].isTemporaryPassword;
            localStorage.setItem('vanguard_directory_users', JSON.stringify(users));
          }
        }
      } catch (e) {
        console.error('Error updating directory user password in localStorage', e);
      }
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return this.http
      .post<{ success: boolean; message: string }>(
        `${this.API_URL}/reset-password`,
        { password, accessToken: token, email: currentEmail },
        { headers }
      )
      .pipe(
        tap(() => {
          this.isPasswordResetRequired.set(false);
          if (this.isBrowser) {
            localStorage.removeItem('vanguard_reset_required');
            localStorage.removeItem('vanguard_user');
            localStorage.removeItem('vanguard_token');
          }
          this.currentUser.set(null);
          this.token.set(null);
        }),
        catchError((error: HttpErrorResponse) => {
          // Fallback if local directory user had an issue with backend JWT verification
          if (this.isBrowser && currentEmail) {
            try {
              const stored = localStorage.getItem('vanguard_directory_users');
              if (stored) {
                const users: any[] = JSON.parse(stored);
                const idx = users.findIndex((u) => u.email?.toLowerCase().trim() === currentEmail.toLowerCase().trim());
                if (idx !== -1) {
                  users[idx].password = password.trim();
                  delete users[idx].temporaryPassword;
                  localStorage.setItem('vanguard_directory_users', JSON.stringify(users));
                  this.isPasswordResetRequired.set(false);
                  localStorage.removeItem('vanguard_reset_required');
                  localStorage.removeItem('vanguard_user');
                  localStorage.removeItem('vanguard_token');
                  this.currentUser.set(null);
                  this.token.set(null);
                  return of({
                    success: true,
                    message: 'Password updated successfully! Please sign in with your new password.',
                  });
                }
              }
            } catch {}
          }

          let errorMessage = 'Failed to reset password. Please try again.';
          if (error.error && error.error.message) {
            errorMessage = Array.isArray(error.error.message)
              ? error.error.message.join(', ')
              : error.error.message;
          } else if (error.status === 0) {
            errorMessage = 'Unable to connect to the backend server.';
          }
          return throwError(() => new Error(errorMessage));
        })
      );
  }

  updateSelfServicePassword(password: string, currentPassword?: string): Observable<{ success: boolean; message: string }> {
    const token = this.token() || '';
    const currentEmail = this.currentUser()?.email || this.pendingEmail() || this.loadStoredUser()?.email;
    const isLocalDirectorySession = token.startsWith('vanguard_') || (token && token.split('.').length !== 3);

    // Verify current password against local directory user if available
    if (this.isBrowser && currentPassword && currentEmail) {
      try {
        const stored = localStorage.getItem('vanguard_directory_users');
        if (stored) {
          const users: any[] = JSON.parse(stored);
          const found = users.find((u) => u.email?.toLowerCase().trim() === currentEmail.toLowerCase().trim());
          if (found) {
            const expected = found.password || found.temporaryPassword;
            if (expected && expected !== currentPassword.trim()) {
              return throwError(() => new Error('Current password does not match.'));
            }
          }
        }
      } catch (e) {
        // ignore parse error
      }
    }

    // Sync to localStorage directory cache if present
    if (this.isBrowser && (isLocalDirectorySession || currentEmail)) {
      try {
        const stored = localStorage.getItem('vanguard_directory_users');
        if (stored) {
          const users: any[] = JSON.parse(stored);
          const idx = currentEmail
            ? users.findIndex((u) => u.email?.toLowerCase().trim() === currentEmail.toLowerCase().trim())
            : users.findIndex((u) => !!u.temporaryPassword);

          if (idx !== -1) {
            users[idx].password = password.trim();
            delete users[idx].temporaryPassword;
            localStorage.setItem('vanguard_directory_users', JSON.stringify(users));
          }
        }
      } catch (e) {
        console.error('Error updating directory user password in localStorage', e);
      }
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.http
      .post<{ success: boolean; message: string }>(
        `${this.API_URL}/reset-password`,
        { password, currentPassword, accessToken: token, email: currentEmail },
        { headers }
      )
      .pipe(
        map((res) => ({
          success: true,
          message: res.message || 'Password updated successfully!',
        })),
        catchError((error: HttpErrorResponse | Error) => {
          if (error instanceof Error && error.message.includes('Current password')) {
            return throwError(() => error);
          }
          const msg =
            (error as HttpErrorResponse)?.error?.message ||
            (error as Error)?.message ||
            'Failed to update password.';
          return throwError(() => new Error(Array.isArray(msg) ? msg.join(', ') : msg));
        })
      );
  }

  getGoogleOAuthUrl(customRedirect?: string): Observable<{ success: boolean; url: string }> {
    const redirectUri =
      customRedirect ||
      (this.isBrowser
        ? `${window.location.origin}/login`
        : 'http://localhost:4200/login');
    return this.http
      .get<{ success: boolean; url: string }>(
        `${this.API_URL}/google?redirect_to=${encodeURIComponent(redirectUri)}`
      )
      .pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Google Authentication is currently unavailable.';
        if (error.error && error.error.message) {
          errorMessage = Array.isArray(error.error.message)
            ? error.error.message.join(', ')
            : error.error.message;
        }
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  approveSsoAuthorization(payload: ApproveSsoPayload): Observable<ApproveSsoResponse> {
    const url = `${this.API_URL.replace(/\/auth\/?$/, '')}/oauth/approve`;
    return this.http.post<ApproveSsoResponse>(url, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Failed to approve SSO authorization.';
        if (error.error && error.error.message) {
          errorMessage = Array.isArray(error.error.message)
            ? error.error.message.join(', ')
            : error.error.message;
        }
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  initiateSsoMfa(payload: InitiateSsoMfaPayload): Observable<InitiateSsoMfaResponse> {
    const url = `${this.API_URL.replace(/\/auth\/?$/, '')}/oauth/mfa/challenge`;
    return this.http.post<InitiateSsoMfaResponse>(url, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Failed to initiate SSO Multi-Factor Authentication.';
        if (error.error && error.error.message) {
          errorMessage = Array.isArray(error.error.message)
            ? error.error.message.join(', ')
            : error.error.message;
        }
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  verifySsoMfa(payload: VerifySsoMfaPayload): Observable<VerifySsoMfaResponse> {
    const url = `${this.API_URL.replace(/\/auth\/?$/, '')}/oauth/mfa/verify`;
    return this.http.post<VerifySsoMfaResponse>(url, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'SSO verification failed.';
        if (error.error && error.error.message) {
          errorMessage = Array.isArray(error.error.message)
            ? error.error.message.join(', ')
            : error.error.message;
        }
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  resendSsoOtp(payload: ResendSsoOtpPayload): Observable<ResendSsoOtpResponse> {
    const url = `${this.API_URL.replace(/\/auth\/?$/, '')}/oauth/mfa/resend`;
    return this.http.post<ResendSsoOtpResponse>(url, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Failed to resend SSO verification code.';
        if (error.error && error.error.message) {
          errorMessage = Array.isArray(error.error.message)
            ? error.error.message.join(', ')
            : error.error.message;
        }
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  initiatePushMfa(payload: InitiatePushMfaPayload): Observable<InitiatePushMfaResponse> {
    const url = `${this.API_URL.replace(/\/auth\/?$/, '')}/oauth/mfa/push/initiate`;
    return this.http.post<InitiatePushMfaResponse>(url, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Failed to dispatch Push MFA challenge to mobile device.';
        if (error.error && error.error.message) {
          errorMessage = Array.isArray(error.error.message)
            ? error.error.message.join(', ')
            : error.error.message;
        }
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  checkPushStatus(challengeId: string): Observable<PushStatusResponse> {
    const url = `${this.API_URL.replace(/\/auth\/?$/, '')}/oauth/mfa/push/status?challengeId=${encodeURIComponent(challengeId)}`;
    return this.http.get<PushStatusResponse>(url).pipe(
      catchError(() => of({
        success: false,
        challengeId,
        status: 'not_found' as const,
      }))
    );
  }

  retryPushChallenge(challengeId: string): Observable<{ success: boolean; numberMatching: { enabled: boolean; code: number }; expiresInSeconds: number; retryCount: number; retriesRemaining: number; message: string }> {
    const url = `${this.API_URL.replace(/\/auth\/?$/, '')}/oauth/mfa/push/retry`;
    return this.http.post<{ success: boolean; numberMatching: { enabled: boolean; code: number }; expiresInSeconds: number; retryCount: number; retriesRemaining: number; message: string }>(url, { challengeId }).pipe(
      catchError((err) => throwError(() => new Error(err.error?.message || 'Failed to retry push challenge.')))
    );
  }

  getPushMfaPreference(email: string): Observable<{ success: boolean; email: string; enabled: boolean }> {
    const url = `${this.API_URL.replace(/\/auth\/?$/, '')}/oauth/mfa/push/preference?email=${encodeURIComponent(email)}`;
    return this.http.get<{ success: boolean; email: string; enabled: boolean }>(url).pipe(
      catchError(() => of({ success: true, email, enabled: true }))
    );
  }

  setPushMfaPreference(email: string, enabled: boolean): Observable<{ success: boolean; enabled: boolean }> {
    const url = `${this.API_URL.replace(/\/auth\/?$/, '')}/oauth/mfa/push/preference`;
    return this.http.post<{ success: boolean; enabled: boolean }>(url, { email, enabled }).pipe(
      catchError(() => of({ success: true, enabled }))
    );
  }

  getPendingPushMfa(email: string): Observable<{ success: boolean; challenges: any[]; activeRequest: any | null }> {
    const url = `${this.API_URL.replace(/\/auth\/?$/, '')}/oauth/mfa/push/pending?email=${encodeURIComponent(email)}`;
    return this.http.get<{ success: boolean; challenges: any[]; activeRequest: any | null }>(url).pipe(
      catchError(() => of({ success: true, challenges: [], activeRequest: null }))
    );
  }

  respondPushMfa(payload: {
    challengeId: string;
    action: 'approved' | 'denied' | 'fraud_reported';
    selectedCode?: number;
  }): Observable<{ success: boolean; message: string; action?: string }> {
    const url = `${this.API_URL.replace(/\/auth\/?$/, '')}/oauth/mfa/push/respond`;
    return this.http.post<{ success: boolean; message: string; action?: string }>(url, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        let msg = 'Failed to submit push MFA response.';
        if (error.error && error.error.message) {
          msg = Array.isArray(error.error.message) ? error.error.message.join(', ') : error.error.message;
        }
        return throwError(() => new Error(msg));
      })
    );
  }

  getConnectedApps(email?: string): Observable<{ success: boolean; connectedApps: UserConnectedApp[] }> {
    const baseUrl = this.API_URL.replace(/\/auth\/?$/, '');
    const url = email
      ? `${baseUrl}/oauth/connected-apps?email=${encodeURIComponent(email)}`
      : `${baseUrl}/oauth/connected-apps`;
    return this.http.get<{ success: boolean; connectedApps: UserConnectedApp[] }>(url).pipe(
      catchError(() => of({
        success: true,
        connectedApps: [
          {
            id: 'conn-dummy-portal',
            clientId: 'vanguard-dummy-portal',
            clientName: 'Acme Dummy Web',
            protocol: 'OpenID Connect 1.0 (PKCE)',
            scopes: ['openid', 'profile', 'email', 'roles', 'offline_access'],
            redirectUri: 'http://localhost:4201/auth/callback',
            originUrl: 'http://localhost:4201',
            status: 'Connected' as const,
            connectedAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            icon: '🌐',
            description: 'Acme Dummy Web portal integrated via Vanguard Single Sign-On and OAuth 2.0 PKCE authentication.',
          }
        ]
      }))
    );
  }

  disconnectConnectedApp(clientId: string, email?: string): Observable<{ success: boolean; disconnected: boolean }> {
    const baseUrl = this.API_URL.replace(/\/auth\/?$/, '');
    const url = email
      ? `${baseUrl}/oauth/connected-apps/${encodeURIComponent(clientId)}?email=${encodeURIComponent(email)}`
      : `${baseUrl}/oauth/connected-apps/${encodeURIComponent(clientId)}`;
    return this.http.delete<{ success: boolean; disconnected: boolean }>(url).pipe(
      catchError(() => of({ success: true, disconnected: true }))
    );
  }


  hasRefreshToken(): boolean {
    return !!this.refreshToken();
  }

  /**
   * Proactive token auto-renewal timer (SCRUM-142, PRD NFR-02 / P1-01).
   * Refreshes 60s prior to token expiry so active users never experience token expiration errors.
   */
  scheduleAutoRefresh(expiresAt?: number): void {
    if (!this.isBrowser) return;
    if (this.autoRefreshTimer) {
      clearTimeout(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }

    let exp = expiresAt || this.tokenExpiresAt();
    if (!exp) {
      const tok = this.token();
      if (tok && tok.includes('.')) {
        try {
          const payload = JSON.parse(atob(tok.split('.')[1]));
          if (payload.exp) {
            exp = payload.exp;
            this.tokenExpiresAt.set(exp);
            localStorage.setItem('vanguard_token_expires_at', String(exp));
          }
        } catch {}
      }
    }

    if (!exp) {
      exp = Math.floor(Date.now() / 1000) + 300;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    // Renew 60s before expiration, bounded to minimum 5s
    const delaySec = Math.max(5, Math.min(exp - nowSec - 60, 86400));

    this.autoRefreshTimer = setTimeout(() => {
      if (this.isLoggedIn() && this.hasRefreshToken()) {
        this.refreshSession().subscribe({
          error: () => {},
        });
      }
    }, delaySec * 1000);
  }

  /**
   * Refreshes the session via POST /auth/refresh with mutex queueing (SCRUM-142).
   */
  refreshSession(): Observable<AuthResponse> {
    const refreshToken = this.refreshToken();
    if (!refreshToken) {
      this.logout();
      return throwError(() => new Error('No refresh token available.'));
    }

    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    this.refreshInFlight$ = this.http
      .post<AuthResponse>(`${this.API_URL}/refresh`, { refreshToken })
      .pipe(
        tap((res) => {
          if (res.success && res.session) {
            this.token.set(res.session.access_token);
            if (res.session.refresh_token) {
              this.refreshToken.set(res.session.refresh_token);
            }
            if (res.session.expires_at) {
              this.tokenExpiresAt.set(res.session.expires_at);
            }
            if (this.isBrowser) {
              localStorage.setItem('vanguard_token', res.session.access_token);
              if (res.session.refresh_token) {
                localStorage.setItem('vanguard_refresh_token', res.session.refresh_token);
              }
              if (res.session.expires_at) {
                localStorage.setItem('vanguard_token_expires_at', String(res.session.expires_at));
              }
              if (res.session.access_token && res.session.refresh_token) {
                try {
                  this.supabaseService.client.auth.setSession({
                    access_token: res.session.access_token,
                    refresh_token: res.session.refresh_token,
                  }).catch(() => {});
                } catch {}
              }
            }
            this.scheduleAutoRefresh(res.session.expires_at);
          }
        }),
        catchError((err: any) => {
          this.logout();
          return throwError(() => err);
        }),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay(1),
      );

    return this.refreshInFlight$;
  }

  private initSessionAutoRefresh(): void {
    if (!this.isBrowser) return;

    try {
      this.supabaseService.client.auth.onAuthStateChange((event, session) => {
        if (event === 'TOKEN_REFRESHED' && session) {
          this.token.set(session.access_token);
          this.refreshToken.set(session.refresh_token || null);
          this.tokenExpiresAt.set(session.expires_at || null);
          localStorage.setItem('vanguard_token', session.access_token);
          if (session.refresh_token) {
            localStorage.setItem('vanguard_refresh_token', session.refresh_token);
          }
          if (session.expires_at) {
            localStorage.setItem('vanguard_token_expires_at', String(session.expires_at));
            this.scheduleAutoRefresh(session.expires_at);
          }
        }
      });
    } catch {}

    const tok = this.token();
    const ref = this.refreshToken();
    const exp = this.tokenExpiresAt();
    if (tok && ref) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (exp && nowSec >= exp - 30) {
        this.refreshSession().subscribe({ error: () => {} });
      } else {
        this.scheduleAutoRefresh(exp || undefined);
      }
    }
  }

  /**
   * SCRUM-156: Fetch authoritative directory users and activation statuses from backend
   */
  getDirectoryUsers(tenantId?: string): Observable<any[]> {
    const params: Record<string, string> = {};
    if (tenantId) params['tenantId'] = tenantId;
    return this.http.get<any[]>(`${this.API_URL}/directory-users`, { params });
  }

  logout(preserveSso = false, navigateToLogin = true): void {
    if (this.autoRefreshTimer) {
      clearTimeout(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
    const loggingOutEmail = this.currentUser()?.email;
    if (this.isBrowser) {
      this.http
        .post(`${this.API_URL}/logout`, loggingOutEmail ? { email: loggingOutEmail } : {})
        .subscribe({
          error: () => {},
        });

      // SCRUM-172: Record LOGOUT movement event in local audit trail before clearing session
      if (loggingOutEmail) {
        try {
          const now = new Date();
          const existing = JSON.parse(localStorage.getItem('vanguard_audit_events') || '[]');
          const logoutEvt = {
            id: 'log-logout-' + Date.now(),
            action: `User signed out of Vanguard session (${loggingOutEmail})`,
            timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            isoTimestamp: now.toISOString(),
            actor: loggingOutEmail,
            source: 'client-ui',
            authoritative: false,
            target: 'Vanguard Identity Portal',
            protocol: 'Web Portal',
            clientIp: '127.0.0.1 (Local)',
            location: 'Local Workstation',
            device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
            status: 'success',
            riskScore: 'Low',
            eventType: 'USER_LOGOUT',
            severity: 'INFO',
            requestId: 'req-logout-' + Date.now().toString(36),
          };
          localStorage.setItem('vanguard_audit_events', JSON.stringify([logoutEvt, ...existing].slice(0, 500)));
        } catch {}
      }

      try {
        this.supabaseService.client.auth.signOut().catch(() => {});
      } catch {}

      // SCRUM-153 & SCRUM-172: Purge session/directory/org state while preserving remembered email, audit trail, & provisioned employee apps
      const preservedKeys = new Set([
        'vanguard_remembered_email',
        'vanguard_audit_events',
        'vanguard_employee_provisioned_apps',
      ]);
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('vanguard_') || key.startsWith('sb-'))) {
          if (!preservedKeys.has(key)) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      let ssoPending: string | null = null;
      if (preserveSso) {
        ssoPending = sessionStorage.getItem('vanguard_sso_pending');
      }
      sessionStorage.clear();
      if (preserveSso && ssoPending) {
        sessionStorage.setItem('vanguard_sso_pending', ssoPending);
      }
    }
    this.currentUser.set(null);
    this.token.set(null);
    this.refreshToken.set(null);
    this.tokenExpiresAt.set(null);
    this.isPasswordResetRequired.set(false);
    if (navigateToLogin) {
      this.router.navigate(['/login']);
    }
  }

  isLoggedIn(): boolean {
    return !!this.currentUser();
  }
}
