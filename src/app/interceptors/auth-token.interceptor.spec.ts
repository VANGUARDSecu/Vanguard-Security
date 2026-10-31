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
import { authTokenInterceptor } from './auth-token.interceptor';
import { AuthService } from '../services/auth.service';

/**
 * SCRUM-131: the interceptor attaches the Vanguard bearer token to backend
 * requests only, so the server can derive the caller identity (SCRUM-123).
 */
describe('authTokenInterceptor (SCRUM-131)', () => {
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
});
