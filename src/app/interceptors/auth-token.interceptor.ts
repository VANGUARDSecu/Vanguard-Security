import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

/** Backend API origin whose requests should carry the Vanguard bearer token. */
const BACKEND_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(environment.apiUrl ? [environment.apiUrl] : []),
];

/** Endpoints that should not attempt automatic 401 token refresh retry. */
const NO_REFRESH_PATHS = ['/auth/login', '/auth/refresh', '/auth/verify-otp', '/auth/verify-totp', '/auth/signup'];

/**
 * Attaches the Supabase access token as `Authorization: Bearer <token>` to
 * requests bound for the Vanguard backend (SCRUM-131). The backend derives the
 * caller identity from this token (SCRUM-123); query `userId` is ignored there.
 * Only backend-origin requests are touched, so third-party calls never receive
 * the token.
 *
 * When an access token expires (300s TTL per NFR-02), catches HTTP 401 errors,
 * triggers session renewal via AuthService.refreshSession(), and replays the
 * request with the fresh token (SCRUM-142).
 */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const isBackend = BACKEND_ORIGINS.some((o) => req.url.startsWith(o));
  if (!isBackend || req.headers.has('Authorization')) {
    return next(req);
  }
  const authService = inject(AuthService);
  const token = authService.token();
  if (!token) {
    return next(req);
  }

  const authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  const isNoRefresh = NO_REFRESH_PATHS.some((p) => req.url.includes(p));

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !isNoRefresh &&
        authService.hasRefreshToken()
      ) {
        return authService.refreshSession().pipe(
          switchMap((res) => {
            const newToken = res.session?.access_token || authService.token();
            return next(
              req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
              })
            );
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
