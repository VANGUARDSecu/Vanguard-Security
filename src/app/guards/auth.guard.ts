import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

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
