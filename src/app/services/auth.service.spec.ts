import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

@Component({ template: '' })
class DummyLoginComponent {}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', component: DummyLoginComponent }]),
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('Client bypass removal (SCRUM-129)', () => {
    it('verifyOtp with the old bypass code still calls the server (no fabricated session)', () => {
      let errored = false;
      service.verifyOtp('x@y.com', '123456', 'signup').subscribe({
        next: () => {},
        error: () => { errored = true; },
      });
      const req = httpMock.expectOne((r) => r.url.endsWith('/verify-otp'));
      req.flush({ message: 'Invalid or expired verification code.' }, { status: 400, statusText: 'Bad Request' });
      expect(errored).toBe(true);
      expect(service.isAuthenticated()).toBeFalsy();
    });

    it('verifyTotp with any 6-digit code still calls the server (no fabricated session)', () => {
      let errored = false;
      service.verifyTotp('x@y.com', '999999').subscribe({
        next: () => {},
        error: () => { errored = true; },
      });
      const req = httpMock.expectOne((r) => r.url.endsWith('/mfa/verify'));
      req.flush({ message: 'Invalid Authenticator code.' }, { status: 401, statusText: 'Unauthorized' });
      expect(errored).toBe(true);
      expect(service.isAuthenticated()).toBeFalsy();
    });

    it('login surfaces a server error instead of local directory fallback', () => {
      localStorage.setItem(
        'vanguard_directory_users',
        JSON.stringify([{ email: 'x@y.com', password: 'Secret#1', name: 'X Y', role: 'user' }]),
      );
      let errored = false;
      service.login({ email: 'x@y.com', password: 'Secret#1' }).subscribe({
        next: () => {},
        error: () => { errored = true; },
      });
      const req = httpMock.expectOne((r) => r.url.endsWith('/login'));
      req.flush({ message: 'Invalid login credentials' }, { status: 401, statusText: 'Unauthorized' });
      expect(errored).toBe(true);
      expect(service.isAuthenticated()).toBeFalsy();
    });
  });

  describe('Token auto-renewal and refreshSession (SCRUM-142)', () => {
    it('refreshSession() fails and triggers logout if no refresh token is available', () => {
      let errored = false;
      service.refreshSession().subscribe({
        next: () => {},
        error: (err) => {
          errored = true;
          expect(err.message).toContain('No refresh token available');
        },
      });

      // logout() issues a POST /logout call
      const logoutReq = httpMock.expectOne((r) => r.url.endsWith('/logout'));
      logoutReq.flush({ success: true });

      expect(errored).toBe(true);
      expect(service.token()).toBeNull();
      expect(service.refreshToken()).toBeNull();
    });

    it('refreshSession() calls POST /auth/refresh and updates tokens and expiry signals', () => {
      service.setSession(
        { id: 'usr-1', email: 'test@vanguard.security', role: 'user' },
        {
          access_token: 'old-access-token',
          refresh_token: 'valid-refresh-token',
          expires_at: Math.floor(Date.now() / 1000) + 300,
        },
      );

      let resultResponse: any = null;
      service.refreshSession().subscribe((res) => {
        resultResponse = res;
      });

      const req = httpMock.expectOne((r) => r.url.endsWith('/refresh'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ refreshToken: 'valid-refresh-token' });

      const newExpiry = Math.floor(Date.now() / 1000) + 300;
      req.flush({
        success: true,
        session: {
          access_token: 'new-renewed-access-token',
          refresh_token: 'new-renewed-refresh-token',
          expires_at: newExpiry,
        },
        user: { id: 'usr-1', email: 'test@vanguard.security', role: 'user' },
      });

      expect(resultResponse).toBeTruthy();
      expect(service.token()).toBe('new-renewed-access-token');
      expect(service.refreshToken()).toBe('new-renewed-refresh-token');
      expect(service.tokenExpiresAt()).toBe(newExpiry);
      expect(localStorage.getItem('vanguard_token')).toBe('new-renewed-access-token');
      expect(localStorage.getItem('vanguard_refresh_token')).toBe('new-renewed-refresh-token');
    });

    it('refreshSession() de-duplicates concurrent refresh calls to a single HTTP request', () => {
      service.setSession(
        { id: 'usr-1', email: 'test@vanguard.security', role: 'user' },
        {
          access_token: 'old-access-token',
          refresh_token: 'valid-refresh-token',
        },
      );

      let res1: any = null;
      let res2: any = null;

      // Trigger two concurrent refresh calls
      service.refreshSession().subscribe((res) => { res1 = res; });
      service.refreshSession().subscribe((res) => { res2 = res; });

      // Expect exactly ONE POST to /refresh
      const req = httpMock.expectOne((r) => r.url.endsWith('/refresh'));
      expect(req.request.method).toBe('POST');

      req.flush({
        success: true,
        session: {
          access_token: 'shared-new-token',
          refresh_token: 'shared-new-refresh',
          expires_at: 1800000000,
        },
      });

      expect(res1).toBeTruthy();
      expect(res2).toBeTruthy();
      expect(res1.session.access_token).toBe('shared-new-token');
      expect(res2.session.access_token).toBe('shared-new-token');
    });

    it('logout() clears auto-renewal timers and tokens from signals and localStorage', () => {
      service.setSession(
        { id: 'usr-1', email: 'test@vanguard.security', role: 'user' },
        {
          access_token: 'active-access-token',
          refresh_token: 'active-refresh-token',
          expires_at: Math.floor(Date.now() / 1000) + 300,
        },
      );

      expect(service.token()).toBe('active-access-token');
      expect(service.refreshToken()).toBe('active-refresh-token');

      service.logout();

      // Consume the logout post
      const req = httpMock.expectOne((r) => r.url.endsWith('/logout'));
      expect(req.request.method).toBe('POST');
      req.flush({ success: true });

      expect(service.token()).toBeNull();
      expect(service.refreshToken()).toBeNull();
      expect(service.tokenExpiresAt()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(localStorage.getItem('vanguard_token')).toBeNull();
      expect(localStorage.getItem('vanguard_refresh_token')).toBeNull();
    });
  });

  describe('Cross-account storage isolation & purge (SCRUM-153)', () => {
    it('logout() thoroughly purges all vanguard_* and sb-* keys while preserving remembered email', () => {
      localStorage.setItem('vanguard_directory_users', JSON.stringify([{ id: 'u1', email: 'old@company.com' }]));
      localStorage.setItem('vanguard_organizations', JSON.stringify([{ id: 'org-old', name: 'Old Company' }]));
      localStorage.setItem('vanguard_active_org_id', 'org-old');
      localStorage.setItem('sb-test-token', 'supabase-auth-token');
      localStorage.setItem('vanguard_remembered_email', 'remember@user.com');

      service.logout();

      const req = httpMock.expectOne((r) => r.url.endsWith('/logout'));
      req.flush({ success: true });

      expect(localStorage.getItem('vanguard_directory_users')).toBeNull();
      expect(localStorage.getItem('vanguard_organizations')).toBeNull();
      expect(localStorage.getItem('vanguard_active_org_id')).toBeNull();
      expect(localStorage.getItem('sb-test-token')).toBeNull();
      expect(localStorage.getItem('vanguard_remembered_email')).toBe('remember@user.com');
    });

    it('setSession() purges stale cross-account state when a different user signs in', () => {
      localStorage.setItem('vanguard_user', JSON.stringify({ id: 'user-old', email: 'old@company.com' }));
      localStorage.setItem('vanguard_directory_users', JSON.stringify([{ id: 'user-old', email: 'old@company.com' }]));
      localStorage.setItem('vanguard_organizations', JSON.stringify([{ id: 'org-old', name: 'Old Corp' }]));
      localStorage.setItem('vanguard_remembered_email', 'remember@user.com');

      service.setSession(
        { id: 'user-new', email: 'new@company.com', role: 'admin' },
        { access_token: 'new-token', refresh_token: 'new-refresh', expires_at: 1800000000 }
      );

      expect(localStorage.getItem('vanguard_directory_users')).toBeNull();
      expect(localStorage.getItem('vanguard_organizations')).toBeNull();
      expect(localStorage.getItem('vanguard_user')).toContain('user-new');
      expect(localStorage.getItem('vanguard_remembered_email')).toBe('remember@user.com');
    });
  });

  describe('Employee invitation & network error handling (SCRUM-154)', () => {
    it('sendInviteEmail() passes tenantId and payload to /send-invite-email', () => {
      let result: any = null;
      service.sendInviteEmail({
        email: 'employee@test.com',
        name: 'Employee Test',
        role: 'user',
        department: 'Engineering',
        temporaryPassword: 'TempPassword#1',
        tenantId: 'tenant-123'
      }).subscribe((res) => { result = res; });

      const req = httpMock.expectOne((r) => r.url.endsWith('/send-invite-email'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body.tenantId).toBe('tenant-123');
      expect(req.request.body.email).toBe('employee@test.com');

      req.flush({ success: true, message: 'Invitation dispatched' });
      expect(result.success).toBe(true);
    });

    it('sendInviteEmail() normalizes status 0 / connection refused errors to actionable message', () => {
      let errorMsg = '';
      service.sendInviteEmail({
        email: 'employee@test.com',
        name: 'Employee Test',
        role: 'user',
        department: 'Engineering',
        temporaryPassword: 'TempPassword#1'
      }).subscribe({
        next: () => {},
        error: (err) => { errorMsg = err.message; }
      });

      const req = httpMock.expectOne((r) => r.url.endsWith('/send-invite-email'));
      req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(errorMsg).toContain('Unable to connect to backend');
      expect(errorMsg).toContain('http://localhost:3000');
    });
  });

  describe('Temporary password detection and tenant account resolution (SCRUM-155)', () => {
    it('setSession() activates isPasswordResetRequired when user has is_temporary_password: true', () => {
      service.setSession(
        {
          id: 'user-temp',
          email: 'employee@company.com',
          role: 'user',
          user_metadata: {
            role: 'user',
            is_temporary_password: true,
            account_type: 'company',
            tenant_id: 'org-tenant-1',
          },
        },
        { access_token: 'temp-jwt', refresh_token: 'temp-ref', expires_at: 1800000000 }
      );

      expect(service.isPasswordResetRequired()).toBe(true);
      expect(localStorage.getItem('vanguard_reset_required')).toBe('true');
      expect(service.currentUser()?.accountType).toBe('company');
      expect(service.currentUser()?.isTemporaryPassword).toBe(true);
    });

    it('setSession() does NOT require password reset when logging in with standard permanent credentials', () => {
      service.setSession(
        {
          id: 'user-perm',
          email: 'employee@company.com',
          role: 'user',
          user_metadata: {
            role: 'user',
            is_temporary_password: false,
            account_type: 'company',
          },
        },
        { access_token: 'perm-jwt', refresh_token: 'perm-ref', expires_at: 1800000000 }
      );

      expect(service.isPasswordResetRequired()).toBe(false);
      expect(localStorage.getItem('vanguard_reset_required')).toBeNull();
      expect(service.currentUser()?.accountType).toBe('company');
    });

    it('normalizes invited users with tenant_id or company metadata as accountType: company', () => {
      service.setSession(
        {
          id: 'tenant-user',
          email: 'tenant.emp@company.com',
          role: 'user',
          user_metadata: {
            tenant_id: 'org-enterprise-42',
            role: 'user',
          },
        },
        { access_token: 'tok-1', expires_at: 1800000000 }
      );

      expect(service.currentUser()?.accountType).toBe('company');
      expect(service.userRole()).toBe('user');
      expect(service.isAdmin()).toBe(false);
    });
  });
});
