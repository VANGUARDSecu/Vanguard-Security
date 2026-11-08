import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // SCRUM-163: If OAuth callback tokens/code are present in URL or an OAuth challenge is actively
  // being processed, do NOT redirect to /login. Allow checkForOAuthCallback() to execute cleanly.
  if (typeof window !== 'undefined') {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const isOAuthCallback =
      hash.includes('access_token=') ||
      search.includes('code=') ||
      authService.isChallengingOAuth;

    if (isOAuthCallback) {
      return false;
    }
  }

  // If not authenticated, redirect to login
  if (!authService.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }

  // SCRUM-155: If password reset is required (e.g. temporary password login or recovery), force reset-password
  if (authService.isPasswordResetRequired()) {
    router.navigate(['/reset-password']);
    return false;
  }

  return true;
};
