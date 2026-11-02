import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { AppAccessRequest } from '../../models/dashboard.models';

@Component({
  selector: 'app-admin-access-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-access-requests.html',
  styleUrl: './admin-access-requests.css'
})
export class AdminAccessRequests {
  readonly dashboardService = inject(DashboardService);

  readonly activeTab = this.dashboardService.activeTab;
  readonly appAccessRequests = this.dashboardService.appAccessRequests;
  readonly filteredAccessRequests = this.dashboardService.filteredAccessRequests;
  readonly pendingAccessRequests = this.dashboardService.pendingAccessRequests;
  readonly pendingAccessRequestsCount = this.dashboardService.pendingAccessRequestsCount;
  readonly accessRequestStatusFilter = this.dashboardService.accessRequestStatusFilter;
  readonly showRejectModal = this.dashboardService.showRejectModal;
  readonly selectedAccessRequestForReject = this.dashboardService.selectedAccessRequestForReject;

  readonly approvedAccessRequestsCount = computed(() => {
    return this.appAccessRequests().filter((r) => r.status === 'Approved').length;
  });

  get accessRequestSearch(): string {
    return this.dashboardService.accessRequestSearch();
  }
  set accessRequestSearch(v: string) {
    this.dashboardService.accessRequestSearch.set(v);
  }

  get rejectAdminNoteInput(): string {
    return this.dashboardService.rejectAdminNoteInput;
  }
  set rejectAdminNoteInput(v: string) {
    this.dashboardService.rejectAdminNoteInput = v;
  }

  setAccessRequestStatusFilter(f: 'all' | 'Pending Approval' | 'Approved' | 'Rejected'): void {
    this.dashboardService.setAccessRequestStatusFilter(f);
  }

  approveAccessRequest(id: string, notes?: string): void {
    this.dashboardService.approveAccessRequest(id, notes);
  }

  openRejectModal(req: AppAccessRequest): void {
    this.dashboardService.openRejectModal(req);
  }

  closeRejectModal(): void {
    this.dashboardService.closeRejectModal();
  }

  confirmRejectAccessRequest(): void {
    const sel = this.selectedAccessRequestForReject();
    if (sel) {
      this.dashboardService.rejectAccessRequest(sel.id, this.rejectAdminNoteInput);
    }
  }

  rejectAccessRequest(id: string, notes?: string): void {
    this.dashboardService.rejectAccessRequest(id, notes);
  }
}
