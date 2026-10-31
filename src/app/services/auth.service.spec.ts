import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
} from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * SCRUM-129: the client-side authentication bypasses have been removed:
 *  - verifyOtp no longer accepts 123456 / 12345678 to fabricate a session,
 *  - verifyTotp no longer accepts 123456 / any 6-digit code to fabricate a session,
 *  - login no longer falls back to local directory credentials on server error.
 * Each flow must make a REAL HTTP call and surface server failures as errors.
 */
describe('AuthService client bypass removal (SCRUM-129)', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    // Seed cached "pending directory" data the old bypass would have trusted.
    localStorage.setItem(
      'vanguard_pending_dir_user',
      JSON.stringify({
        user: { id: 'cached-1', email: 'x@y.com', role: 'admin' },
        session: { access_token: 'cached-token' },
      }),
    );

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('verifyOtp with the old bypass code still calls the server (no fabricated session)', () => {
    let errored = false;
    service.verifyOtp('x@y.com', '123456', 'signup').subscribe({
      next: () => {},
      error: () => { errored = true; },
    });
    // The request MUST hit the backend rather than short-circuiting.
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
