import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { authTokenInterceptor } from './auth-token.interceptor';
import { AuthService } from '../services/auth.service';

/**
 * SCRUM-131 & SCRUM-142: the interceptor attaches the Vanguard bearer token to backend
 * requests, and automatically refreshes + retries requests on 401 token expiration.
 */
describe('authTokenInterceptor (SCRUM-131 & SCRUM-142)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withInterceptors([authTokenInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    (auth.token as any).set('tok-123');
    (auth.refreshToken as any).set('ref-456');
  });

  afterEach(() => httpMock.verify());

  it('adds the bearer token to backend requests', () => {
    http.get('http://localhost:3000/apps/my').subscribe();
    const req = httpMock.expectOne('http://localhost:3000/apps/my');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-123');
    req.flush([]);
  });

  it('does NOT add the token to third-party requests', () => {
    http.get('https://facebook.com/api').subscribe();
    const req = httpMock.expectOne('https://facebook.com/api');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not override an existing Authorization header', () => {
    http
      .get('http://localhost:3000/vault', {
        headers: { Authorization: 'Bearer explicit' },
      })
      .subscribe();
    const req = httpMock.expectOne('http://localhost:3000/vault');
    expect(req.request.headers.get('Authorization')).toBe('Bearer explicit');
    req.flush({});
  });

  it('sends no Authorization header when there is no token', () => {
    (auth.token as any).set(null);
    http.get('http://localhost:3000/apps/my').subscribe();
    const req = httpMock.expectOne('http://localhost:3000/apps/my');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('catches 401 error, calls refreshSession(), and replays request with refreshed token (SCRUM-142)', () => {
    const refreshSpy = vi.spyOn(auth, 'refreshSession').mockReturnValue(
      of({
        success: true,
        session: {
          access_token: 'fresh-jwt-token-999',
          refresh_token: 'fresh-refresh-token',
        },
      } as any)
    );

    let responseData: any = null;
    http.get('http://localhost:3000/apps/my').subscribe((data) => {
      responseData = data;
    });

    // Initial request with original token
    const initialReq = httpMock.expectOne('http://localhost:3000/apps/my');
    expect(initialReq.request.headers.get('Authorization')).toBe('Bearer tok-123');

    // Server returns 401 (e.g. token expired past 300s TTL)
    initialReq.flush({ message: 'jwt expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(refreshSpy).toHaveBeenCalled();

    // Interceptor retries the request with new token
    const retriedReq = httpMock.expectOne('http://localhost:3000/apps/my');
    expect(retriedReq.request.headers.get('Authorization')).toBe('Bearer fresh-jwt-token-999');

    retriedReq.flush([{ id: 'app-1', name: 'Slack' }]);
    expect(responseData).toEqual([{ id: 'app-1', name: 'Slack' }]);
  });

  it('does NOT retry when 401 error occurs on excluded login or refresh paths', () => {
    const refreshSpy = vi.spyOn(auth, 'refreshSession');

    let errorReceived: any = null;
    http.post('http://localhost:3000/auth/login', {}).subscribe({
      error: (err) => {
        errorReceived = err;
      },
    });

    const req = httpMock.expectOne('http://localhost:3000/auth/login');
    req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(errorReceived.status).toBe(401);
  });
});
