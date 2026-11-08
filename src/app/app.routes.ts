import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { RegisterComponent } from './pages/register/register.component';
import { VerifyOtpComponent } from './pages/verify-otp/verify-otp.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { authGuard } from './guards/auth.guard';

import { Landing } from './pages/landing';

export const routes: Routes = [
  { path: '', component: Landing, title: 'Vanguard Security - Zero-Trust IAM & Access Platform' },
  { path: 'login', component: LoginComponent, title: 'Vanguard - Sign In' },
  { path: 'register', component: RegisterComponent, title: 'Vanguard - Create Account' },
  { path: 'verify-otp', component: VerifyOtpComponent, title: 'Vanguard - 2-Step Verification' },
  { path: 'forgot-password', component: ForgotPasswordComponent, title: 'Vanguard - Forgot Password' },
  { path: 'reset-password', component: ResetPasswordComponent, title: 'Vanguard - Reset Password' },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard], title: 'Vanguard - Security Dashboard' },
  { path: '**', redirectTo: '' },
];
