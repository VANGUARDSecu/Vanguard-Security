import { Component, inject, signal, HostListener, OnInit } from '@angular/core';
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
  AuditEventType,
  AuditSeverity,
  AuditThreatIndicator,
} from '../../models/dashboard.models';

@Component({
  selector: 'app-admin-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-audit-logs.html',
  styleUrl: './admin-audit-logs.css'
})
export class AdminAuditLogs implements OnInit {
  readonly dashboardService = inject(DashboardService);
  readonly Math = Math;

  readonly activeTab = this.dashboardService.activeTab;
  readonly auditStatusFilter = this.dashboardService.auditStatusFilter;
  readonly auditProtocolFilter = this.dashboardService.auditProtocolFilter;
  readonly auditEventTypeFilter = this.dashboardService.auditEventTypeFilter;
  readonly auditSeverityFilter = this.dashboardService.auditSeverityFilter;
  readonly auditDateRangeFilter = this.dashboardService.auditDateRangeFilter;
  readonly auditThreatsOnlyFilter = this.dashboardService.auditThreatsOnlyFilter;
  readonly auditSearchQuery = this.dashboardService.auditSearchQuery;
  readonly auditActorFilter = this.dashboardService.auditActorFilter;
  readonly directoryUsers = this.dashboardService.directoryUsers;

  ngOnInit(): void {
    this.dashboardService.loadServerAuditLogs();
  }

  refreshAuditLogs(): void {
    this.dashboardService.loadServerAuditLogs(this.auditActorFilter());
  }

  setAuditActor(actorEmail: string): void {
    this.dashboardService.setAuditActor(actorEmail);
    this.dashboardService.loadServerAuditLogs(actorEmail);
  }

  readonly filteredAuditEvents = this.dashboardService.filteredAuditEvents;
  readonly paginatedAuditEvents = this.dashboardService.paginatedAuditEvents;
  readonly auditCurrentPage = this.dashboardService.auditCurrentPage;
  readonly auditPageSize = this.dashboardService.auditPageSize;
  readonly auditTotalPages = this.dashboardService.auditTotalPages;

  readonly selectedAuditEvent = this.dashboardService.selectedAuditEvent;
  readonly showAuditInspector = this.dashboardService.showAuditInspector;

  readonly copiedPayload = signal<boolean>(false);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showAuditInspector()) {
      this.closeInspector();
    }
  }

  setAuditStatus(status: string): void {
    this.dashboardService.setAuditStatus(status);
  }

  setAuditProtocol(protocol: string): void {
    this.dashboardService.setAuditProtocol(protocol);
  }

  setAuditEventType(type: string): void {
    this.dashboardService.setAuditEventType(type);
  }

  setAuditSeverity(severity: string): void {
    this.dashboardService.setAuditSeverity(severity);
  }

  setAuditDateRange(range: string): void {
    this.dashboardService.setAuditDateRange(range);
  }

  toggleAuditThreatsOnly(): void {
    this.dashboardService.toggleAuditThreatsOnly();
  }

  resetAuditFilters(): void {
    this.dashboardService.resetAuditFilters();
  }

  setAuditPage(page: number): void {
    this.dashboardService.setAuditPage(page);
  }

  setAuditPageSize(size: number): void {
    this.dashboardService.setAuditPageSize(size);
  }

  inspectEvent(evt: TenantAuditEvent): void {
    this.dashboardService.openAuditInspector(evt);
  }

  closeInspector(): void {
    this.dashboardService.closeAuditInspector();
  }

  exportAuditLogs(): void {
    this.dashboardService.exportAuditLogs();
  }

  copyEventJson(evt: TenantAuditEvent): void {
    const jsonStr = this.formatJson(evt);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        this.copiedPayload.set(true);
        setTimeout(() => this.copiedPayload.set(false), 2000);
      });
    }
  }

  formatJson(evt: TenantAuditEvent): string {
    const payload = evt.rawPayload
      ? { eventId: evt.id, requestId: evt.requestId, ...evt.rawPayload }
      : evt;
    return JSON.stringify(payload, null, 2);
  }

  getPaginationRange(): number[] {
    const total = this.auditTotalPages();
    const current = this.auditCurrentPage();
    const pages: number[] = [];
    const maxVisible = 5;

    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(total, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }
}

