import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // SCRUM-163 & SCRUM-176: If OAuth callback tokens/code are present in URL, forward to /login cleanly.
  // If an OAuth challenge is actively being processed, allow it to execute cleanly.
  if (typeof window !== 'undefined') {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const hasOAuthTokens = hash.includes('access_token=') || search.includes('code=');

    if (hasOAuthTokens) {
      const targetUrl = '/login' + (search ? search : '') + (hash ? hash : '');
      if (typeof router.navigateByUrl === 'function') {
        router.navigateByUrl(targetUrl);
      } else if (typeof router.navigate === 'function') {
        router.navigate(['/login']);
      }
      return false;
    }

    if (authService.isChallengingOAuth) {
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
