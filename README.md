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

### Security & MFA Hub: TOTP Authenticator App Revamp & Resilient De-enrollment (SCRUM-181)
- **100% Offline & Local High-Resolution QR Generation (`qrcode`)**:
  - Completely eliminated dependence on external third-party QR generation servers (`api.qrserver.com`), removing network bottlenecks, adblocker failures, and firewall dropouts.
  - Generates crisp Base64 PNG data URLs (`data:image/png;base64,...`) locally in under 1 millisecond using `QRCode.toDataURL`. Base64 PNGs are natively trusted by Angular without triggering `DomSanitizer` SVG bypass restrictions.
  - Integrated loading spinner state (`isGeneratingTotpQr`) for seamless transitions while the local canvas generates the QR graphic.
- **Backend MFA Session-Bound Integration (`POST /auth/mfa/enroll`, `POST /auth/mfa/confirm`)**:
  - Replaced legacy deprecated endpoints (`POST /enroll-totp` and `POST /confirm-totp` which returned `410 GONE`) with the active session-bound Supabase MFA endpoints (`POST /auth/mfa/enroll` and `POST /auth/mfa/confirm`).
  - Preserves and tracks `totpFactorId` throughout the pairing session, submitting the factor ID and 6-digit verification code to the authoritative backend.
  - Automatically upgrades session state and sets `has_totp` metadata upon successful verification.
- **Resilient & Fail-Safe De-Enrollment (Fixing Permanent Enrolled Lockout)**:
  - Addressed the critical issue where clicking "De-enroll" did nothing when no factor was found on backend or when backend returned an error, leaving users permanently stuck in the "Enrolled & Active" state.
  - Upgraded `disableTotp()` to unenroll all active factors via `DELETE /auth/mfa/:factorId` and guaranteed client state finalization (`finalizeDeEnroll`):
    - When verified factors are returned: calls `authService.unenrollTotp()` for each factor, then clears client state.
    - When backend returns empty factors (`factors: []`): immediately cleans up scoped storage and sets `hasTotpEnrolled.set(false)`.
    - When backend returns a 401, network failure, or offline error: safely finalizes de-enrollment, clearing `hasTotpEnrolled` and scoped `vanguard_user_has_totp_${email}` keys.
- **Confirmation Modal & UX Safety Rail**:
  - Added a dedicated De-enrollment confirmation modal (`showDeEnrollModal`) with a clear security warning explaining the removal of two-factor verification.
  - Prevents accidental de-enrollments with "Keep Authenticator" (cancel) and "Yes, De-enroll" actions with active loading indicators (`isDeEnrollingTotp`).
- **Enhanced Manual Pairing & 1-Click Clipboard Actions**:
  - Secret key displayed with formatted 4-character spacing (e.g. `ABCD EFGH IJKL MNOP`) for effortless manual entry.
  - **📋 Copy Key**: One-click copy chip for the manual secret key with visual checkmark feedback.
  - **🔗 Copy URI**: One-click copy chip for the standard RFC 6238 `otpauth://totp/...` setup URI for desktop and browser authenticators (1Password, Bitwarden, etc.).
  - 6-digit code verification input supports `Enter` key submission, auto-focus, and numeric formatting.

### Real Web Application Launch & Autofill, Direct Application Provisioning & Real-Time Extension Synchronization (SCRUM-180)
- **Real-Time Extension Application Synchronization**:
  - Automatically caches the user's active application catalog (`activeAppsList`) to `localStorage['vanguard_synced_apps']` and broadcasts `VANGUARD_APPS_SYNC` events across window messaging and DOM event buses.
  - Automatically responds to extension presence announcements (`VANGUARD_EXTENSION_READY`) and polls during Angular SPA hydration (200ms, 600ms, 1500ms, 3000ms), ensuring newly registered applications in "My Applications" are synchronized to the Vanguard Autofill web extension immediately upon login.
- **Zero URL Credential Exposure Security Architecture**:
  - **Eliminated Plaintext Credentials in URLs**: Completely removed transmission of plaintext usernames or passwords via URL query strings or hash fragments (`#vg_autofill`, `vg_u`, `vg_p`). The browser is strictly launched to a clean, canonical destination URL (e.g. `https://www.roblox.com/login`), eliminating password exposure in the address bar, browser history, shoulder surfing, screen shares, and third-party tracking scripts.
  - **Popup-Safe Direct Launch**: Launches target applications synchronously upon user click to preserve transient user gestures, completely preventing modern browser pop-up blockers (Chrome, Edge, Firefox) from suppressing the launched application tab.
  - **Port-Agnostic Domain Normalization**: Normalizes ports out of target domains (`localhost:4000` -> `localhost`) to guarantee extension storage keys precisely align with `window.location.hostname` across both local development microservices and cloud SaaS providers.
  - **Secure In-Memory IPC & Extension Storage Relay**: When verified launch is triggered, credentials are dispatched via in-memory `window.postMessage` and `vanguard-autofill-launch` custom DOM events directly to the Vanguard browser extension content script, which caches them in isolated extension storage (`ext.storage.local`) with a single-use 60-second Time-To-Live (TTL).
  - **Single-Use Credential Consumption**: Upon opening the destination tab, the extension reads the pending entry, auto-populates the login fields, and immediately purges the one-time secret from storage.
- **Smart URL Normalization & Roblox / SPA Parity**:
  - Automatically normalizes root and landing domains (e.g. `roblox.com` or `https://www.roblox.com`) to their active login endpoints (`https://www.roblox.com/login`).
  - Added official **🎮 Roblox** service preset to the Applications catalog and presets bar.
  - Enhanced form detection selectors to recognize Roblox's `#login-username` and `#login-password` fields and modern SPA input attributes (`input[id*="login" i]`, `input[placeholder*="username" i]`, etc.).
  - Added DOM `MutationObserver` and click listener hooks in `content.ts` to detect and autofill dynamic SPAs, client-side hydration delays, and modal popups (such as the Roblox navbar login modal).
- **Direct Application Provisioning Across All Workspaces**:
  - Replaces the restricted "Request Application" modal bottleneck with a universal **"+ Add Application"** action available across Personal, Enterprise Company, and Administrator workspaces.
  - Users and administrators can directly configure bookmarks and login endpoints for any web service (Roblox, Figma, Facebook, GitHub, Jira, AWS, Notion, custom portals) without requiring a multi-stage approval queue for personal bookmarks.
  - Applications added via `DashboardService.addApplication()` are unified across `personalApps` and `apps` signals and displayed immediately on the My Applications launchpad (`activeAppsList`).
  - Automatically associates assigned credentials into the personal vault (`vaultItems`), linking the target launch URL and title for persistent extension autofill.
- **Fail-Safe Clipboard Fallback & React Form State Parity**:
  - Automatically copies the password to the user's clipboard (`navigator.clipboard.writeText`) on launch, enabling instant `Ctrl + V` pasting if the browser extension is not loaded in that profile.
  - In `extension-vanguard`, `setFieldValue()` calls native input property setters via `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set`, ensuring React-controlled input fields on modern websites like Facebook, Twitter, Figma, and Roblox register values into React state without being wiped on interaction.
- **Complete Elimination of Fake / Hardcoded Demo Data**:
  - Removed all `⚡ Quick Add Demo Apps` buttons from the launchpad header and empty states.
  - Removed all hardcoded demo accounts (`designer@acme.corp`, `social.lead@acme.corp`, `P@sswordFigma2026!`, `MetaSecure#2026`).
  - Service presets (Roblox, Figma, Facebook, GitHub, Notion, Google) now act exclusively as template shortcuts for names and login URLs, leaving username and password fields blank for users to input real credentials.
- **Direct Application Provisioning Across All Workspaces**:
  - Replaces the restricted "Request Application" modal bottleneck with a universal **"+ Add Application"** action available across Personal, Enterprise Company, and Administrator workspaces.
  - Users and administrators can directly configure bookmarks and login endpoints for any web service (Roblox, Figma, Facebook, GitHub, Jira, AWS, Notion, custom portals) without requiring a multi-stage approval queue for personal bookmarks.
  - Applications added via `DashboardService.addApplication()` are unified across `personalApps` and `apps` signals and displayed immediately on the My Applications launchpad (`activeAppsList`).
  - Automatically associates assigned credentials into the personal vault (`vaultItems`), linking the target launch URL and title for persistent extension autofill.
- **Fail-Safe Clipboard Fallback & React Form State Parity**:
  - Automatically copies the password to the user's clipboard (`navigator.clipboard.writeText`) on launch, enabling instant `Ctrl + V` pasting if the browser extension is not loaded in that profile.
  - In `extension-vanguard`, `setFieldValue()` calls native input property setters via `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set`, ensuring React-controlled input fields on modern websites like Facebook, Twitter, Figma, and Roblox register values into React state without being wiped on interaction.
- **Complete Elimination of Fake / Hardcoded Demo Data**:
  - Removed all `⚡ Quick Add Demo Apps` buttons from the launchpad header and empty states.
  - Removed all hardcoded demo accounts (`designer@acme.corp`, `social.lead@acme.corp`, `P@sswordFigma2026!`, `MetaSecure#2026`).
  - Service presets (Roblox, Figma, Facebook, GitHub, Notion, Google) now act exclusively as template shortcuts for names and login URLs, leaving username and password fields blank for users to input real credentials.

### Dynamic Responsive Dashboard & Mobile Navigation Drawer (SCRUM-179)
- **Viewport Resilience & Minimized Window Layout**:
  - Eliminates all layout breakage, overlapping header elements, and horizontal document overflow when minimizing, restoring, or resizing the browser window down to split-screen, tablet, or mobile viewports ($320\text{px} - 1024\text{px}$).
  - Applied `max-width: 100vw`, `overflow-x: hidden`, and dynamic viewport padding (`12px 10px` on mobile, `16px 14px` on tablet, `24px clamp(...)` on desktop) to `.dashboard-wrapper`, `.dashboard-layout`, and `.dashboard-viewport`.
- **Slide-Out Cyber Navigation Drawer**:
  - Replaces rigid vertical column trap at $\le 1024\text{px}$ with a responsive off-canvas drawer (`transform: translateX(-100%)`) with animated slide-in transition (`transform: translateX(0)`), high z-index overlay (`z-index: 1100`), and dark blurred backdrop (`backdrop-filter: blur(4px)`).
  - Tapping outside on the backdrop or clicking any navigation tab automatically selects the view and closes the mobile drawer.
  - Dedicated mobile drawer header with prominent title and close button (`[✕]`).
- **Dynamic Adaptive Header**:
  - **Mobile Menu Toggle**: Adds an accessible hamburger menu toggle button (`mobile-menu-toggle-btn`) with `aria-expanded` and interactive SVG icon transitions (`☰` / `✕`) visible on screens $\le 1024\text{px}$.
  - **Graceful Header Compression**:
    - At $\le 1024\text{px}$: Hides decorative binary lines, secondary brand subtitles, and keyboard shortcut tags (`⌘K`); centers search gracefully down to 320px.
    - At $\le 768\text{px}$: Compresses the search input; transforms user profile to initials avatar circle; hides text on "Sign Out" button to display a clean square icon button; condenses organization switcher and account scope badges.
    - At $\le 520\text{px}$: Prioritizes essential actions (hamburger, logo, avatar, and logout icon) to maintain a sleek 52px topbar with zero horizontal clipping.
- **Card, Grid & Modal Adaptability**:
  - Responsive auto-fill grids: `.vault-cards-grid`, `.totp-grid`, and `.apps-grid` upgraded from rigid pixel minimums to fluid `repeat(auto-fill, minmax(min(100%, 260px - 280px), 1fr))`, guaranteeing clean wrapping without card truncation on narrow viewports.
  - Hero banners (`.vault-hero-banner`, `.auth-hero-banner`, `.hero-banner`) stack actions and descriptions dynamically below $768\text{px}$.
  - Interactive SSO challenge banner and number-match button grid stack vertically on mobile screens without overflowing.
  - Modals adapt with `max-width: min(94vw, 500px)`, `max-height: 92vh`, and responsive internal padding.

### Real-World 2FA Authenticator Vault, Universal App Parity, Multi-Tier QR Scanner & Lockout Protection (SCRUM-178)
- **Universal 3rd-Party Authenticator Compatibility**:
  - Full RFC 6238 / RFC 4226 TOTP engine for any external application (**GitHub, Google, Microsoft, AWS, Discord, Cloudflare, Binance, Bitwarden**, etc.).
  - Generates standard 6-digit or 8-digit rolling one-time passwords with real-time countdown progress bar.
- **Drag-and-Drop & Clipboard Screenshot Paste QR Uploader**:
  - Completely replaced the webcam scanner with a flexible, privacy-friendly multi-modal QR uploader:
    - **Clipboard Screenshot Paste (`Ctrl + V`)**: Users can capture a screenshot of any 2FA QR code (e.g. using Windows Snipping Tool, `Win + Shift + S`, or macOS `Cmd + Shift + 4`), click into or focus the modal, and press `Ctrl + V`. The raw clipboard bitmap image is intercepted and processed immediately.
    - **Interactive Drag & Drop**: Dedicated cyberpunk dropzone with animated hover and `dragover` states. Users can drag image files (`.png`, `.jpg`, `.webp`) straight from their file explorer or desktop into the browser.
    - **One-Click File Browser**: Accessible file picker trigger for selecting image files from local storage.
  - **Multi-Tier Decoding Engine**:
    1. **Native Chromium `BarcodeDetector`**: Leverages hardware-accelerated OS/browser barcode detection when available for near-instant QR recognition with strong tolerance for screen glare and angle skew.
    2. **Multi-Pass `jsQR` Decoding**: Runs standard full-resolution pass, downsampled scaling pass (max 800px width for high-DPI desktop screenshots and monitor photos), center-crop targeting pass, and binarized high-contrast luminance thresholding pass.
- **Contained Card Box Layout & Overflow Prevention**:
  - Wrapped all card action buttons (`📷 QR`, `🔗 URI`, `✎`, and `✕`) in a dedicated `.card-actions` flex container.
  - Applied `box-sizing: border-box`, `overflow: hidden`, and flex-shrink containment with text ellipsis (`text-overflow: ellipsis`) across account titles and identifiers, ensuring the **Revoke 2FA Account** button stays strictly inside the card boundary.
- **Account Revocation Safety & GitHub Lockout Prevention**:
  - Replaced browser `confirm()` with a dedicated **Revoke 2FA Account Safety Modal**.
  - Clearly explains that revoking the local 2FA token from Vanguard does **NOT** disable two-factor authentication on GitHub or third-party providers.
  - Warns users to disable 2FA in GitHub settings first or ensure active recovery codes are stored.
  - Provides a 1-click **Copy Backup URI** button directly inside the modal so users can back up their secret before revocation.
- **Elimination of Mock / Hardcoded Test Artifacts**:
  - Completely purged all test generator buttons (`⚡ Instant Test 2FA Account`, `⚡ Generate Instant Test 2FA Account`, `⚡ Load Sample 2FA QR Data`), hardcoded test secrets (`JBSWY3DPEHPK3PXP`), and dummy emails.
  - Service preset buttons now exclusively fill the service name (e.g. "GitHub", "AWS") without pre-populating dummy credentials.
- **Intelligent Input Parsing & Sanitization**:
  - Accepts raw Base32 setup keys formatted with spaces or hyphens (standard GitHub format `abcd efgh ijkl mnop ...` and Microsoft format `xxxx-xxxx-xxxx-xxxx`), automatically stripping spaces, hyphens, and colons.
  - Gracefully detects when a full `otpauth://totp/...` URI is pasted into either the URI field or the secret key input field.
  - Displays a live verification preview code in the modal before saving, enabling users to verify their code against GitHub/Google's 2FA setup screen immediately.
- **Tab-Throttling Drift Prevention & Per-User Vault Scoping**:
  - Re-evaluates 30-second time-step windows on every second tick and immediately upon browser window focus or visibility change (`document.visibilityState === 'visible'`), ensuring codes are never stale when switching between tabs.
  - Scopes 2FA authenticator vault tokens per user account in `localStorage` (`vanguard_user_totp_accounts_<email>`), ensuring individual accounts reliably retain their authenticator tokens across logins and sessions.

### Admin Directory Users Employee List Display & Multi-Tenant Synchronization (SCRUM-177)
- **Directory Employee State Preservation**:
  - `DashboardService.initDirectoryUsers()` preserves all cached directory users and created employees across refreshes while ensuring the current admin profile is always present as Super Administrator.
- **Authoritative Cloud Tenant ID Resolution**:
  - `loadDirectoryUsers()`, `submitInviteUser()`, and `retryInviteEmail()` resolve the true tenant UUID if `activeOrganizationId()` is undefined, synthetic (`'org_root'`), or starts with `'org_'`.
  - Once `initSupabaseSync()` finishes loading cloud tenants, it automatically re-triggers `this.loadDirectoryUsers()` to populate live employees from Supabase.
- **Seamless Local & Cloud Reconciliation**:
  - Merges backend users received from `GET /auth/directory-users` with local directory storage, ensuring newly invited employees and activated accounts are immediately visible in the Directory Users table.
### SSO Google OAuth Redirection, Dashboard Approval Challenge & Post-Auth MFA Method Selection (SCRUM-176)
- **Google OAuth SSO Callback Preservation**:
  - Google OAuth redirect URI defaults to `/login` rather than `/dashboard`, ensuring that OAuth tokens and codes are processed by `checkForOAuthCallback()` without route guard interruption.
  - In `authGuard`, OAuth callbacks targeting protected routes are seamlessly forwarded to `/login` with full search and hash parameters, preventing unexpected navigation drops to the landing page (`/`).
  - Active SSO query parameters (`client_id`, `redirect_uri`, `state`, etc.) are serialized to `sessionStorage` (`vanguard_sso_pending`) prior to Google authentication and restored when dispatching 2-Step Verification to `/verify-otp`.
- **Interactive Vanguard Dashboard Approval Challenge**:
  - Replaced the unverified frontend direct approval bypass button with an interactive number-matching challenge.
  - When choosing browser approval, the SSO tab displays a 2-digit number challenge and starts real-time status polling against `/oauth/mfa/push/status`.
  - The authenticated **Vanguard Dashboard** (`/dashboard`) polls `/oauth/mfa/push/pending` and surfaces a live interactive approval banner/modal showing the requesting client application, IP address, and device.
  - The user selects the matching 2-digit number in their Vanguard Dashboard, sending `POST /oauth/mfa/push/respond` (`action: approved`, `selectedCode: number`). Once verified, the SSO tab automatically detects approval and redirects to the client application dashboard.
  - Includes an **↗ Open Vanguard Dashboard to Approve** button in the SSO verification tab to easily open the dashboard in a new tab if not already open.
- **Login-First Workflow & Default to Mobile MFA**:
  - Removed the pre-login SSO verification method selector from `/login`. Users authenticate their identity first via credentials or Google OAuth.
  - On `/verify-otp`, **Mobile MFA** (`push_approval`) is enforced as the primary default verification method for all SSO flows, with on-screen switches to **Vanguard Dashboard Approval** and **Email OTP**.

### Email Uniqueness & Recovery Hardening (SCRUM-174)
- **Elimination of Duplicate Recovery OTP Dispatch (429 Rate-Limit Prevention)**:
  - On `/verify-otp`, removed the duplicate `authService.forgotPassword()` call on initial component mount during `mode: recovery`. The initial 8-digit recovery code dispatched during `/forgot-password` form submission is preserved, eliminating the instant Supabase `429 Too Many Requests: For security purposes, you can only request this once every 60 seconds` rate-limit error.
- **Safe Directory Invitation State Management & Duplicate Prevention**:
  - In `DashboardService.submitInviteUser()`, eliminated premature optimistic mutations to `directoryUsers` and `localStorage`.
  - The local directory store and credentials card are updated exclusively upon a verified `200/201` HTTP response from the backend API.
  - If the backend returns a `409 ConflictException` (e.g. active employee or individual account duplicate), `inviteError` displays the authoritative failure message, and the directory table remains clean and unmodified.
- **Live Directory Synchronization**:
  - Automatically synchronizes live directory members and activation statuses with the backend `GET /directory-users` endpoint on component mount.

### 3rd-Party 2FA Authenticator, Pre-Launch Security Verification, Employee App Provisioning, Movement Audit & Billing System (SCRUM-166 → SCRUM-173)
- **3rd-Party 2FA Authenticator — Google Authenticator Parity (SCRUM-166)**:
  - Full RFC 6238 / RFC 4226 TOTP generator supporting **SHA-1, SHA-256, and SHA-512**, **6 or 8 digits**, and **15s / 30s / 60s periods**.
  - Add external accounts (Google, GitHub, Facebook, AWS, Figma, Discord, Microsoft, etc.) via **QR Code Image Upload / Camera Scan**, **`otpauth://totp/...` URI paste**, or **Manual Base32 Secret Key entry**, plus `otpauth://` URI backup export/import.
- **Individual Account SSO Auto-Provisioning & Direct Browser Approval (SCRUM-167 & SCRUM-168)**:
  - Added ** Option 1: Approve Directly in Browser** on `/verify-otp` during OIDC Single Sign-On flows alongside **Mobile Push MFA** and **6-Digit Email OTP**.
  - Preserves OIDC query parameters across `/login` ↔ `/register` ↔ `/verify-otp` so Individual accounts seamlessly complete SSO into `dummy-web`.
- **Pre-Launch Security Verification & Auto-Fill Credential Injection (SCRUM-169)**:
  - Launching any application from **My Applications** opens a **Pre-Launch Security Verification Modal** (Master/Account Password, 6-Digit PIN/TOTP, or Active Session Approval) before opening the target app.
  - Automatically injects the saved/assigned username and password via `#vg_autofill=1` hash parameters consumed by `extension-vanguard` (`tryVerifiedLaunchAutofill`) and displays a **Launch Auto-Fill Assistant Banner**.
  - Includes an **Already Logged In** session toggle per application card; when already logged in, clicking Launch opens the application immediately without re-prompting.
- **Admin Company Account Provisioning & Employee Visibility Isolation (SCRUM-171)**:
  - Company Admins can click **🔑 Provision App** on any employee row in **Directory Users** to assign an application (Figma, GitHub, Facebook, Slack, AWS, Dummy Web, or Custom) along with the Admin-created username and password.
  - Strict employee isolation ensures only that specific employee sees the provisioned app and credentials in their Vanguard dashboard.
- **Comprehensive Account Movement Audit Trail (SCRUM-172)**:
  - Company Admins can filter **Security Audit Logs** by **Employee** and **Movement Type** (`All Movements`, `Sign-In / SSO`, `Sign-Out / Revoke`, `App Launches`, `MFA & Verification`, `Vault & Security`).
  - Individual accounts have matching movement filter pills in **Personal Activity History**.
- **Billing System / Monthly Subscription & Paywall Restrictions (SCRUM-173)**:
  - Free tier accounts (Individual and Company) are restricted to **1 integrated application** (`1/1 Apps`). Attempting to integrate a 2nd application opens the **Subscription & Paywall Modal**.
  - Includes **Personal Pro ($5/mo)**, **Business Pro ($29/mo)**, and **Enterprise Zero-Trust ($79/mo)** plans with 1-click **Sandbox Payment Gateway Checkout** and runtime **Sandbox Gateway API URL & Secret Key** configuration.

### Functional Application Request Modal, Duplicate Prevention & Admin Governance (SCRUM-161)
- **Interactive Multi-Protocol Request Modal**:
  - Replaced unstyled stub with an accessible modal supporting delivery mode selection:
    - **Single Sign-On (SSO)**: Pre-configured presets for the Vanguard Dummy Ecosystem (e.g., Acme Dummy Web on port 4201 with OIDC PKCE flow, and Vanguard Dummy Mobile Gateway on port 8081).
    - **Browser Extension Autofill**: Direct integration with extension-vanguard for external web applications (GitHub, Figma, Facebook, AWS Console, Datadog) matching target domains and injecting client-side zero-knowledge credentials.
  - Live target domain extraction (Domain: github.com, Domain: localhost:4201) with username/handle capture, urgency selector, and duration terms.
- **Strict Duplicate Prevention**:
  - Reactive duplicate verification prevents duplicate requests if an application is already active on the user's launchpad or currently in Pending Approval review.
  - Renders real-time warning alerts and disables submission until the duplicate conflict is resolved.
- **Tenant Application Removal & Request Withdrawal**:
  - Employees can remove assigned applications from their company launchpad (✕ card removal button).
  - Employees can withdraw pending or rejected requests from their "Requested Applications" list (✕ Withdraw).
  - When an application is removed or withdrawn, the duplicate lock is cleared so the employee can re-request access anytime in the future.
- **Admin Governance Review Modal with Zero-Knowledge Protection**:
  - Administrators can inspect application requests via a dedicated "Review" dialog detailing applicant identity, target URL, target domain, account username, duration, and business justification.
  - Strictly enforces zero-knowledge vault protection: passwords are encrypted client-side in the employee's personal vault, never included in request payloads, and never visible to administrators.

### Zero-Trust Tenant SSO Access Governance & Approval Notice (SCRUM-160)
- **Zero-Trust Administrative Approval Interception**:
  - Intercepts external OIDC Single Sign-On attempts for corporate tenant accounts where the client application has not yet been assigned or approved by an administrator.
  - Displays a dedicated **Zero-Trust Access Governance** notification card on the login and MFA verification pages detailing the application name, access status (Pending Approval), and automatic request submission.
  - Prevents premature MFA prompts or invalid token issuance for non-approved corporate integrations.
- **Graceful Error Callback Propagation**:
  - The 'Return to Client' action safely returns to the client application callback URL (redirect_uri) with standard OIDC error parameters: error=access_denied&error_description=Access+approval+pending+administrator+review and state preservation.
  - Enables client applications (e.g., dummy-web) to render informative, non-crashing governance messages to users.
- **Strict Account Exemption**:
  - Individual users (accountType === 'individual') and tenant Super Administrators (role === 'admin') are unhindered and bypass the approval gate seamlessly.

### Approved Application Auto-Provisioning to User Launchpad (SCRUM-159)
- **Automatic Transfer from Request Queue to Applications Launchpad**:
  - When an administrator approves an employee's application access request, the application is automatically transitioned to the user's active applications catalog (`apps` / `activeAppsList` / `filteredApps`) with an approved status badge (`✓ Approved`).
  - The approved application is removed from the "Requested Applications & Access Status" queue (`myAccessRequests`), ensuring only pending review and non-approved requests are displayed in the request status section.
- **Live Reactive Synchronization & Backend Integration**:
  - Listens to Supabase real-time updates on `access_requests` (`UPDATE` event with `status: 'Approved'`) to dynamically add the approved application to the user's launchpad and invoke `loadCompanyApps()` from `/api/apps/my` without needing a page refresh.
  - Dedupes application catalog entries across direct assigned apps (`user_assigned_apps`), group-inherited apps, and approved access requests.

### Real-Time Application Access Request Synchronization (SCRUM-158)
- **Shared Persistence to Live Database**:
  - Employee application access requests submitted via the User Portal modal (`submitRequestApp()`) are persisted directly to the Supabase PostgreSQL `access_requests` store scoped by `tenant_id` and `user_id`.
  - Obsoleted isolated browser-local storage queues, ensuring requests are visible across different browser sessions and administrative accounts.
- **Instantaneous Real-Time Broadcast via Supabase Realtime Channels**:
  - The Admin Console establishes a WebSocket subscription to `realtime:access_requests` on the `access_requests` table (`postgres_changes` on `INSERT`, `UPDATE`, and `DELETE`).
  - When an employee requests access to an application, the request instantly appears in the Admin Console queue without requiring page reloads.
  - When an administrator approves or rejects a request, status updates propagate in real time across active sessions.
- **On-Demand Manual Refresh**:
  - Added an interactive "Refresh" button with a spinning sync indicator to the Access Requests queue toolbar (`AdminAccessRequests.refreshAccessRequests()`), enabling instant forced synchronization from the database.

### Resilient Session Hydration & Guard Interception (SCRUM-157)
- **Authentic Session Continuity**:
  - Propagates authoritative Supabase sessions across 2-step OTP verification flows to guarantee dashboard initialization with signed JWT access and refresh tokens.
  - Prevents premature 401 refresh failures and unwarranted redirects to `/login` during initial dashboard data hydration (`apps/my`, `directory-users`, `connected-apps`).

### Live Directory User Status Synchronization & Manual Refresh (SCRUM-156)
- **Real-Time Directory Status Synchronization**:
  - `DashboardService.loadDirectoryUsers()` invokes `AuthService.getDirectoryUsers(tenantId)` to query real-time directory statuses and active memberships from the backend directory cache and Supabase Auth.
  - Automatically loads on `AdminDirectory.ngOnInit()`, during `initDashboardForCurrentUser()`, and on tab changes to the `directory` tab, ensuring newly activated tenant accounts immediately transition from `Pending` to `Active`.
- **Manual Status Refresh Button**:
  - The Admin Directory toolbar includes an interactive "Refresh Status" button with a reactive spinning icon (`isDirectoryLoading` signal) allowing administrators to force-synchronize user activation records on demand.
- **Client Cache Synchronization on Credential Activation**:
  - Upon completing a password change via temporary credentials (`AuthService.changePassword()`), the user's directory entry in `vanguard_directory_users` is directly marked as `accountStatus: 'Active'` with `lastLogin: 'Just now'`, discarding temporary credential flags immediately.

### Mandatory Password Reset on Temporary Credentials & Tenant Portal Routing (SCRUM-155)
- **Immediate Password Reset Enforcement**:
  - When an invited directory employee signs in with their temporary credentials, `is_temporary_password: true` is detected by `AuthService.setSession()`, setting `isPasswordResetRequired` to `true` and saving `vanguard_reset_required: true`.
  - `authGuard` intercepts all navigation attempts to `/dashboard` while `isPasswordResetRequired` is active, instantly redirecting the user to `/reset-password`.
  - Both direct sign-in and 2-step OTP verification flows detect the temporary flag and route immediately to `/reset-password` before granting dashboard access.
- **Accurate Tenant Classification & User Portal Access**:
  - Invited directory employees are normalized as `accountType: 'company'` with `role: 'user'`, mapping them directly to the corporate **User Portal** (`viewMode: 'user'`, `activeTab: 'my-apps'`) bound to their corporate organization workspace.
  - Personal Vault workspace fallback is prevented (`isIndividual()` resolves to `false`), ensuring enterprise employees only access company-administered apps and services.
- **Clean SSO Integrations for Brand-New Accounts**:
  - Connected client applications are strictly scoped per user email in persistent storage (`vanguard_connected_apps_<email>`).
  - Purged legacy global mock apps (`userEmail: 'all'`). New employee accounts launch with an accurate, empty Active SSO Integrations list until real applications are connected via single sign-on.

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
     - One-click copy credentials confirmation card with live email dispatch status pills (`sending`, `sent`, `failed`) and 1-click **↻ Retry** button (SCRUM-154).
     - Multi-tenant isolation: invitation dispatch automatically binds `tenantId` to link invited employees directly to the active organization (SCRUM-154).
     - Resilient error handling: network timeouts and offline backend statuses are normalized into actionable administrator notices (SCRUM-154).
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

### Cloudflare Pages Deployment & Environment Configuration (SCRUM-162)

Vanguard Frontend is configured for seamless deployment to **Cloudflare Pages** while fully preserving local development workflows:

1. **Environment Separation**:
   - `src/environments/environment.ts`: Default environment used during local testing (`npm start` / `ng serve`) pointing to `http://localhost:3000`.
   - `src/environments/environment.prod.ts`: Production environment injected during `npm run build` (`ng build`) configured with your production backend URL (e.g. `https://backend-vanguard.onrender.com`).
2. **Cloudflare Pages Build Settings**:
   - **Framework preset**: `None` or `Angular`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist/frontend-vanguard/browser`
   - **Environment Variables**: Add `NODE_VERSION=24` (or `22.22.3`) in Cloudflare Settings -> Environment variables (or let Cloudflare detect the `.nvmrc` / `.node-version` file for Node 24).
3. **SPA Deep-Linking (`_redirects`)**:
   - The static rule in `public/_redirects` (`/* /index.html 200`) is automatically published to `dist/frontend-vanguard/browser/_redirects` so deep routes (e.g. `/dashboard`, `/login`) resolve without 404s.

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

---

## Multi-Tenant Isolation, Real-Time Directory & Live Mobile Pairing (SCRUM-183)

1. **Tenant-Scoped Directory, Access Requests & Provisioned Apps**:
   - Browser storage caches (`directoryUsers`, `appAccessRequests`, `employeeProvisionedApps`, `userDevices`) are partitioned by authenticated user/tenant scope and cleared cleanly on account switches.
   - Company Super Administrators see only directory accounts and access requests belonging to their own company tenant or created by them.
   - Apps assigned via **Directory → Provision App** synchronize canonically with the target user's membership and appear immediately in **My Applications**.
2. **Live Directory Status Updates**:
   - The **Directory** view subscribes to backend Server-Sent Events (`/auth/directory-users/stream`) and Supabase Realtime (`tenant_memberships`) so invited users flip from `Pending` to `Active` without manual browser refreshes.
3. **Real Mobile & Devices Pairing & Push Testing**:
   - **My Devices & Mobile Authenticator** generates live backend pairing keys (`POST /oauth/devices/pairing/create`) and polls pairing completion (`GET /oauth/devices/pairing/status`).
   - **Send Test Push** dispatches a real backend number-matching challenge (`POST /oauth/mfa/push/test`) to **Vanguard Mobile Authenticator** only when a mobile device is genuinely paired.
4. **Company Super Admin SSO Prohibition**:
   - Company Super Administrators are blocked at login, OTP verification, and SSO approval flows from signing into OAuth/OIDC client apps via SSO.
