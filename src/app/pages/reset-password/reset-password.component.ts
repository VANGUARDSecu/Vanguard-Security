import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export const passwordMatchValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  if (!password || !confirmPassword) return null;
  return password.value === confirmPassword.value ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly resetForm: FormGroup = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator }
  );

  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly submitted = signal<boolean>(false);

  // Live password value signal for reactivity
  readonly passwordValue = signal<string>('');
  readonly confirmPasswordValue = signal<string>('');

  // Password Security Criteria
  readonly hasMinLength = computed(() => this.passwordValue().length >= 6);
  readonly hasUppercase = computed(() => /[A-Z]/.test(this.passwordValue()));
  readonly hasNumber = computed(() => /[0-9]/.test(this.passwordValue()));
  readonly hasSpecialChar = computed(() => /[^A-Za-z0-9]/.test(this.passwordValue()));
  readonly isMatch = computed(() => {
    const p = this.passwordValue();
    const cp = this.confirmPasswordValue();
    return p.length > 0 && cp.length > 0 && p === cp;
  });

  // Strength score calculation (0 - 4)
  readonly strengthScore = computed(() => {
    const val = this.passwordValue();
    if (!val) return 0;
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10 || (/[A-Z]/.test(val) && /[a-z]/.test(val))) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    return score;
  });

  readonly strengthLabel = computed(() => {
    const score = this.strengthScore();
    if (score === 0) return '';
    if (score === 1) return 'Weak';
    if (score === 2) return 'Fair';
    if (score === 3) return 'Good';
    return 'Strong';
  });

  // Single active notification with auto-dismiss timer
  readonly notification = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  private notificationTimer: any = null;

  // One-Time Setup Onboarding Mode (SCRUM-168)
  readonly setupToken = signal<string | null>(null);
  readonly setupLoading = signal<boolean>(false);
  readonly setupTokenError = signal<string | null>(null);
  readonly setupInviteInfo = signal<{
    email: string;
    name: string;
    role: string;
    department: string;
    expiresAt?: string;
  } | null>(null);

  constructor() {
    this.resetForm.get('password')?.valueChanges.subscribe((val) => {
      this.passwordValue.set(val || '');
    });
    this.resetForm.get('confirmPassword')?.valueChanges.subscribe((val) => {
      this.confirmPasswordValue.set(val || '');
    });

    const token = this.route.snapshot?.queryParamMap?.get('token')?.trim() || null;
    if (token) {
      this.setupToken.set(token);
      this.setupLoading.set(true);
      this.authService.validateSetupToken(token).subscribe({
        next: (info) => {
          this.setupLoading.set(false);
          this.setupInviteInfo.set(info);
        },
        error: (err: Error) => {
          this.setupLoading.set(false);
          this.setupTokenError.set(
            err.message || 'This One-Time Setup link is invalid, expired, or has already been used.'
          );
        },
      });
    }
  }

  togglePassword(): void {
    this.showPassword.update((val) => !val);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update((val) => !val);
  }

  showNotification(type: 'success' | 'error', message: string, durationMs = 5000): void {
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }

    this.notification.set({ type, message });

    this.notificationTimer = setTimeout(() => {
      this.dismissNotification();
    }, durationMs);
  }

  dismissNotification(): void {
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer);
      this.notificationTimer = null;
    }
    this.notification.set(null);
  }

  onSubmit(): void {
    this.submitted.set(true);

    if (this.resetForm.invalid) {
      if (this.resetForm.hasError('passwordMismatch')) {
        this.showNotification('error', 'Passwords do not match. Please verify both fields.');
      } else {
        this.showNotification('error', 'Please enter a valid password (minimum 6 characters).');
      }
      return;
    }

    this.isLoading.set(true);
    const newPassword = this.resetForm.value.password;
    const token = this.setupToken();

    if (token) {
      this.authService.completeSetupAccount(token, newPassword).subscribe({
        next: (response) => {
          this.isLoading.set(false);
          this.resetForm.reset();
          this.submitted.set(false);
          if (response.session?.access_token && response.user) {
            this.authService.setSession(response.user, {
              access_token: response.session.access_token,
              refresh_token: response.session.refresh_token,
              expires_at: response.session.expires_at,
            });
            this.showNotification(
              'success',
              response.message || 'Account setup complete! Redirecting to dashboard...',
              3000
            );
            setTimeout(() => {
              this.router.navigate(['/dashboard']);
            }, 800);
          } else {
            this.showNotification(
              'success',
              response.message || 'Account setup complete! Redirecting to sign in...',
              4000
            );
            setTimeout(() => {
              this.router.navigate(['/login']);
            }, 1500);
          }
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.showNotification('error', err.message || 'Failed to complete account setup. Please try again.');
        },
      });
      return;
    }

    this.authService.resetPassword(newPassword).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.showNotification(
          'success',
          response.message || 'Password successfully updated! Redirecting to sign in...',
          4000
        );
        this.resetForm.reset();
        this.submitted.set(false);

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1500);
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.showNotification('error', err.message || 'Failed to update password. Please try again.');
      },
    });
  }

  onCancel(): void {
    this.authService.logout();
  }
}
