import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import {
  ProtocolStatus,
  SaaSApp,
  SignInEvent,
  SSHKey,
  DirectoryUser,
  TenantAuditEvent,
  SamlConnector,
  OidcClient,
  IdpCertMetadata,
  LdapHost,
  RadiusAccessPoint,
  VlanMapping,
  EnrolledDevice,
  MobilePolicyConfig,
  PersonalVaultItem,
  AppAccessRequest,
  UserConnectedApp,
} from '../../models/dashboard.models';

export interface RequestPreset {
  key: string;
  name: string;
  deliveryMode: 'sso' | 'extension';
  protocol: string;
  category: SaaSApp['category'];
  icon: string;
  url: string;
  domain: string;
  suggestedUsername?: string;
  justification: string;
  badge?: string;
}

@Component({
  selector: 'app-user-my-apps',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-my-apps.html',
  styleUrl: './user-my-apps.css'
})
export class UserMyApps {
  readonly dashboardService = inject(DashboardService);

  readonly activeTab = this.dashboardService.activeTab;
  readonly selectedCategory = this.dashboardService.selectedCategory;
  readonly apps = this.dashboardService.apps;
  readonly personalApps = this.dashboardService.personalApps;
  readonly isPersonalWorkspace = this.dashboardService.isPersonalWorkspace;
  readonly activeAppsList = this.dashboardService.activeAppsList;
  readonly filteredApps = this.dashboardService.filteredApps;
  readonly showRequestAppModal = this.dashboardService.showRequestAppModal;
  readonly requestAppSuccess = this.dashboardService.requestAppSuccess;
  readonly requestAppError = this.dashboardService.requestAppError;
  readonly myAccessRequests = this.dashboardService.myAccessRequests;
  readonly pendingRequestsCount = computed(() =>
    this.myAccessRequests().filter((r) => r.status === 'Pending Approval').length
  );

  // SCRUM-57: Connected Applications & Active SSO Integrations
  readonly connectedApps = this.dashboardService.connectedApps;
  readonly activeConnectedApps = this.dashboardService.activeConnectedApps;

  // Personal Application Modal State
  readonly showAddPersonalAppModal = signal<boolean>(false);
  readonly addAppError = signal<string | null>(null);
  newAppName = '';
  newAppUrl = '';
  newAppCategory: 'cloud' | 'developer' | 'collaboration' = 'collaboration';
  newAppDescription = '';
  newAppIcon = '🌐';
  newAppUsername = '';
  newAppPassword = '';

  // SCRUM-169: Pre-Launch Security Verification & Auto-Fill State
  readonly showLaunchVerifyModal = signal<boolean>(false);
  readonly pendingLaunchApp = signal<SaaSApp | null>(null);
  readonly launchVerifyMethod = signal<'password' | 'pin' | 'quick'>('quick');
  readonly launchVerifySecret = signal<string>('');
  readonly launchVerifyError = signal<string | null>(null);
  readonly launchCustomUsername = signal<string>('');
  readonly launchCustomPassword = signal<string>('');
  readonly launchSaveToVault = signal<boolean>(true);
  readonly launchMarkLoggedIn = signal<boolean>(true);
  readonly activeAutofillToast = this.dashboardService.activeAutofillToast;

  // SCRUM-173: Billing & Monthly Subscription State
  readonly showPaywallModal = this.dashboardService.showPaywallModal;
  readonly paywallFeatureMessage = this.dashboardService.paywallFeatureMessage;
  readonly subscriptionPlanId = this.dashboardService.subscriptionPlanId;
  readonly isFreeTier = this.dashboardService.isFreeTier;
  readonly maxIntegratedAppsLimit = this.dashboardService.maxIntegratedAppsLimit;
  readonly currentPlanDisplayName = this.dashboardService.currentPlanDisplayName;
  readonly billingInvoices = this.dashboardService.billingInvoices;
  readonly showGatewayConfigForm = signal<boolean>(false);
  gatewayProviderInput = this.dashboardService.sandboxGatewayProvider();
  gatewayUrlInput = this.dashboardService.sandboxGatewayUrl();
  gatewayApiKeyInput = this.dashboardService.sandboxGatewayApiKey();

  // Request Application Form Signals
  readonly reqDeliveryMode = signal<'sso' | 'extension'>('extension');
  readonly reqAppName = signal<string>('');
  readonly reqCategory = signal<SaaSApp['category']>('cloud');
  readonly reqProtocol = signal<string>('Extension Autofill');
  readonly reqIcon = signal<string>('🚀');
  readonly reqUrl = signal<string>('');
  readonly reqDomain = signal<string>('');
  readonly reqUsername = signal<string>('');
  readonly reqUrgency = signal<'Low' | 'Standard' | 'Critical'>('Standard');
  readonly reqDuration = signal<string>('Permanent');
  readonly reqJustification = signal<string>('');
  readonly isSubmittingRequest = signal<boolean>(false);

  // Real-time duplicate check based on current app name
  readonly duplicateCheck = computed(() => {
    const name = this.reqAppName().trim();
    if (!name) return { isDuplicate: false };
    return this.dashboardService.checkDuplicateAppRequest(name);
  });

  // Catalog Presets
  readonly ssoPresets: RequestPreset[] = [
    {
      key: 'dummy-web',
      name: 'Acme Dummy Web',
      deliveryMode: 'sso',
      protocol: 'OIDC',
      category: 'cloud',
      icon: '🏢',
      url: 'http://localhost:4201',
      domain: 'localhost:4201',
      justification: 'Internal employee dummy portal access with OIDC Single Sign-On.',
      badge: 'Local Port 4201',
    },
    {
      key: 'dummy-mobile',
      name: 'Vanguard Dummy Mobile Gateway',
      deliveryMode: 'sso',
      protocol: 'OAuth 2.0',
      category: 'cloud',
      icon: '📱',
      url: 'http://localhost:8081',
      domain: 'localhost:8081',
      justification: 'Vanguard mobile endpoint with zero-trust biometric authentication.',
      badge: 'Local Port 8081',
    },
  ];

  readonly extensionPresets: RequestPreset[] = [
    {
      key: 'github',
      name: 'GitHub',
      deliveryMode: 'extension',
      protocol: 'Extension Autofill',
      category: 'developer',
      icon: '🐙',
      url: 'https://github.com/login',
      domain: 'github.com',
      justification: 'Git source code repositories, code reviews, and CI/CD actions.',
    },
    {
      key: 'figma',
      name: 'Figma Enterprise',
      deliveryMode: 'extension',
      protocol: 'Extension Autofill',
      category: 'collaboration',
      icon: '🎨',
      url: 'https://www.figma.com/login',
      domain: 'figma.com',
      justification: 'UI/UX design exploration, wireframing, and component library access.',
    },
    {
      key: 'facebook',
      name: 'Facebook / Meta Business',
      deliveryMode: 'extension',
      protocol: 'Extension Autofill',
      category: 'collaboration',
      icon: '📘',
      url: 'https://www.facebook.com/login',
      domain: 'facebook.com',
      justification: 'Social marketing management and Meta Developer console operations.',
    },
    {
      key: 'aws',
      name: 'AWS Management Console',
      deliveryMode: 'extension',
      protocol: 'Extension Autofill',
      category: 'cloud',
      icon: '☁️',
      url: 'https://signin.aws.amazon.com/console',
      domain: 'signin.aws.amazon.com',
      justification: 'Cloud infrastructure deployment and monitoring.',
    },
    {
      key: 'datadog',
      name: 'Datadog APM',
      deliveryMode: 'extension',
      protocol: 'Extension Autofill',
      category: 'cloud',
      icon: '🐶',
      url: 'https://app.datadoghq.com',
      domain: 'app.datadoghq.com',
      justification: 'Application observability, distributed tracing, and live system metrics.',
    },
  ];

  // Preserved backwards-compatible getters and setters
  get requestedAppName() {
    return this.reqAppName() || this.dashboardService.requestedAppName;
  }
  set requestedAppName(v: string) {
    this.dashboardService.requestedAppName = v;
    this.reqAppName.set(v);
  }

  get requestAppJustification() {
    return this.reqJustification() || this.dashboardService.requestAppJustification;
  }
  set requestAppJustification(v: string) {
    this.dashboardService.requestAppJustification = v;
    this.reqJustification.set(v);
  }

  setCategory(category: 'all' | 'cloud' | 'developer' | 'collaboration') {
    this.dashboardService.setCategory(category);
  }

  launchApp(app: SaaSApp) {
    this.dashboardService.launchApp(app);
  }

  /**
   * SCRUM-169: Initiates secure app launch from "My Applications".
   * - If the app is already marked as logged in on this session, launches immediately.
   * - Otherwise, opens the Security Verification Modal before launching and auto-filling credentials.
   */
  initiateSecureAppLaunch(app: SaaSApp): void {
    if (!app.assigned || app.status === 'Pending Approval') {
      this.dashboardService.launchApp(app);
      return;
    }

    if (this.dashboardService.isAppSessionLoggedIn(app.id)) {
      this.dashboardService.launchApp(app, { skipAutofill: true });
      return;
    }

    const resolved = this.dashboardService.resolveAppCredentials(app);
    this.pendingLaunchApp.set(app);
    this.launchVerifyMethod.set('quick');
    this.launchVerifySecret.set('');
    this.launchVerifyError.set(null);
    this.launchCustomUsername.set(resolved?.username || '');
    this.launchCustomPassword.set(resolved?.password || '');
    this.launchSaveToVault.set(!resolved?.password);
    this.launchMarkLoggedIn.set(true);
    this.showLaunchVerifyModal.set(true);
  }

  confirmSecureAppLaunch(): void {
    const app = this.pendingLaunchApp();
    if (!app) return;

    const check = this.dashboardService.verifyLaunchIdentity(
      this.launchVerifyMethod(),
      this.launchVerifySecret(),
    );
    if (!check.verified) {
      this.launchVerifyError.set(check.error || 'Identity verification failed.');
      return;
    }

    const username = this.launchCustomUsername().trim();
    const password = this.launchCustomPassword();

    if (this.launchSaveToVault() && (username || password)) {
      this.dashboardService.updateAppCredentials(app.id, username, password);
    }

    this.showLaunchVerifyModal.set(false);
    this.pendingLaunchApp.set(null);
    this.launchVerifyError.set(null);

    this.dashboardService.launchApp(app, {
      customUsername: username,
      customPassword: password,
      markAlreadyLoggedIn: this.launchMarkLoggedIn(),
    });
  }

  closeLaunchVerifyModal(): void {
    this.showLaunchVerifyModal.set(false);
    this.pendingLaunchApp.set(null);
    this.launchVerifyError.set(null);
  }

  isAppLoggedIn(appId: string): boolean {
    return this.dashboardService.isAppSessionLoggedIn(appId);
  }

  toggleAppLoggedInState(app: SaaSApp, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const next = !this.dashboardService.isAppSessionLoggedIn(app.id);
    this.dashboardService.markAppSessionLoggedIn(app.id, next);
  }

  dismissAutofillToast(): void {
    this.dashboardService.activeAutofillToast.set(null);
  }

  copyAutofillValue(val?: string): void {
    if (val && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(val).catch(() => {});
    }
  }

  launchConnectedApp(app: UserConnectedApp) {
    this.dashboardService.launchConnectedApp(app);
  }

  disconnectApp(clientId: string) {
    this.dashboardService.disconnectApp(clientId);
  }

  openRequestAppModal(): void {
    this.reqDeliveryMode.set('extension');
    this.reqAppName.set('');
    this.reqCategory.set('cloud');
    this.reqProtocol.set('Extension Autofill');
    this.reqIcon.set('🚀');
    this.reqUrl.set('');
    this.reqDomain.set('');
    this.reqUsername.set('');
    this.reqUrgency.set('Standard');
    this.reqDuration.set('Permanent');
    this.reqJustification.set('');
    this.isSubmittingRequest.set(false);
    this.dashboardService.openRequestAppModal();
  }

  closeRequestAppModal(): void {
    this.dashboardService.closeRequestAppModal();
  }

  setDeliveryMode(mode: 'sso' | 'extension'): void {
    this.reqDeliveryMode.set(mode);
    if (mode === 'sso') {
      this.reqProtocol.set('OIDC');
      this.applyPresetRequest(this.ssoPresets[0]);
    } else {
      this.reqProtocol.set('Extension Autofill');
      this.applyPresetRequest(this.extensionPresets[0]);
    }
  }

  applyPresetRequest(preset: RequestPreset): void {
    this.reqAppName.set(preset.name);
    this.requestedAppName = preset.name;
    this.reqDeliveryMode.set(preset.deliveryMode);
    this.reqProtocol.set(preset.protocol);
    this.reqCategory.set(preset.category);
    this.reqIcon.set(preset.icon);
    this.reqUrl.set(preset.url);
    this.reqDomain.set(preset.domain);
    this.reqJustification.set(preset.justification);
    this.requestAppJustification = preset.justification;
    if (preset.suggestedUsername) {
      this.reqUsername.set(preset.suggestedUsername);
    }
  }

  onUrlChange(newUrl: string): void {
    this.reqUrl.set(newUrl);
    if (!newUrl) {
      this.reqDomain.set('');
      return;
    }
    try {
      const formatted = newUrl.startsWith('http://') || newUrl.startsWith('https://')
        ? newUrl
        : 'https://' + newUrl;
      const parsed = new URL(formatted);
      this.reqDomain.set(parsed.hostname || parsed.host);
    } catch {
      const cleaned = newUrl.replace(/^https?:\/\//, '').split('/')[0];
      this.reqDomain.set(cleaned);
    }
  }

  isPresetActive(appName: string): 'assigned' | 'pending' | null {
    const norm = appName.trim().toLowerCase();
    if (this.activeAppsList().some((a) => a.name.trim().toLowerCase() === norm)) {
      return 'assigned';
    }
    if (
      this.myAccessRequests().some(
        (r) => r.status === 'Pending Approval' && r.appName.trim().toLowerCase() === norm
      )
    ) {
      return 'pending';
    }
    return null;
  }

  submitAppRequest(): void {
    const appName = this.reqAppName().trim() || this.requestedAppName.trim();
    if (!appName) {
      this.dashboardService.requestAppError.set('Please specify an application name.');
      return;
    }

    const check = this.dashboardService.checkDuplicateAppRequest(appName);
    if (check.isDuplicate) {
      this.dashboardService.requestAppError.set(check.message || 'Duplicate application request.');
      return;
    }

    // SCRUM-173: Enforce 1-application Free tier paywall restriction
    const entitlement = this.dashboardService.canIntegrateAnotherApp(this.activeAppsList().length);
    if (!entitlement.allowed) {
      this.dashboardService.requestAppError.set(entitlement.reason || 'Free tier limit reached.');
      this.dashboardService.openPaywallModal(entitlement.reason);
      return;
    }

    this.isSubmittingRequest.set(true);

    const ok = this.dashboardService.submitAppRequest({
      appName,
      category: this.reqCategory(),
      protocol: this.reqProtocol(),
      icon: this.reqIcon(),
      launchUrl: this.reqUrl(),
      targetDomain: this.reqDomain(),
      requestedUsername: this.reqUsername(),
      urgency: this.reqUrgency(),
      duration: this.reqDuration(),
      justification: this.reqJustification() || this.requestAppJustification,
    });

    if (!ok) {
      this.isSubmittingRequest.set(false);
    }
  }

  removeCompanyApp(app: SaaSApp, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.dashboardService.removeCompanyApp(app.id);
  }

  withdrawAccessRequest(req: AppAccessRequest, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.dashboardService.withdrawAccessRequest(req.id);
  }

  /** Whether the signed-in user may self-approve this pending request (Dummy Web only, SCRUM-167). */
  canSelfApprove(req: AppAccessRequest): boolean {
    return (
      req.status === 'Pending Approval' &&
      this.dashboardService.isSelfApprovableDummyApp(req.appName)
    );
  }

  /** Self-approve a pending Dummy Web access request using the user's own account (SCRUM-167). */
  selfApproveAccessRequest(req: AppAccessRequest, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.dashboardService.selfApproveAccessRequest(req.id);
  }

  launchApprovedRequest(req: AppAccessRequest): void {
    const existing = this.apps().find((a) => a.name.toLowerCase() === req.appName.toLowerCase());
    if (existing) {
      this.launchApp(existing);
    } else {
      const app: SaaSApp = {
        id: req.id,
        name: req.appName,
        category: req.category,
        description: req.justification,
        icon: req.icon || '🚀',
        protocol: req.protocol,
        launchUrl: req.launchUrl || 'https://vanguard.security',
        assigned: true,
        status: 'Approved',
        targetDomain: req.targetDomain,
        requestedUsername: req.requestedUsername,
      };
      this.launchApp(app);
    }
  }

  // Personal App Launcher Actions
  openAddAppModal(): void {
    this.openAddPersonalAppModal();
  }

  openAddPersonalAppModal(): void {
    this.newAppName = '';
    this.newAppUrl = '';
    this.newAppCategory = 'collaboration';
    this.newAppDescription = '';
    this.newAppIcon = '🌐';
    this.newAppUsername = '';
    this.newAppPassword = '';
    this.addAppError.set(null);
    this.showAddPersonalAppModal.set(true);
  }

  closeAddPersonalAppModal(): void {
    this.showAddPersonalAppModal.set(false);
    this.addAppError.set(null);
  }

  applyPreset(preset: 'figma' | 'facebook' | 'github' | 'notion' | 'google' | 'roblox' | 'custom'): void {
    this.addAppError.set(null);
    this.newAppUsername = '';
    this.newAppPassword = '';
    switch (preset) {
      case 'figma':
        this.newAppName = 'Figma';
        this.newAppUrl = 'https://www.figma.com/login';
        this.newAppCategory = 'collaboration';
        this.newAppIcon = '🎨';
        this.newAppDescription = 'Collaborative interface design & prototyping suite';
        break;
      case 'facebook':
        this.newAppName = 'Facebook';
        this.newAppUrl = 'https://www.facebook.com/login';
        this.newAppCategory = 'collaboration';
        this.newAppIcon = '📘';
        this.newAppDescription = 'Social network & Meta business suite';
        break;
      case 'github':
        this.newAppName = 'GitHub';
        this.newAppUrl = 'https://github.com/login';
        this.newAppCategory = 'developer';
        this.newAppIcon = '🐙';
        this.newAppDescription = 'Git repository hosting & developer platform';
        break;
      case 'notion':
        this.newAppName = 'Notion';
        this.newAppUrl = 'https://www.notion.so/login';
        this.newAppCategory = 'collaboration';
        this.newAppIcon = '📝';
        this.newAppDescription = 'Connected workspace for wiki, docs & project notes';
        break;
      case 'google':
        this.newAppName = 'Google';
        this.newAppUrl = 'https://accounts.google.com';
        this.newAppCategory = 'cloud';
        this.newAppIcon = '🔍';
        this.newAppDescription = 'Google workspace, Drive, and identity authentication';
        break;
      case 'roblox':
        this.newAppName = 'Roblox';
        this.newAppUrl = 'https://www.roblox.com/login';
        this.newAppCategory = 'collaboration';
        this.newAppIcon = '🎮';
        this.newAppDescription = 'Roblox gaming platform & developer creator studio';
        break;
      case 'custom':
        this.newAppName = '';
        this.newAppUrl = 'https://';
        this.newAppCategory = 'cloud';
        this.newAppIcon = '🌐';
        this.newAppDescription = '';
        break;
    }
  }

  submitAddPersonalApp(): void {
    if (!this.newAppName.trim()) {
      this.addAppError.set('Please provide an application name.');
      return;
    }
    if (!this.newAppUrl.trim() || !this.newAppUrl.includes('.')) {
      this.addAppError.set('Please provide a valid website or login URL.');
      return;
    }

    // SCRUM-173: Enforce 1-application Free tier paywall restriction
    const entitlement = this.dashboardService.canIntegrateAnotherApp(this.activeAppsList().length);
    if (!entitlement.allowed) {
      this.addAppError.set(entitlement.reason || 'Free tier is limited to 1 integrated application.');
      this.dashboardService.openPaywallModal(entitlement.reason);
      return;
    }

    const formattedUrl = this.dashboardService.normalizeLoginUrl(this.newAppUrl.trim());

    this.dashboardService.addApplication({
      name: this.newAppName.trim(),
      launchUrl: formattedUrl,
      category: this.newAppCategory,
      description: this.newAppDescription.trim() || `${this.newAppName.trim()} web application`,
      icon: this.newAppIcon || '🌐',
      username: this.newAppUsername.trim(),
      password: this.newAppPassword,
    });

    this.closeAddPersonalAppModal();
  }

  deletePersonalApp(id: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.dashboardService.deletePersonalApp(id);
  }

  getMatchingVaultCredentials(app: SaaSApp): PersonalVaultItem[] {
    return this.dashboardService.findCredentialsForDomain(app.launchUrl || app.name);
  }

  // SCRUM-173: Billing & Monthly Subscription Modal Actions
  openBillingModal(): void {
    this.gatewayProviderInput = this.dashboardService.sandboxGatewayProvider();
    this.gatewayUrlInput = this.dashboardService.sandboxGatewayUrl();
    this.gatewayApiKeyInput = this.dashboardService.sandboxGatewayApiKey();
    this.dashboardService.openPaywallModal(
      'Manage your monthly subscription plan, paywall limits, and Sandbox Payment Gateway API configuration.'
    );
  }

  closeBillingModal(): void {
    this.dashboardService.closePaywallModal();
  }

  upgradePlan(planId: 'personal_pro' | 'business_pro' | 'enterprise'): void {
    this.dashboardService.upgradeSubscriptionPlan(planId);
  }

  cancelPlan(): void {
    this.dashboardService.cancelSubscriptionPlan();
  }

  saveGatewaySettings(): void {
    this.dashboardService.saveSandboxGatewayConfig(
      this.gatewayProviderInput,
      this.gatewayUrlInput,
      this.gatewayApiKeyInput,
    );
    this.showGatewayConfigForm.set(false);
  }
}