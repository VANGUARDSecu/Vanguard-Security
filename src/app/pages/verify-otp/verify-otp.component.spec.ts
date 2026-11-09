import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { VerifyOtpComponent } from './verify-otp.component';
import { AuthService } from '../../services/auth.service';

describe('VerifyOtpComponent', () => {
  let component: VerifyOtpComponent;
  let fixture: ComponentFixture<VerifyOtpComponent>;
  let authService: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerifyOtpComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    fixture = TestBed.createComponent(VerifyOtpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the verify OTP component', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle between email OTP and TOTP methods', () => {
    expect(component.method()).toBe('email_otp');
    component.setMethod('totp');
    expect(component.method()).toBe('totp');
    component.setMethod('email_otp');
    expect(component.method()).toBe('email_otp');
  });

  it('should show the client name from the server registry, falling back to the client id', () => {
    component.ssoParams.set({
      client_id: 'vanguard-dummy-portal',
      redirect_uri: 'http://localhost:4201/auth/callback',
      state: 'state_123',
    });
    // No name from the server yet: show the client id, never a hard-coded alias.
    expect(component.clientDisplayName()).toBe('vanguard-dummy-portal');

    component.serverClientName.set('Acme Dummy Portal (Angular SPA)');
    expect(component.clientDisplayName()).toBe('Acme Dummy Portal (Angular SPA)');
  });

  it('should redirect back to client when user cancels SSO on verify OTP page', () => {
    component.ssoParams.set({
      client_id: 'vanguard-dummy-portal',
      redirect_uri: 'http://localhost:4201/auth/callback',
      state: 'state_456',
    });

    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { href: '' };

    component.onCancelSso();
    expect(window.location.href).toContain('http://localhost:4201/auth/callback');
    expect(window.location.href).toContain('error=access_denied');
    expect(window.location.href).toContain('state=state_456');

    (window as any).location = originalLocation;
  });

  // ==========================================================================
  // SCRUM-61: SSO Multi-Factor Authentication Enforcement
  // ==========================================================================
  describe('SSO MFA Enforcement (SCRUM-61)', () => {
    it('should activate SSO verification mode and enforce 6-digit code length when challengeId is set', () => {
      component.challengeId.set('sso_mfa_test_123');
      expect(component.isSsoVerification()).toBe(true);
      expect(component.codeLength()).toBe(6);
      expect(component.separatorIndex()).toBe(2);
    });

    it('should submit SSO MFA verification to authService.verifySsoMfa and handle redirect', () => {
      const verifySpy = vi.spyOn(authService, 'verifySsoMfa').mockReturnValue(
        of({
          success: true,
          message: 'SSO MFA verified.',
          code: 'vg_code_sso_test',
          redirectUrl: 'http://localhost:4201/auth/callback?code=vg_code_sso_test',
        })
      );

      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = { href: '' };

      component.challengeId.set('sso_mfa_test_123');
      component.digits.set(['6', '5', '4', '3', '2', '1']);

      component.onSubmit();

      expect(verifySpy).toHaveBeenCalledWith({
        challengeId: 'sso_mfa_test_123',
        code: '654321',
        method: 'email_otp',
      });
      expect(window.location.href).toBe('http://localhost:4201/auth/callback?code=vg_code_sso_test');

      (window as any).location = originalLocation;
    });

    it('should dispatch SSO MFA resend and trigger 60-second cooldown timer', () => {
      const resendSpy = vi.spyOn(authService, 'resendSsoOtp').mockReturnValue(
        of({
          success: true,
          message: 'New code sent',
          expiresInSeconds: 300,
          resendCooldownSeconds: 60,
        })
      );

      component.challengeId.set('sso_mfa_test_123');
      component.isLoading.set(false);
      component.resendCountdown.set(0);
      component.onResendOtp();

      expect(resendSpy).toHaveBeenCalledWith({ challengeId: 'sso_mfa_test_123' });
      expect(component.resendCountdown()).toBe(60);
    });

    it('should render Push MFA state with 2-digit number challenge and poll for status (SCRUM-85)', () => {
      const checkStatusSpy = vi.spyOn(authService, 'checkPushStatus').mockReturnValue(
        of({
          success: true,
          challengeId: 'push_mfa_test_999',
          status: 'pending',
        })
      );

      component.method.set('push_approval');
      component.numberCode.set('42');
      component.challengeId.set('push_mfa_test_999');

      expect(component.method()).toBe('push_approval');
      expect(component.numberCode()).toBe('42');
      expect(component.pushSecondsRemaining()).toBe(60);
    });

    it('should switch to email OTP on fallback request (SCRUM-85)', () => {
      const initiateSpy = vi.spyOn(authService, 'initiateSsoMfa').mockReturnValue(
        of({
          success: true,
          challengeId: 'sso_mfa_fallback_456',
          email: 'user@vanguard.security',
          clientId: 'vanguard-dummy-portal',
          clientName: 'Acme Enterprise Portal',
          redirectUri: 'http://localhost:4201/auth/callback',
          expiresInSeconds: 300,
          resendCooldownSeconds: 60,
          message: 'Email OTP sent',
        })
      );

      component.ssoParams.set({
        client_id: 'vanguard-dummy-portal',
        redirect_uri: 'http://localhost:4201/auth/callback',
      });
      component.email.set('user@vanguard.security');
      component.method.set('push_approval');

      component.switchToEmailOtp();

      expect(initiateSpy).toHaveBeenCalled();
      expect(component.method()).toBe('email_otp');
      expect(component.challengeId()).toBe('sso_mfa_fallback_456');
    });

    it('SCRUM-163: should display Google Account 2-Step Verification when provider is google', () => {
      component.provider.set('google');
      component.email.set('google.user@gmail.com');
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Google Account 2-Step Verification');
      expect(el.textContent).toContain('google.user@gmail.com');
    });

    it('SCRUM-168: should support direct frontend browser SSO approval without requiring Mobile MFA or Email OTP', () => {
      const verifySpy = vi.spyOn(authService, 'verifySsoMfa').mockReturnValue(
        of({
          success: true,
          message: 'Approved in browser',
          code: 'vg_code_direct_browser',
          redirectUrl: 'http://localhost:4201/auth/callback?code=vg_code_direct_browser',
        })
      );

      const originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = { href: '' };

      component.challengeId.set('sso_mfa_direct_168');
      component.approveDirectlyInFrontend();

      expect(verifySpy).toHaveBeenCalledWith({
        challengeId: 'sso_mfa_direct_168',
        code: 'FRONTEND_DIRECT_APPROVAL',
        method: 'frontend_approval',
      });
      expect(window.location.href).toBe('http://localhost:4201/auth/callback?code=vg_code_direct_browser');

      (window as any).location = originalLocation;
    });
  });
});
