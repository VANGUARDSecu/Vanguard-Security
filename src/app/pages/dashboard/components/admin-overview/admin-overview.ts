import { Component, inject } from '@angular/core';
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
} from '../../models/dashboard.models';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-overview.html',
  styleUrl: './admin-overview.css'
})
export class AdminOverview {
  readonly dashboardService = inject(DashboardService);

  readonly user = this.dashboardService.user;
  readonly protocols = this.dashboardService.protocols;
  readonly activeTab = this.dashboardService.activeTab;
  readonly directoryUsers = this.dashboardService.directoryUsers;
  readonly displayName = this.dashboardService.displayName;
  readonly userInitials = this.dashboardService.userInitials;
  readonly organizationName = this.dashboardService.organizationName;
  readonly userRoleLabel = this.dashboardService.userRoleLabel;
  readonly userPhone = this.dashboardService.userPhone;
  readonly clientInfo = this.dashboardService.clientInfo;
  readonly copiedUserId = this.dashboardService.copiedUserId;
  readonly tenantAuditEvents = this.dashboardService.tenantAuditEvents;
  readonly showGlobalKillswitchModal = this.dashboardService.showGlobalKillswitchModal;
  readonly globalKillswitchSuccess = this.dashboardService.globalKillswitchSuccess;
  readonly isCompanyAdmin = this.dashboardService.isCompanyAdmin;
  readonly currentPlanDisplayName = this.dashboardService.currentPlanDisplayName;
  readonly isFreeTier = this.dashboardService.isFreeTier;
  readonly auditRetentionDays = this.dashboardService.auditRetentionDays;
  readonly canExportAuditCsv = this.dashboardService.canExportAuditCsv;

  openCompanyBillingModal(): void {
    this.dashboardService.openPaywallModal(
      'Manage your organization subscription plan via PayMongo Sandbox to unlock unlimited apps, 2FA accounts, and CSV audit exports for your entire company.',
    );
  }

  copyUserId() { this.dashboardService.copyUserId(); }
  revokeAllSessions() { this.dashboardService.revokeAllSessions(); }
  setActiveTab(tab: string) { this.dashboardService.setActiveTab(tab); }
  openGlobalKillswitchModal() { this.dashboardService.openGlobalKillswitchModal(); }
  closeGlobalKillswitchModal() { this.dashboardService.closeGlobalKillswitchModal(); }
  executeGlobalKillswitch() { this.dashboardService.executeGlobalKillswitch(); }

}
