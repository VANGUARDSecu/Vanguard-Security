import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-overview.html',
  styleUrl: './admin-overview.css'
})
export class AdminOverview implements OnInit {
  readonly dashboardService = inject(DashboardService);

  readonly user = this.dashboardService.user;
  readonly protocols = this.dashboardService.protocols;
  readonly activeTab = this.dashboardService.activeTab;
  readonly directoryUsers = this.dashboardService.directoryUsers;
  readonly activeDirectoryUsersCount = this.dashboardService.activeDirectoryUsersCount;
  readonly oidcClientsCount = this.dashboardService.oidcClientsCount;
  readonly mergedAuditEventsCount = this.dashboardService.mergedAuditEventsCount;
  readonly securityPostureScore = this.dashboardService.securityPostureScore;
  readonly securityPostureTags = this.dashboardService.securityPostureTags;
  readonly enforceMfaAll = this.dashboardService.enforceMfaAll;
  readonly hasTotpEnrolled = this.dashboardService.hasTotpEnrolled;
  readonly isRevokingSessions = this.dashboardService.isRevokingSessions;
  readonly sessionRevoked = this.dashboardService.sessionRevoked;
  readonly displayName = this.dashboardService.displayName;
  readonly userInitials = this.dashboardService.userInitials;
  readonly organizationName = this.dashboardService.organizationName;
  readonly userRoleLabel = this.dashboardService.userRoleLabel;
  readonly userPhone = this.dashboardService.userPhone;
  readonly clientInfo = this.dashboardService.clientInfo;
  readonly copiedUserId = this.dashboardService.copiedUserId;
  readonly isCompanyAdmin = this.dashboardService.isCompanyAdmin;
  readonly currentPlanDisplayName = this.dashboardService.currentPlanDisplayName;
  readonly isFreeTier = this.dashboardService.isFreeTier;
  readonly auditRetentionDays = this.dashboardService.auditRetentionDays;
  readonly canExportAuditCsv = this.dashboardService.canExportAuditCsv;

  ngOnInit(): void {
    this.dashboardService.loadDirectoryUsers();
    this.dashboardService.loadServerAuditLogs();
    this.dashboardService.loadOidcClientsSummary();
    this.dashboardService.loadTenantSettingsFromBackend();
  }

  openCompanyBillingModal(): void {
    this.dashboardService.openPaywallModal(
      'Manage your organization subscription plan via PayMongo Sandbox to unlock unlimited apps, 2FA accounts, and CSV audit exports for your entire company.',
    );
  }

  copyUserId() { this.dashboardService.copyUserId(); }
  revokeAllSessions() { this.dashboardService.revokeAllSessions(); }
  setActiveTab(tab: string) { this.dashboardService.setActiveTab(tab); }
  quickInviteEmployee() { this.dashboardService.requestDirectoryQuickAction('invite'); }
  openDirectoryProvisioning() { this.dashboardService.setActiveTab('directory'); }
}
