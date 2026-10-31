import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/** Backend API origin whose requests should carry the Vanguard bearer token. */
const BACKEND_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

/**
 * Attaches the Supabase access token as `Authorization: Bearer <token>` to
 * requests bound for the Vanguard backend (SCRUM-131). The backend derives the
 * caller identity from this token (SCRUM-123); query `userId` is ignored there.
 * Only backend-origin requests are touched, so third-party calls never receive
 * the token.
 */
export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const isBackend = BACKEND_ORIGINS.some((o) => req.url.startsWith(o));
  if (!isBackend || req.headers.has('Authorization')) {
    return next(req);
  }
  const token = inject(AuthService).token();
  if (!token) {
    return next(req);
  }
  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};
