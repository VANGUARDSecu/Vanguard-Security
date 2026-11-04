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
  openAddPersonalAppModal(): void {
    this.newAppName = '';
    this.newAppUrl = '';
    this.newAppCategory = 'collaboration';
    this.newAppDescription = '';
    this.newAppIcon = '🌐';
    this.addAppError.set(null);
    this.showAddPersonalAppModal.set(true);
  }

  closeAddPersonalAppModal(): void {
    this.showAddPersonalAppModal.set(false);
    this.addAppError.set(null);
  }

  applyPreset(preset: 'figma' | 'facebook' | 'github' | 'notion' | 'google' | 'custom'): void {
    this.addAppError.set(null);
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
        this.newAppName = 'Google Account';
        this.newAppUrl = 'https://accounts.google.com';
        this.newAppCategory = 'cloud';
        this.newAppIcon = '🔍';
        this.newAppDescription = 'Google workspace, Drive, and identity authentication';
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

    let formattedUrl = this.newAppUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    this.dashboardService.addPersonalApp({
      name: this.newAppName.trim(),
      launchUrl: formattedUrl,
      category: this.newAppCategory,
      description: this.newAppDescription.trim() || `${this.newAppName.trim()} web application`,
      icon: this.newAppIcon || '🌐',
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
}