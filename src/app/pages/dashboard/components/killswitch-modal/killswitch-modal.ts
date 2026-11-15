import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-killswitch-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './killswitch-modal.html',
  styleUrl: './killswitch-modal.css',
})
export class KillswitchModal {
  readonly dashboardService = inject(DashboardService);

  readonly showGlobalKillswitchModal = this.dashboardService.showGlobalKillswitchModal;
  readonly globalKillswitchPending = this.dashboardService.globalKillswitchPending;
  readonly globalKillswitchSuccess = this.dashboardService.globalKillswitchSuccess;
  readonly globalKillswitchError = this.dashboardService.globalKillswitchError;
  readonly globalKillswitchResult = this.dashboardService.globalKillswitchResult;
  readonly directoryUsers = this.dashboardService.directoryUsers;
  readonly user = this.dashboardService.user;

  readonly signOutCurrentAdmin = signal<boolean>(false);

  readonly nonAdminMemberCount = computed<number>(() => {
    const adminEmail = this.user()?.email?.toLowerCase().trim();
    const members = this.directoryUsers();
    if (!members || members.length === 0) return 0;
    return members.filter((m) => !adminEmail || m.email?.toLowerCase().trim() !== adminEmail).length;
  });

  readonly residualMinutes = computed<number>(() => {
    const res = this.globalKillswitchResult();
    if (!res?.maxResidualAccessSeconds) return 0;
    return Math.ceil(res.maxResidualAccessSeconds / 60);
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showGlobalKillswitchModal() && !this.globalKillswitchPending()) {
      this.close();
    }
  }

  onBackdropClick(): void {
    if (!this.globalKillswitchPending()) {
      this.close();
    }
  }

  close(): void {
    this.signOutCurrentAdmin.set(false);
    this.dashboardService.closeGlobalKillswitchModal();
  }

  execute(): void {
    this.dashboardService.executeGlobalKillswitch(this.signOutCurrentAdmin());
  }
}
