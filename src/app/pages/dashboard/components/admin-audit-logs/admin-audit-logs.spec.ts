import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminAuditLogs } from './admin-audit-logs';
import { DashboardService } from '../../services/dashboard.service';
import { vi } from 'vitest';

describe('AdminAuditLogs Component (SCRUM-26)', () => {
  let component: AdminAuditLogs;
  let fixture: ComponentFixture<AdminAuditLogs>;
  let dashboardService: DashboardService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [AdminAuditLogs],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    dashboardService = TestBed.inject(DashboardService);

    // Dynamically log test events to verify reactive functionality without hardcoded mock data
    dashboardService.logAuditEvent('User SSO Login', 'Figma', 'SAML 2.0', 'success', 'Low', {
      eventType: 'SSO_LOGIN',
      severity: 'INFO',
    });
    dashboardService.logAuditEvent('Blocked credential abuse', 'Directory API', 'Web Portal', 'blocked', 'High', {
      eventType: 'SSO_LOGIN',
      severity: 'SECURITY_ALERT',
      threatIndicator: {
        anomalyType: 'FAILED_LOGIN_BURST',
        description: 'Anomalous login attempt burst',
        alertLevel: 'CRITICAL',
      },
    });
    dashboardService.logAuditEvent('RADIUS 802.1X connection', 'Aruba-AP01', 'RADIUS (1812)', 'success', 'Low', {
      eventType: 'RADIUS_AUTH',
      severity: 'INFO',
    });
    dashboardService.logAuditEvent('MFA step-up required', 'AWS Console', 'SAML 2.0', 'challenge', 'Medium', {
      eventType: 'MFA_CHALLENGE',
      severity: 'WARN',
    });

    fixture = TestBed.createComponent(AdminAuditLogs);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should create the admin audit logs component', () => {
    expect(component).toBeTruthy();
  });

  it('should dynamically display logged audit events without hardcoded mock arrays', () => {
    expect(component.filteredAuditEvents().length).toBe(4);
    expect(component.paginatedAuditEvents().length).toBeLessThanOrEqual(component.auditPageSize());
  });

  it('should support multi-dimensional filtering across eventType, severity, and status', () => {
    component.setAuditEventType('SSO_LOGIN');
    expect(component.auditEventTypeFilter()).toBe('SSO_LOGIN');
    expect(component.filteredAuditEvents().every((e) => e.eventType === 'SSO_LOGIN')).toBe(true);

    component.setAuditSeverity('INFO');
    expect(component.auditSeverityFilter()).toBe('INFO');
    expect(component.filteredAuditEvents().every((e) => e.severity === 'INFO' && e.eventType === 'SSO_LOGIN')).toBe(true);

    component.setAuditStatus('success');
    expect(component.auditStatusFilter()).toBe('success');
    expect(component.filteredAuditEvents().every((e) => e.status === 'success')).toBe(true);

    component.resetAuditFilters();
    expect(component.auditEventTypeFilter()).toBe('all');
    expect(component.auditSeverityFilter()).toBe('all');
    expect(component.auditStatusFilter()).toBe('all');
  });

  it('should toggle anomalies-only filtering', () => {
    component.toggleAuditThreatsOnly();
    expect(component.auditThreatsOnlyFilter()).toBe(true);
    expect(component.filteredAuditEvents().every((e) => !!e.threatIndicator)).toBe(true);
    expect(component.filteredAuditEvents().length).toBe(1);

    component.toggleAuditThreatsOnly();
    expect(component.auditThreatsOnlyFilter()).toBe(false);
    expect(component.filteredAuditEvents().length).toBe(4);
  });

  it('should inspect audit event and handle escape key to close drawer', () => {
    const testEvt = component.filteredAuditEvents()[0];
    component.inspectEvent(testEvt);
    expect(component.showAuditInspector()).toBe(true);
    expect(component.selectedAuditEvent()?.id).toBe(testEvt.id);

    // Trigger escape key
    component.onEscape();
    expect(component.showAuditInspector()).toBe(false);
  });

  it('should format event JSON and handle clipboard copy', () => {
    const testEvt = component.filteredAuditEvents()[0];
    const jsonStr = component.formatJson(testEvt);
    expect(jsonStr).toContain('{');
    expect(jsonStr).toContain(testEvt.id);

    // Mock clipboard
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    component.copyEventJson(testEvt);
    expect(writeTextSpy).toHaveBeenCalledWith(jsonStr);
  });

  it('should calculate pagination range correctly', () => {
    component.setAuditPageSize(2);
    const range = component.getPaginationRange();
    expect(range.length).toBeGreaterThanOrEqual(1);
    expect(range).toContain(1);
  });

  it('should delegate exportAuditLogs without error', () => {
    expect(() => component.exportAuditLogs()).not.toThrow();
  });

  it('SCRUM-184: locks CSV audit export on Free tier and unlocks after Company Admin upgrades via PayMongo', () => {
    dashboardService.user.set({
      id: 'usr-company-admin-1',
      name: 'Ada Lovelace',
      email: 'ada@acme.com',
      role: 'admin',
      accountType: 'company',
      companyName: 'Acme Security',
    });
    dashboardService.cancelSubscriptionPlan();
    fixture.detectChanges();

    expect(component.canExportAuditCsv()).toBe(false);
    component.exportAuditLogs();
    expect(dashboardService.showPaywallModal()).toBe(true);
    expect(dashboardService.paywallFeatureMessage()).toContain('CSV audit log export');

    // Simulate Company Admin PayMongo upgrade
    dashboardService.startPaymongoCheckout('business_pro');
    const sid = new URLSearchParams((dashboardService.lastPaymongoCheckoutUrl() || '').split('?')[1]).get('session')!;
    dashboardService.finalizePaymongoReturn(sid, 'success');
    fixture.detectChanges();

    expect(component.canExportAuditCsv()).toBe(true);
    expect(component.auditRetentionDays()).toBe(30);
  });
});
