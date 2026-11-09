import { Component, inject, signal, computed, OnInit } from '@angular/core';
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
  selector: 'app-user-activity',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-activity.html',
  styleUrl: './user-activity.css'
})
export class UserActivity implements OnInit {
  readonly dashboardService = inject(DashboardService);

  readonly activeTab = this.dashboardService.activeTab;
  readonly signInHistory = this.dashboardService.signInHistory;
  readonly movementFilter = signal<'all' | 'LOGIN' | 'LOGOUT' | 'APP_LAUNCH' | 'SECURITY'>('all');
  readonly searchQuery = signal<string>('');

  ngOnInit(): void {
    this.dashboardService.loadServerAuditLogs();
  }

  refreshMyActivity(): void {
    this.dashboardService.loadServerAuditLogs();
  }

  readonly myMovementAuditTrail = computed<SignInEvent[]>(() => {
    const myEmail = this.dashboardService.user()?.email?.toLowerCase().trim();
    const fromSignIn = this.signInHistory();

    const fromAudit: SignInEvent[] = [
      ...this.dashboardService.serverAuditEvents(),
      ...this.dashboardService.tenantAuditEvents(),
    ]
      .filter((e) => !myEmail || e.actor.toLowerCase().trim() === myEmail)
      .map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        application: e.target || 'Vanguard Identity Portal',
        protocol: e.protocol || 'Web Portal',
        device: e.device || 'Web Browser',
        ip: e.clientIp || '127.0.0.1',
        location: e.location || 'Local Workstation',
        status:
          e.eventType === 'USER_LOGOUT'
            ? ('logout' as const)
            : e.status === 'blocked'
              ? ('blocked' as const)
              : e.status === 'challenge'
                ? ('mfa_required' as const)
                : ('success' as const),
        movementType: e.eventType || 'LOGIN',
        action: e.action || e.eventType,
        actorEmail: e.actor,
      }));

    const seen = new Set<string>();
    const combined: SignInEvent[] = [];
    for (const item of [...fromAudit, ...fromSignIn]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        combined.push(item);
      }
    }

    const filter = this.movementFilter();
    const q = this.searchQuery().toLowerCase().trim();

    return combined.filter((evt) => {
      const mt = (evt.movementType || 'LOGIN').toUpperCase();
      let matchFilter = true;
      if (filter === 'LOGIN') {
        matchFilter = mt.includes('LOGIN') || mt === 'SSO_LOGIN';
      } else if (filter === 'LOGOUT') {
        matchFilter = mt.includes('LOGOUT') || evt.status === 'logout';
      } else if (filter === 'APP_LAUNCH') {
        matchFilter = mt.includes('LAUNCH');
      } else if (filter === 'SECURITY') {
        matchFilter =
          mt.includes('VAULT') ||
          mt.includes('MFA') ||
          mt.includes('PASSWORD') ||
          mt.includes('REVOK');
      }

      const matchQuery =
        !q ||
        evt.application.toLowerCase().includes(q) ||
        (evt.action && evt.action.toLowerCase().includes(q)) ||
        evt.protocol.toLowerCase().includes(q) ||
        evt.ip.toLowerCase().includes(q);

      return matchFilter && matchQuery;
    });
  });

}
