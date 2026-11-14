import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import {
  AppAccessRequest,
  SaaSApp,
  UserConnectedApp,
} from '../../models/dashboard.models';

export interface SsoCatalogPreset {
  key: string;
  name: string;
  protocol: 'OIDC' | 'SAML 2.0' | 'OAuth 2.0';
  category: SaaSApp['category'];
  icon: string;
  url: string;
  domain: string;
  justification: string;
  badge?: string;
}

@Component({
  selector: 'app-user-sso-apps',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-sso-apps.html',
  styleUrl: './user-sso-apps.css',
})
export class UserSsoApps {
  readonly dashboardService = inject(DashboardService);

  readonly isPersonalWorkspace = this.dashboardService.isPersonalWorkspace;
  readonly activeConnectedApps = this.dashboardService.activeConnectedApps;
  readonly ssoApplicationsList = this.dashboardService.ssoApplicationsList;
  readonly myAccessRequests = this.dashboardService.myAccessRequests;

  readonly mySsoAccessRequests = computed<AppAccessRequest[]>(() =>
    this.myAccessRequests().filter((req) => this.dashboardService.isSsoApplication(req))
  );

  readonly pendingSsoRequestsCount = computed<number>(
    () => this.mySsoAccessRequests().filter((r) => r.status === 'Pending Approval').length
  );

  readonly ssoCatalogPresets: SsoCatalogPreset[] = [
    {
      key: 'dummy-web',
      name: 'Acme Dummy Web',
      protocol: 'OIDC',
      category: 'cloud',
      icon: '🏢',
      url: 'http://localhost:4201',
      domain: 'localhost:4201',
      justification: 'Internal employee dummy portal access via Vanguard OIDC Single Sign-On.',
      badge: 'OIDC • Port 4201',
    },
    {
      key: 'dummy-mobile',
      name: 'Vanguard Dummy Mobile Gateway',
      protocol: 'OAuth 2.0',
      category: 'cloud',
      icon: '📱',
      url: 'http://localhost:8081',
      domain: 'localhost:8081',
      justification: 'Vanguard mobile endpoint with zero-trust biometric authentication.',
      badge: 'OAuth 2.0 • Port 8081',
    },
    {
      key: 'custom-saml',
      name: 'Custom Enterprise SAML / OIDC App',
      protocol: 'SAML 2.0',
      category: 'developer',
      icon: '🔐',
      url: '',
      domain: '',
      justification: 'Request federated SAML 2.0 / OIDC SSO access for an enterprise portal.',
      badge: 'Federated SSO',
    },
  ];

  readonly showRequestSsoModal = signal<boolean>(false);
  readonly reqAppName = signal<string>('');
  readonly reqProtocol = signal<string>('OIDC');
  readonly reqCategory = signal<SaaSApp['category']>('cloud');
  readonly reqIcon = signal<string>('🏢');
  readonly reqUrl = signal<string>('');
  readonly reqDomain = signal<string>('');
  readonly reqUrgency = signal<'Low' | 'Standard' | 'Critical'>('Standard');
  readonly reqDuration = signal<string>('Permanent');
  readonly reqJustification = signal<string>('');
  readonly requestError = signal<string | null>(null);
  readonly requestSuccess = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  readonly duplicateCheck = computed(() => {
    const name = this.reqAppName().trim();
    if (!name) return { isDuplicate: false };
    return this.dashboardService.checkDuplicateAppRequest(name);
  });

  launchConnectedApp(conn: UserConnectedApp): void {
    this.dashboardService.launchConnectedApp(conn);
  }

  disconnectApp(clientId: string): void {
    this.dashboardService.disconnectApp(clientId);
  }

  launchSsoApp(app: SaaSApp): void {
    this.dashboardService.launchApp(app, { skipAutofill: true });
  }

  launchApprovedSsoRequest(req: AppAccessRequest): void {
    const app: SaaSApp = {
      id: req.id,
      name: req.appName,
      category: req.category || 'cloud',
      description: req.justification,
      icon: req.icon || '🔐',
      protocol: req.protocol || 'OIDC',
      launchUrl: req.launchUrl || 'http://localhost:4201',
      assigned: true,
      status: 'Approved',
      targetDomain: req.targetDomain,
    };
    this.launchSsoApp(app);
  }

  removeSsoApp(app: SaaSApp): void {
    this.dashboardService.removeCompanyApp(app.id);
  }

  withdrawRequest(req: AppAccessRequest): void {
    this.dashboardService.withdrawAccessRequest(req.id);
  }

  openRequestSsoModal(): void {
    this.applyPreset(this.ssoCatalogPresets[0]);
    this.requestError.set(null);
    this.requestSuccess.set(false);
    this.showRequestSsoModal.set(true);
  }

  closeRequestSsoModal(): void {
    this.showRequestSsoModal.set(false);
    this.requestError.set(null);
  }

  applyPreset(preset: SsoCatalogPreset): void {
    this.reqAppName.set(preset.key === 'custom-saml' ? '' : preset.name);
    this.reqProtocol.set(preset.protocol);
    this.reqCategory.set(preset.category);
    this.reqIcon.set(preset.icon);
    this.reqUrl.set(preset.url);
    this.reqDomain.set(preset.domain);
    this.reqJustification.set(preset.justification);
    this.requestError.set(null);
  }

  submitSsoRequest(): void {
    if (this.isSubmitting()) return;
    const name = this.reqAppName().trim();
    if (!name) {
      this.requestError.set('Please enter the SSO application name.');
      return;
    }

    const dup = this.duplicateCheck();
    if (dup.isDuplicate) {
      this.requestError.set(dup.message || 'This SSO application is already active or pending review.');
      return;
    }

    this.isSubmitting.set(true);
    const ok = this.dashboardService.submitAppRequest({
      appName: name,
      category: this.reqCategory(),
      protocol: this.reqProtocol() || 'OIDC',
      icon: this.reqIcon() || '🔐',
      launchUrl: this.reqUrl() || 'http://localhost:4201',
      targetDomain: this.reqDomain(),
      urgency: this.reqUrgency(),
      duration: this.reqDuration(),
      justification: this.reqJustification() || `Federated SSO access request for ${name}`,
    });
    this.isSubmitting.set(false);

    if (!ok) {
      this.requestError.set(this.dashboardService.requestAppError() || 'Unable to submit SSO access request.');
      return;
    }

    this.requestError.set(null);
    this.requestSuccess.set(true);
    setTimeout(() => {
      this.showRequestSsoModal.set(false);
      this.requestSuccess.set(false);
    }, 1500);
  }
}
