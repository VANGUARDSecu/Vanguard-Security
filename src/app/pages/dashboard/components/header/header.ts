import { Component, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { TenantOrganization } from '../../models/dashboard.models';

@Component({
  selector: 'app-dashboard-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class DashboardHeader {
  readonly dashboardService = inject(DashboardService);

  readonly user = this.dashboardService.user;
  readonly userRole = this.dashboardService.userRole;
  readonly isAdmin = this.dashboardService.isAdmin;
  readonly viewMode = this.dashboardService.viewMode;
  readonly displayName = this.dashboardService.displayName;
  readonly userInitials = this.dashboardService.userInitials;
  readonly userRoleLabel = this.dashboardService.userRoleLabel;
  readonly isIndividual = this.dashboardService.isIndividual;

  // SCRUM-50: Upgrade Personal Vault to Organization
  readonly showUpgradeModal = signal<boolean>(false);
  upgradeCompanyName = '';

  openUpgradeModal(): void {
    this.upgradeCompanyName = '';
    this.showUpgradeModal.set(true);
  }

  closeUpgradeModal(): void {
    this.showUpgradeModal.set(false);
  }

  confirmUpgrade(): void {
    this.dashboardService.upgradeToOrganization(this.upgradeCompanyName);
    this.closeUpgradeModal();
  }

  // SCRUM-28 & SCRUM-52: Multi-tenant organization & workspace switcher
  readonly organizations = this.dashboardService.organizations;
  readonly activeOrganization = this.dashboardService.activeOrganization;
  readonly activeWorkspaceId = this.dashboardService.activeWorkspaceId;
  readonly activeOrganizationId = this.dashboardService.activeOrganizationId;
  readonly isPersonalWorkspace = this.dashboardService.isPersonalWorkspace;
  readonly allWorkspaces = this.dashboardService.allWorkspaces;
  readonly personalWorkspace = this.dashboardService.personalWorkspace;
  readonly tenantBranding = this.dashboardService.tenantBranding;
  readonly showOrgDropdown = signal<boolean>(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.org-switcher-container')) {
      this.showOrgDropdown.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.showOrgDropdown.set(false);
  }

  toggleOrgDropdown(): void {
    this.showOrgDropdown.update((v) => !v);
  }

  switchOrg(orgId: string): void {
    this.dashboardService.switchWorkspace(orgId);
    this.showOrgDropdown.set(false);
  }

  openCreateOrgModal(): void {
    this.showOrgDropdown.set(false);
    this.dashboardService.openCreateOrgModal();
  }

  goToBrandingStudio(): void {
    this.showOrgDropdown.set(false);
    this.dashboardService.setActiveTab('settings');
  }

  get searchQuery() { return this.dashboardService.searchQuery; }
  set searchQuery(v: string) { this.dashboardService.searchQuery = v; }

  toggleViewMode(mode?: 'admin' | 'user') {
    const target = mode ?? (this.viewMode() === 'admin' ? 'user' : 'admin');
    this.dashboardService.toggleViewMode(target);
  }

  onLogout() { this.dashboardService.onLogout(); }

}

