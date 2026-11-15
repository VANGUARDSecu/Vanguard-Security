import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the login component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize login form with empty fields and invalid status', () => {
    expect(component.loginForm.valid).toBeFalsy();
    expect(component.loginForm.get('email')?.value).toBe('');
    expect(component.loginForm.get('password')?.value).toBe('');
    expect(component.loginForm.get('rememberMe')?.value).toBe(false);
  });

  it('should validate email format and password length', () => {
    const emailControl = component.loginForm.get('email');
    const passwordControl = component.loginForm.get('password');

    emailControl?.setValue('invalid-email');
    passwordControl?.setValue('123');
    expect(emailControl?.valid).toBeFalsy();
    expect(passwordControl?.valid).toBeFalsy();

    emailControl?.setValue('user@example.com');
    passwordControl?.setValue('securePassword123');
    expect(emailControl?.valid).toBeTruthy();
    expect(passwordControl?.valid).toBeTruthy();
    expect(component.loginForm.valid).toBeTruthy();
  });

  it('should toggle password visibility signal', () => {
    expect(component.showPassword()).toBeFalsy();
    component.togglePassword();
    expect(component.showPassword()).toBeTruthy();
    component.togglePassword();
    expect(component.showPassword()).toBeFalsy();
  });

  it('should toggle remember me value', () => {
    expect(component.loginForm.get('rememberMe')?.value).toBe(false);
    component.toggleRememberMe();
    expect(component.loginForm.get('rememberMe')?.value).toBe(true);
  });

  it('should manage timed notifications and dismiss properly', () => {
    expect(component.notification()).toBeNull();

    component.showNotification('error', 'Test error message', 5000);
    expect(component.notification()).toEqual({ type: 'error', message: 'Test error message' });

    component.dismissNotification();
    expect(component.notification()).toBeNull();
  });

  it('should show the client name from the server registry, falling back to the client id', () => {
    component.ssoParams.set({
      client_id: 'vanguard-dummy-portal',
      redirect_uri: 'http://localhost:4201/auth/callback',
      state: 'test_state_123',
    });
    // No name from the server yet: show the client id, never a hard-coded alias.
    expect(component.clientDisplayName()).toBe('vanguard-dummy-portal');

    component.ssoParams.set({
      client_id: 'vanguard-dummy-portal',
      client_name: 'Acme Dummy Portal (Angular SPA)',
      redirect_uri: 'http://localhost:4201/auth/callback',
      state: 'test_state_123',
    });
    expect(component.clientDisplayName()).toBe('Acme Dummy Portal (Angular SPA)');

    component.ssoParams.set({
      client_id: 'custom-partner-app',
      redirect_uri: 'https://partner.com/callback',
    });
    expect(component.clientDisplayName()).toBe('custom-partner-app');
  });

  it('should handle cancel SSO redirect', () => {
    component.ssoParams.set({
      client_id: 'vanguard-dummy-portal',
      redirect_uri: 'http://localhost:4201/auth/callback',
      state: 'state_xyz',
    });

    // Mock window.location
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { href: '' };

    component.onCancelSso();
    expect(window.location.href).toContain('http://localhost:4201/auth/callback');
    expect(window.location.href).toContain('error=access_denied');
    expect(window.location.href).toContain('state=state_xyz');

    (window as any).location = originalLocation;
  });

  it('should detect account mismatch when active user email differs from login_hint', () => {
    (component.authService as any).currentUser.set({
      id: 'usr_1',
      email: 'johnroben.manayon21@gmail.com',
      firstName: 'John',
      lastName: 'Manayon',
    });

    component.ssoParams.set({
      client_id: 'vanguard-dummy-portal',
      redirect_uri: 'http://localhost:4201/auth/callback',
      login_hint: 'johnroben.manayon31@gmail.com',
    });

    expect(component.isAccountMismatch()).toBe(true);

    component.ssoParams.set({
      client_id: 'vanguard-dummy-portal',
      redirect_uri: 'http://localhost:4201/auth/callback',
      login_hint: 'johnroben.manayon21@gmail.com',
    });

    expect(component.isAccountMismatch()).toBe(false);
  });

  it('should include pending administrator review error description on cancel when ssoApprovalRequired is true', () => {
    component.ssoParams.set({
      client_id: 'vanguard-dummy-portal',
      redirect_uri: 'http://localhost:4201/auth/callback',
      state: 'state_xyz',
    });
    component.ssoApprovalRequired.set(true);

    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { href: '' };

    component.onCancelSso();
    expect(window.location.href).toContain('http://localhost:4201/auth/callback');
    expect(window.location.href).toContain('error=access_denied');
    expect(window.location.href).toContain('Access+approval+pending+administrator+review');
    expect(window.location.href).toContain('state=state_xyz');

    (window as any).location = originalLocation;
  });

  it('should activate ssoApprovalRequired signal when handling zero-trust approval error', () => {
    expect(component.ssoApprovalRequired()).toBe(false);
    (component as any).handleApprovalRequired(new Error('Zero-Trust Access Governance: Administrative approval is required before corporate account can access'));
    expect(component.ssoApprovalRequired()).toBe(true);
    expect(component.ssoApprovalMessage()).toContain('Zero-Trust Access Governance');
  });

  describe('SSO Authentication Flow (SCRUM-176)', () => {
    it('should serialize pending SSO parameters to sessionStorage on onGoogleLogin', () => {
      const ssoData = {
        client_id: 'vanguard-dummy-portal',
        redirect_uri: 'http://localhost:4201/auth/callback',
      };
      component.ssoParams.set(ssoData);

      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      vi.spyOn(component.authService, 'getGoogleOAuthUrl').mockReturnValue({
        subscribe: vi.fn(),
      } as any);

      component.onGoogleLogin();

      expect(setItemSpy).toHaveBeenCalledWith('vanguard_sso_pending', JSON.stringify(ssoData));
      setItemSpy.mockRestore();
    });

    it('should navigate to /verify-otp with method push_approval on onContinueSso', () => {
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate');

      (component.authService as any).currentUser.set({
        id: 'usr_sso_1',
        email: 'user@example.com',
      });

      component.ssoParams.set({
        client_id: 'vanguard-dummy-portal',
        redirect_uri: 'http://localhost:4201/auth/callback',
      });

      component.onContinueSso();

      expect(navSpy).toHaveBeenCalledWith(['/verify-otp'], {
        queryParams: expect.objectContaining({
          email: 'user@example.com',
          mode: 'signin',
          method: 'push_approval',
          client_id: 'vanguard-dummy-portal',
        }),
      });
    });

    it('SCRUM-184: displays Google OAuth processing indicator card while callback verification is active', () => {
      component.authService.isOAuthProcessing.set(true);
      component.authService.oAuthProcessingMessage.set('Verifying Google account session...');
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      const indicator = el.querySelector('[data-testid="oauth-processing-indicator"]');
      expect(indicator).toBeTruthy();
      expect(indicator?.textContent).toContain('Processing Google Sign-In');
      expect(indicator?.textContent).toContain('Verifying Google account session...');

      component.authService.isOAuthProcessing.set(false);
      fixture.detectChanges();
      expect(el.querySelector('[data-testid="oauth-processing-indicator"]')).toBeNull();
    });

    it('SCRUM-190: rejects unsafe external returnUrl values and retains safe internal paths', () => {
      expect(component.returnUrl()).toBe('');
      // Simulate safe query param assignment via signal
      component.returnUrl.set('/dashboard?tab=security&action=revoke');
      expect(component.returnUrl()).toBe('/dashboard?tab=security&action=revoke');
    });

    it('SCRUM-196: checkApprovalAndProceed initiates Push MFA challenge cleanly without premature consent=required redirect', () => {
      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigate');
      const approveSpy = vi.spyOn(component.authService, 'approveSsoAuthorization');
      const pushSpy = vi.spyOn(component.authService, 'initiatePushMfa').mockReturnValue({
        subscribe: ({ next }: any) =>
          next({
            success: true,
            challengeId: 'push_mfa_login_196',
            email: 'employee@acme.corp',
            clientId: 'vanguard-dummy-portal',
            clientName: 'Acme Dummy Portal (Angular SPA)',
            clientType: 'web',
            appIcon: '🛡️',
            numberMatching: { enabled: true, code: 88 },
            expiresInSeconds: 60,
            message: 'Push dispatched',
          }),
      } as any);

      (component.authService as any).currentUser.set({
        id: 'usr_tenant_196',
        email: 'employee@acme.corp',
      });
      component.ssoParams.set({
        client_id: 'vanguard-dummy-portal',
        redirect_uri: 'http://localhost:4201/auth/callback',
        state: 'st-login-196',
      });
      component.ssoApprovalRequired.set(true);

      component.checkApprovalAndProceed(false);

      expect(approveSpy).not.toHaveBeenCalled();
      expect(pushSpy).toHaveBeenCalled();
      expect(component.ssoApprovalRequired()).toBe(false);
      expect(navSpy).toHaveBeenCalledWith(['/verify-otp'], {
        queryParams: expect.objectContaining({
          challengeId: 'push_mfa_login_196',
          method: 'push_approval',
          numberCode: '88',
          client_id: 'vanguard-dummy-portal',
        }),
      });
      expect((navSpy.mock.calls[0][1] as any).queryParams.consent).toBeUndefined();
    });

    it('SCRUM-205: exposes interactive Return CTA when approveSsoForUser completes for custom mobile scheme', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = { href: '' };

      vi.spyOn(component.authService, 'approveSsoAuthorization').mockReturnValue({
        subscribe: ({ next }: any) =>
          next({
            code: 'vg_apk_205',
            redirectUrl: 'vanguard-dummy://oauth/callback?code=vg_apk_205&state=st-apk',
          }),
      } as any);

      (component.authService as any).currentUser.set({
        id: 'usr_apk_205',
        email: 'mobile@example.com',
        firstName: 'Mobile',
        lastName: 'User',
      });
      component.ssoParams.set({
        client_id: 'vanguard-dummy-mobile',
        client_name: 'Dummy Mobile App',
        redirect_uri: 'vanguard-dummy://oauth/callback',
        state: 'st-apk',
      });
      component.isLoading.set(true);

      component.approveSsoForUser(undefined, false);
      fixture.detectChanges();

      expect(component.isLoading()).toBe(false);
      expect(component.pendingSsoRedirectUrl()).toBe(
        'vanguard-dummy://oauth/callback?code=vg_apk_205&state=st-apk',
      );
      expect(window.location.href).toBe(
        'vanguard-dummy://oauth/callback?code=vg_apk_205&state=st-apk',
      );

      const el: HTMLElement = fixture.nativeElement;
      const returnLink = el.querySelector('[data-testid="sso-return-app-link"]') as HTMLAnchorElement | null;
      expect(returnLink).toBeTruthy();
      expect(returnLink?.textContent).toContain('Return to Dummy Mobile App');
      expect(returnLink?.getAttribute('href')).toContain('vanguard-dummy://oauth/callback?code=vg_apk_205');

      (window as any).location = originalLocation;
    });
  });
});
