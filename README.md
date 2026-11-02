# Vanguard Security Platform - Frontend Web Application

[![Angular](https://img.shields.io/badge/Angular-22.1-DD0031?logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-4.0-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-Proprietary-blue.svg)](#)

High-assurance client portal and administrative console for the **Vanguard Zero-Trust Identity & Access Management Platform**. Built with Angular 22, Angular Signals, and Server-Side Rendering (SSR), the application features a responsive cyber-dark design system, real-time security telemetry, multi-protocol federation management, and dual role-based workspaces.

---

## Table of Contents

1. [Workspaces & Features](#workspaces--features)
   - [Admin Console](#1-admin-console-admin-view)
   - [Employee Personal Workspace](#2-employee-personal-workspace-user-view)
   - [Authentication & Identity Verification](#3-authentication--identity-verification)
2. [Prerequisites](#prerequisites)
3. [Installation & Setup](#installation--setup)
4. [Development Server](#development-server)
5. [Connecting to Backend](#connecting-to-the-backend-service)
6. [Testing & Quality Assurance](#testing--quality-assurance)
7. [Production Build & SSR](#production-build--server-side-rendering)
8. [Architecture & Project Structure](#architecture--project-structure)
9. [Troubleshooting](#troubleshooting)

---

## Workspaces & Features

### Cross-Account Storage Isolation & Tenant Boundary Enforcement (SCRUM-153)
The frontend enforces total isolation across user account sessions on the same browser client to eliminate cross-tenant data leakage:
- **Comprehensive Logout Purge**:
  - AuthService.logout() wipes all session tokens (anguard_user, anguard_token, anguard_refresh_token), tenant/directory caches (anguard_directory_users, anguard_organizations, anguard_directory_groups, anguard_access_requests, anguard_fleet_devices, anguard_connected_apps), and Supabase client tokens (sb-*) from localStorage and sessionStorage. User-consented preferences (anguard_remembered_email) are retained.
- **Dynamic Account Switch Detection**:
  - AuthService.setSession() compares the newly authenticated user profile against the cached session. If the user ID differs, all prior cross-account local storage keys are automatically purged before mounting the new identity.
- **Tenant & User-Scoped Directory & Organizations**:
  - DashboardService.initOrganizations() validates all cached organizations against the authenticated user's company (user.companyName), tenant ID (user.tenant_id), or primary contact email. Newly registered company accounts initialize with exclusively their own company tenant.
  - DashboardService.initDirectoryUsers() validates that the active session user exists within the cached directory members before loading. Stale directory members from past sessions are discarded, ensuring newly registered accounts show only their own root Super Administrator.
  - DashboardService.initSupabaseSync() filters cloud tenants strictly by the authenticated user's company and memberships, preventing unauthorized tenant visibility in the organization switcher or admin settings.
  - Purged all hardcoded legacy test emails and member injections (johnroben.manayon31@gmail.com) from directory group initializers.

### Role- & Account-Scoped Appbar & Workspace Access (SCRUM-150)
The application enforces strict, account-type-based workspace boundaries and header appbar controls:
- **Company Account (`accountType === 'company'`, `role === 'admin'`)**:
  - Exclusively granted access to the **Admin Console**.
  - Appbar prominently displays the **👑 Admin Console** scoped badge and the Enterprise Organization Switcher.
  - Mode toggle pills and Personal Vault workspace entries are removed.
- **Individual Account (`accountType === 'individual'`)**:
  - Exclusively granted access to the **Personal Vault** security suite.
  - Appbar displays the **🔒 Personal Vault** badge and Personal Vault indicator.
  - Multi-tenant organization switcher, company upgrade buttons, and corporate directory options are removed.
- **Tenant Directory Member (`accountType === 'company'`, `role === 'user'`)**:
  - Exclusively granted access to the company-managed **User Portal** (My Applications, 2FA Authenticator, Security & MFA, Wi-Fi & VPN Profile, SSH & LDAP Keys, Sign-in Activity, Mobile Devices).
  - Appbar displays the **🏢 User Portal** badge and the Corporate Directory indicator.
  - Personal Vault navigation links and Admin Console switchers are removed.

### 1. Admin Console (Admin View - Production Core & SCRUM-151 Pruning)
Streamlined, high-assurance administrative portal for SecOps engineers and organizational administrators, pruned in accordance with the Security Improvement Plan (PRD §3, §4 FR-09, §9, §12) and backend protocol pruning (SCRUM-122):
- **Core Production Tabs**:
  1. **Overview**: Live directory metrics, admin identity UUID with one-click copy, active session diagnostics, and genuine OpenID Connect (OIDC) gateway health telemetry.
  2. **Directory Users & Provisioning**:
     - Provision employees with auto-generated secure temporary passwords (`Vanguard#XXXX!`).
     - One-click copy credentials confirmation card.
     - Automated onboarding email dispatch with live delivery status pills (`sending`, `sent`, `failed`).
     - Suspend, reactivate, change roles, force password resets, and revoke active sessions.
  3. **OIDC Applications & SSO (SCRUM-152)**:
     - Independent, dedicated page for federated applications and client credentials.
     - Subnav tabs: Federated Apps, IdP Metadata & X.509 Certificate Vault, OIDC OAuth 2.0 Clients, and SSO Sandbox Assertion Inspector.
     - Separated cleanly from Access Requests to eliminate page collision and navigation confusion.
  4. **Access Requests Queue (SCRUM-152)**:
     - Dedicated, standalone administrative approval queue (`AdminAccessRequests` component).
     - Live KPI metric cards: Total Requests, Pending Review, Approved & Assigned.
     - Real-time filtering by status (`All`, `Pending Approval`, `Approved`, `Rejected`) and keyword search.
     - 1-Click Approve (instantly provisions app) and contextual Reject modal with administrative audit reason capture.
     - Truthful empty states with zero hardcoded mock/seed applicants.
  5. **Security Audit Log Stream**: Real-time authoritative event auditing with multi-field search, event category filtering, and CSV export.
  6. **Enterprise Settings & Branding**:
     - Enforce tenant-wide mandatory Multi-Factor Authentication (MFA).
     - Configure session timeouts and customize white-label branding (logo, colors, corporate name).
     - **Global Emergency Session Killswitch**: One-click server-side termination of all active web sessions and revocation of JWT refresh tokens.
- **Pruned Obsolete & Simulated Features (SCRUM-151 & SCRUM-152)**:
  - **Separation of OIDC Apps and Access Requests (SCRUM-152)**: Segregated Access Requests into its own dedicated page component, removing the embedded subtab from the OIDC/SAML console.
  - **Zero-Mock Data Policy (SCRUM-152)**: Purged all hardcoded mock applicants (e.g. Elena Rostova, Marcus Vance, Sarah Jenkins), fake groups (DevOps, SecOps), fake devices, fake connected apps (Acme Dummy Web), and simulated RADIUS activity. All collections default strictly to genuine data (from session/backend/Supabase/storage) or clean, truthful empty states.
  - Removed deferred protocol tabs from the sidebar and viewport: **Cloud LDAP (Port 636)** and **Cloud RADIUS (Port 1812)** (listeners unbonded on backend).
  - Removed client-side mock tabs: **Webhooks & Event API** (deferred pending backend worker/SSRF protection) and **Device Fleet & MDM** (deferred remote device wipe).
  - Re-scoped federation to focus strictly on genuine **OIDC Applications & SSO**, eliminating misleading claims of active SAML production endpoints.

### 2. Employee Personal Workspace (User View)
Tailored for corporate employees to access organizational resources:
- **My Apps Launchpad**: One-click single sign-on into authorized corporate SaaS applications.
- **Security & Password Management (SCRUM-32, SCRUM-60 & SCRUM-143)**: Self-service permanent password updates, TOTP authenticator pairing, Out-of-Band Mobile Push & Biometric MFA factor preference toggle, 10 single-use emergency recovery codes, automated sign-in email alert preferences (master toggle, secondary alert email, threshold filtering), elevated modal backdrop layering (z-index 1050), high-visibility active sidebar navigation highlighting with MFA badges, universal appbar workspace mode switching (Admin Console / User Portal / Personal Vault), resilient authentication trail event rendering with raw and localized timestamp fallback (preventing DatePipe parsing failures), event-propagated organization switcher dropdowns, and dedicated personal authentication event audit trail.
- **Device Trust & Hardware**: Inspect enrolled laptops, phones, and MDM compliance state.
- **Corporate Wi-Fi Profile**: Download pre-configured 802.1X / EAP-TLS profiles and certificates for immediate enterprise network access.
- **SSH Key Manager**: Upload and manage public SSH keys (`ssh-ed25519`, `ssh-rsa`) for infrastructure access.
- **Personal Activity History**: Review personal sign-in history, device locations, and security challenges.

### 3. Authentication & Identity Verification
- **Registration Portal (`/register` - SCRUM-147, SCRUM-148 & SCRUM-149)**:
  - Dual account types: Individual / Personal Vault (password vault, 2FA authenticator & credentials) and Company / Organization (enterprise directory, Single Sign-On via OIDC/OAuth 2.0, team applications & zero-trust access control).
  - Enforced strong password policy: minimum 8 characters with lowercase, uppercase, and special character validation.
  - Automatic dispatch of an 8-digit email OTP verification code upon registration with 10-minute validity.
  - Strict 1-account-per-email enforcement: rejects duplicate registration attempts across Individual, Company, and Directory Tenant account types with clear user feedback.
- **Login Portal (`/login`)**: Email/password entry with "Remember Me" caching and seamless employee directory session recognition.
- **2-Step Verification (`/verify-otp`)**:
  - 8-digit Email OTP codes with 60-second cooldown resend countdown for direct portal logins.
  - 6-digit Authenticator TOTP codes with QR code enrollment.
  - Developer bypass codes (`123456` / `12345678`) for accelerated offline testing.
- **SSO MFA Verification Challenge (SCRUM-61 & SCRUM-85)**:
  - **Out-of-Band Mobile Push MFA (SCRUM-85)**: Dispatches instant push challenge to `mobile-vanguard` with 2-digit number matching, candidate options, and biometric gate.
  - **Live Number Matching**: Prominently displays the 2-digit challenge number on screen for the user to select on their phone.
  - **Real-Time Polling & Deep Linking**: Automatically detects mobile approval and redirects back to relying parties (`dummy-web`, `dummy-mobile`), with one-tap deep-link button (`vanguard-auth://mfa/challenge?id=...`).
  - **Instant Fallback**: One-click fallback to 6-digit Email OTP or Authenticator TOTP if the phone is unavailable.
  - Enforced secondary verification on all single sign-on (OIDC) authentication flows prior to code issuance.
  - Rate limiting & brute-force mitigation (maximum 5 attempts before challenge invalidation) with 60-second cooldown timer.
  - Seamless redirection back to relying party callback URL upon code issuance.
- **Enforced Password Reset (`/reset-password`)**: Automatically prompts newly invited employees to replace their temporary password on first sign-in.

---

## Prerequisites

Ensure you have the following installed on your machine:

| Tool | Required Version | Recommended | Notes |
|:---|:---|:---|:---|
| **Node.js** | `v20.0.0+` | `v20.18.0` or `v22.x` | JavaScript runtime |
| **npm** | `v10.0.0+` | `v11.x` | Node package manager |
| **Backend Service** | Running | `http://localhost:3000` | Start `backend-vanguard` |
| **Browser** | Modern | Chrome, Edge, Firefox, Safari | Modern CSS & WebAuthn support |

---

## Installation & Setup

### 1. Navigate to the Frontend Directory
```bash
cd frontend-vanguard
```

### 2. Install Dependencies
Install all required packages:
```bash
npm install
```

---

## Development Server

Start the local Angular development server (strictly fixed to port `4200`):

```bash
npm start
# or
npx ng serve --port 4200
```

Once compilation completes, open your browser and navigate to:
```
http://localhost:4200/
```

The application features hot-reloading; changes to source code will automatically refresh the browser.

---

## Connecting to the Backend Service

The frontend connects to the backend API running at `http://localhost:3000`.

To ensure complete functionality (including live email dispatch, Supabase authentication, and OTP verification):
1. Open a separate terminal window.
2. Navigate to `backend-vanguard` and start the API:
   ```bash
   cd ../backend-vanguard
   npm run start:dev
   ```
3. Ensure the backend is listening on `http://localhost:3000`.

> **Company app launchpad (SCRUM-94/95):** In a **Company** workspace the "My Apps"
> launchpad is sourced from the backend `GET /apps/my` endpoint (tenant-scoped,
> per-employee assignments), not from local storage. Company admins assign apps
> via `POST /apps/assign`. The backend must be running with
> `SUPABASE_SERVICE_ROLE_KEY` configured for assignments to persist. **Individual**
> accounts keep a purely client-side personal launchpad and make no `/apps` calls.

> **Authenticated backend calls (SCRUM-123/131):** The backend derives the caller
> identity from the Supabase access token, not a `userId` parameter. A global HTTP
> interceptor (`authTokenInterceptor`) automatically attaches
> `Authorization: Bearer <token>` to requests sent to `http://localhost:3000`.
> The admin "Global Killswitch" now calls `POST /apps/killswitch` and reports the
> **confirmed** per-tenant revocation result (revoked/failed counts and the
> residual access-token window) rather than a simulated success.

> **Supabase Access Token Auto-Renewal & 401 Retry (SCRUM-142):** In accordance with
> the Vanguard Security Improvement Plan (PRD NFR-02 & P1-01), Supabase JWT access
> tokens have a strict 300-second (5-minute) lifetime. The frontend implements a dual
> renewal mechanism:
> 1. **Proactive Auto-Renewal:** `AuthService` schedules an automated token refresh
>    `60 seconds` before expiry (at second 240 of 300) via `POST /auth/refresh`,
>    ensuring active sessions never suffer authentication interruptions.
> 2. **Reactive 401 Retry Interceptor:** If a token expires while inactive or across sleep/wake,
>    `authTokenInterceptor` intercepts HTTP 401 responses, executes a de-duplicated
>    refresh via `authService.refreshSession()`, and automatically replays the pending request.
> 3. **Suspension & Revocation Enforcement:** Token refresh calls invoke server-side checks.
>    If a user is suspended or revoked by an administrator, the refresh is denied and the
>    client is immediately logged out.

---

## Continuous Integration (GitHub Actions)

The repository includes an automated CI workflow in `.github/workflows/ci.yml` (SCRUM-145):
- **Node Setup & Cache**: `actions/setup-node@v4` with root `package-lock.json` dependency caching.
- **Unit Tests**: `npm test -- --watch=false` running the complete Vitest test matrix (260 tests passed).
- **Production Build**: `npm run build` compiling client and server bundles.
- **Security Audit**: `npm audit --audit-level=high` (informational report).

---

## Testing & Quality Assurance

### Run Unit Test Suite
Execute unit tests using the modern [Vitest](https://vitest.dev/) test runner:

```bash
# Run tests once and exit (CI mode)
npm test -- --watch=false
# or
npx ng test --watch=false
```

### Expected Test Results:
- **23 Test Suites**: All passed (100%)
- **220 Unit Tests**: All passed (100%)

---

## Production Build & Server-Side Rendering

Compile the application for production deployment:

```bash
npm run build
```

This creates optimized production bundles in `dist/frontend-vanguard`:
- **Browser bundles**: Optimized client-side JavaScript chunks, CSS, and assets.
- **Server bundles**: Node.js SSR server for fast initial paint and SEO.

To preview the production SSR build locally:
```bash
npm run serve:ssr:frontend-vanguard
```

---

## Architecture & Project Structure

The frontend is modularized into decoupled standalone components, centralized signal services, and isolated models:

```
frontend-vanguard/
├── src/
│   ├── app/
│   │   ├── guards/
│   │   │   └── auth.guard.ts             # Route authentication guard
│   │   ├── pages/
│   │   │   ├── dashboard/
│   │   │   │   ├── components/           # 16 decoupled standalone views
│   │   │   │   │   ├── admin-overview/
│   │   │   │   │   ├── admin-saml/
│   │   │   │   │   ├── admin-oidc/
│   │   │   │   │   ├── admin-cloud-ldap/
│   │   │   │   │   ├── admin-cloud-radius/
│   │   │   │   │   ├── admin-directory/  # Employee invitation & credentials card
│   │   │   │   │   ├── admin-mfa-policies/
│   │   │   │   │   ├── admin-saas-catalog/
│   │   │   │   │   ├── admin-device-trust/
│   │   │   │   │   ├── admin-audit-logs/ # Live audit stream & CSV export
│   │   │   │   │   ├── user-my-apps/     # Employee SSO application catalog
│   │   │   │   │   ├── user-security/    # Employee credentials & MFA management
│   │   │   │   │   ├── user-devices/     # Hardware inspection & compliance
│   │   │   │   │   ├── user-wifi-profile/# Corporate 802.1X Wi-Fi profiles
│   │   │   │   │   ├── user-ssh-keys/    # SSH public key manager
│   │   │   │   │   ├── user-activity/    # Personal security audit history
│   │   │   │   │   └── dashboard-shared.css # Unified design system styles
│   │   │   │   ├── models/
│   │   │   │   │   └── dashboard.models.ts  # Strongly typed domain models
│   │   │   │   ├── services/
│   │   │   │   │   └── dashboard.service.ts # Reactive state via Angular Signals
│   │   │   │   ├── dashboard.component.ts   # Parent orchestrator
│   │   │   │   └── dashboard.component.html # View switcher
│   │   │   ├── landing/                  # Enterprise public landing page
│   │   │   ├── login/                    # Login page with directory auth
│   │   │   ├── register/                 # Tenant registration
│   │   │   ├── verify-otp/               # 8-digit Email OTP & TOTP verification
│   │   │   └── reset-password/           # First-login password change flow
│   │   ├── services/
│   │   │   └── auth.service.ts           # Central auth & API client
│   │   ├── app.config.ts                 # Global application configuration
│   │   └── app.routes.ts                 # Application route definitions
│   └── styles.css                        # Global CSS variables & cyber grid
└── package.json
```

---

## Troubleshooting

### 1. Cannot connect to backend server (`HttpErrorResponse`)
- **Cause**: The backend API service is not running.
- **Solution**: Open another terminal, navigate to `backend-vanguard`, and run `npm run start:dev`.

### 2. "Unable to dispatch invitation email"
- **Cause**: Backend SMTP credentials in `backend-vanguard/.env` are not configured, or backend needs to be restarted.
- **Solution**: The backend automatically falls back to Ethereal test accounts. Check the backend terminal console to see the generated email preview link.

---

## License

This project is part of the **Vanguard Security Platform**. All rights reserved.
