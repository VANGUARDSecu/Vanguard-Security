import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { RegisterComponent } from './pages/register/register.component';
import { VerifyOtpComponent } from './pages/verify-otp/verify-otp.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { PaymongoSandboxComponent } from './pages/paymongo-sandbox/paymongo-sandbox.component';
import { RevokeSessionComponent } from './pages/revoke-session/revoke-session.component';
import { MobileOAuthCallbackComponent } from './pages/mobile-oauth-callback/mobile-oauth-callback.component';
import { authGuard } from './guards/auth.guard';

import { Landing } from './pages/landing';

export const routes: Routes = [
  { path: '', component: Landing, title: 'Vanguard Security - Zero-Trust IAM & Access Platform' },
  { path: 'login', component: LoginComponent, title: 'Vanguard - Sign In' },
  { path: 'auth/mobile-callback', component: MobileOAuthCallbackComponent, title: 'Vanguard - Returning to Mobile App' },
  { path: 'register', component: RegisterComponent, title: 'Vanguard - Create Account' },
  { path: 'verify-otp', component: VerifyOtpComponent, title: 'Vanguard - 2-Step Verification' },
  { path: 'forgot-password', component: ForgotPasswordComponent, title: 'Vanguard - Forgot Password' },
  { path: 'reset-password', component: ResetPasswordComponent, title: 'Vanguard - Reset Password' },
  { path: 'setup-account', component: ResetPasswordComponent, title: 'Vanguard - One-Time Account Setup' },
  { path: 'revoke-session', component: RevokeSessionComponent, title: 'Vanguard - Emergency Session Revocation' },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard], title: 'Vanguard - Security Dashboard' },
  { path: 'paymongo-sandbox', component: PaymongoSandboxComponent, canActivate: [authGuard], title: 'PayMongo Checkout (Sandbox)' },
  { path: '**', redirectTo: '' },
];
