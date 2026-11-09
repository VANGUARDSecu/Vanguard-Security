import { Component, inject, signal } from '@angular/core';
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
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Custom validator to check that password and confirmPassword match
 */
export const passwordMatchValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');

  if (!password || !confirmPassword) return null;

  return password.value === confirmPassword.value
    ? null
    : { passwordMismatch: true };
};

/**
 * Custom validator enforcing at least 8 characters, uppercase, lowercase, and special character
 */
export const strongPasswordValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const value = control.value;
  if (!value) return null;

  const errors: ValidationErrors = {};
  if (value.length < 8) errors['minlength'] = true;
  if (!/[a-z]/.test(value)) errors['missingLower'] = true;
  if (!/[A-Z]/.test(value)) errors['missingUpper'] = true;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(value)) errors['missingSpecial'] = true;

  return Object.keys(errors).length > 0 ? errors : null;
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Account Type Selection: 'individual' (Personal Vault) vs 'company' (Enterprise Directory)
  readonly accountType = signal<'individual' | 'company'>('individual');

  // Registration Form definition
  readonly registerForm: FormGroup = this.fb.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      companyName: [''],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, strongPasswordValidator]],
      confirmPassword: ['', [Validators.required]],
      agreeTerms: [false, [Validators.requiredTrue]],
    },
    { validators: passwordMatchValidator }
  );

  setAccountType(type: 'individual' | 'company'): void {
    this.accountType.set(type);
    const companyControl = this.registerForm.get('companyName');
    const phoneControl = this.registerForm.get('phone');
    if (type === 'individual') {
      companyControl?.clearValidators();
      phoneControl?.clearValidators();
    } else {
      companyControl?.setValidators([Validators.required, Validators.minLength(2)]);
      phoneControl?.setValidators([Validators.required, Validators.pattern(/^[+]?[\d\s().-]{7,20}$/)]);
    }
    companyControl?.updateValueAndValidity();
    phoneControl?.updateValueAndValidity();
  }

  // State signals
  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly submitted = signal<boolean>(false);

  // Legal modal state signal
  readonly legalModal = signal<'terms' | 'privacy' | null>(null);

  // Single active timed notification
  readonly notification = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  private notificationTimer: any = null;

  openLegalModal(type: 'terms' | 'privacy', event?: Event): void {
    if (event) event.preventDefault();
    this.legalModal.set(type);
  }

  closeLegalModal(): void {
    this.legalModal.set(null);
  }

  acceptTermsFromModal(): void {
    this.registerForm.patchValue({ agreeTerms: true });
    this.closeLegalModal();
  }

  togglePassword(): void {
    this.showPassword.update((val) => !val);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update((val) => !val);
  }

  toggleAgreeTerms(): void {
    const current = this.registerForm.get('agreeTerms')?.value;
    this.registerForm.patchValue({ agreeTerms: !current });
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

  get passwordControl() {
    return this.registerForm.get('password');
  }

  get passwordValue(): string {
    return this.passwordControl?.value || '';
  }

  get hasMinLength(): boolean {
    return this.passwordValue.length >= 8;
  }

  get hasLower(): boolean {
    return /[a-z]/.test(this.passwordValue);
  }

  get hasUpper(): boolean {
    return /[A-Z]/.test(this.passwordValue);
  }

  get hasSpecial(): boolean {
    return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(this.passwordValue);
  }

  get allPasswordRulesMet(): boolean {
    return this.hasMinLength && this.hasLower && this.hasUpper && this.hasSpecial;
  }

  onSubmit(): void {
    this.submitted.set(true);

    if (this.registerForm.invalid) {
      if (this.registerForm.get('password')?.invalid) {
        this.showNotification(
          'error',
          'Password must be at least 8 characters long with uppercase, lowercase, and a special character.'
        );
      } else if (this.registerForm.errors?.['passwordMismatch']) {
        this.showNotification('error', 'Passwords do not match. Please verify both fields.');
      } else if (this.registerForm.get('agreeTerms')?.invalid) {
        this.showNotification('error', 'Please accept the Terms of Service and Privacy Policy.');
      } else {
        this.showNotification('error', 'Please fill in all required registration fields properly.');
      }
      return;
    }

    this.isLoading.set(true);
    const formVal = this.registerForm.value;
    const type = this.accountType();

    const payload = {
      email: formVal.email.trim(),
      password: formVal.password,
      firstName: formVal.firstName.trim(),
      lastName: formVal.lastName.trim(),
      companyName: type === 'company'
        ? (formVal.companyName?.trim() || '')
        : (formVal.companyName?.trim() || `${formVal.firstName.trim()}'s Personal Vault`),
      phone: formVal.phone?.trim() || '',
      accountType: type,
    };

    this.authService.signup(payload).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.showNotification(
          'success',
          response.message || 'Account registered! Please enter your 8-digit email verification code.',
          4000
        );

        setTimeout(() => {
          const queryParams: Record<string, string> = { email: payload.email, mode: 'signup' };
          if (typeof sessionStorage !== 'undefined') {
            try {
              const rawSso = sessionStorage.getItem('vanguard_sso_pending');
              if (rawSso) {
                Object.assign(queryParams, JSON.parse(rawSso));
              }
            } catch {}
          }
          this.router.navigate(['/verify-otp'], {
            queryParams,
          });
        }, 1000);
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.showNotification('error', err.message || 'Registration failed. Please try again.');
      },
    });
  }
}
