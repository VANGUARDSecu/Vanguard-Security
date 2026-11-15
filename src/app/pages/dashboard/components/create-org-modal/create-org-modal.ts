import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-create-org-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-org-modal.html',
  styleUrl: './create-org-modal.css',
})
export class CreateOrgModal {
  readonly dashboardService = inject(DashboardService);

  readonly showCreateOrgModal = this.dashboardService.showCreateOrgModal;
  readonly newOrgName = this.dashboardService.newOrgName;
  readonly newOrgTier = this.dashboardService.newOrgTier;
  readonly newOrgDomain = this.dashboardService.newOrgDomain;
  readonly newOrgError = this.dashboardService.newOrgError;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showCreateOrgModal()) {
      this.close();
    }
  }

  close(): void {
    this.dashboardService.closeCreateOrgModal();
  }

  submit(): void {
    this.dashboardService.createOrganization();
  }
}
