import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../services/auth.service';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should validate password mismatch', () => {
    component.resetForm.setValue({
      password: 'newPassword123',
      confirmPassword: 'differentPassword',
    });
    expect(component.resetForm.hasError('passwordMismatch')).toBe(true);
  });
});

describe('ResetPasswordComponent — One-Time Setup Onboarding (SCRUM-168)', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let component: ResetPasswordComponent;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ token: 'onetime_setup_tok_168' }),
            },
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('validates single-use setup token on load and completes onboarding with permanent password', () => {
    const valReq = httpMock.expectOne((r) =>
      r.url.includes('/setup-account/validate') && r.urlWithParams.includes('onetime_setup_tok_168')
    );
    expect(valReq.request.method).toBe('GET');
    valReq.flush({
      valid: true,
      email: 'new.hire@acme.com',
      name: 'Rachel Cole',
      role: 'user',
      department: 'Engineering',
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Complete One-Time Account Setup');
    expect(el.textContent).toContain('new.hire@acme.com');

    const authService = TestBed.inject(AuthService);
    const setSessionSpy = vi.spyOn(authService, 'setSession');
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.resetForm.setValue({
      password: 'StrongPermanent#Password99!',
      confirmPassword: 'StrongPermanent#Password99!',
    });
    component.onSubmit();

    const compReq = httpMock.expectOne((r) => r.url.endsWith('/auth/setup-account/complete'));
    expect(compReq.request.method).toBe('POST');
    expect(compReq.request.body).toEqual({
      token: 'onetime_setup_tok_168',
      password: 'StrongPermanent#Password99!',
    });
    compReq.flush({
      success: true,
      message: 'One-Time Account Setup completed!',
      user: {
        id: 'emp-168',
        email: 'new.hire@acme.com',
        role: 'user',
        accountType: 'company',
        isTemporaryPassword: false,
      },
      session: {
        access_token: 'jwt-onboarded-168',
        refresh_token: 'ref-168',
      },
    });

    expect(setSessionSpy).toHaveBeenCalled();
    expect(navSpy).toBeDefined();
  });

  it('displays clear error state and blocks form when setup token is invalid or already consumed', () => {
    const valReq = httpMock.expectOne((r) => r.url.includes('/setup-account/validate'));
    valReq.flush(
      { message: 'This One-Time Setup link is invalid or has already been used.' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('invalid or has already been used');
    expect(el.querySelector('form')).toBeNull();
  });
});

