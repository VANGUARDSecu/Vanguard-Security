import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
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
});
