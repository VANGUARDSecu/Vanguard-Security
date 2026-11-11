import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../services/auth.service';

@Component({ standalone: true, template: '' })
class DummyLoginComponent {}

describe('DashboardComponent (Phase 1 & Phase 2)', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let authService: AuthService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', component: DummyLoginComponent }]),
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    vi.spyOn(authService, 'sendInviteEmail').mockReturnValue(
      of({ success: true, message: 'Invite sent' })
    );
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should create the dashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with protocol gateway status items', () => {
    expect(component.protocols.length).toBe(4);
    const names = component.protocols.map((p) => p.name);
    expect(names).toContain('SAML 2.0 Web SSO');
    expect(names).toContain('OpenID Connect (OIDC)');
    expect(names).toContain('Cloud LDAP Directory');
    expect(names).toContain('Cloud RADIUS Gateway');
  });

  it('should restrict company account to admin console only (SCRUM-150)', () => {
    authService.currentUser.set({
      id: 'adm-1',
      email: 'admin@vanguard.io',
      firstName: 'Super',
      lastName: 'Admin',
      companyName: 'Vanguard',
      role: 'admin',
    });

    component.toggleViewMode('user');
    expect(component.viewMode()).toBe('admin');
    expect(component.activeTab()).toBe('overview');

    component.toggleViewMode('admin');
    expect(component.viewMode()).toBe('admin');
    expect(component.activeTab()).toBe('overview');
  });

  it('should prevent non-admin directory user from switching to admin console (SCRUM-38)', () => {
    authService.currentUser.set({
      id: 'usr-1',
      email: 'employee@vanguard.io',
      firstName: 'Standard',
      lastName: 'Employee',
      companyName: 'Vanguard',
      role: 'user',
    });

    component.toggleViewMode('admin');
    expect(component.viewMode()).toBe('user');
  });

  it('should trigger session revocation feedback', () => {
    expect(component.sessionRevoked()).toBe(false);
    component.revokeAllSessions();
    expect(component.sessionRevoked()).toBe(true);
  });

  it('should compute displayName, initials, and role label correctly', () => {
    expect(component.displayName()).toBeDefined();
    expect(component.userInitials()).toBeDefined();
    expect(component.userRoleLabel()).toBeDefined();
    expect(component.clientInfo()).toBeDefined();
  });

  it('should clear session on logout', () => {
    component.onLogout();
    expect(authService.currentUser()).toBeNull();
  });

  // ==========================================
  // PHASE 2 TESTS
  // ==========================================
  it('should initialize with empty applications and handle app requests dynamically via approval workflow (SCRUM-42)', () => {
    expect(component.apps().length).toBe(0);
    expect(component.filteredApps().length).toBe(0);

    component.requestedAppName = 'AWS IAM Identity Center';
    component.requestAppJustification = 'Cloud infrastructure access';
    component.submitAppRequest();

    // Verified: request queued with Pending Approval status and not immediately granted
    expect(component.apps().length).toBe(0);
    const req = component.pendingAccessRequests().find((r) => r.appName === 'AWS IAM Identity Center');
    expect(req).toBeDefined();
    expect(req?.status).toBe('Pending Approval');

    // Admin approves request -> assigns app to active launchpad
    component.approveAccessRequest(req!.id);
    expect(component.apps().length).toBe(1);
    expect(component.apps()[0].name).toBe('AWS IAM Identity Center');
    expect(component.apps()[0].assigned).toBe(true);
  });

  it('should filter applications by category', () => {
    component.requestedAppName = 'AWS IAM';
    component.submitAppRequest();
    const req = component.pendingAccessRequests().find((r) => r.appName === 'AWS IAM');
    if (req) {
      component.approveAccessRequest(req.id);
    }

    component.setCategory('cloud');
    expect(component.selectedCategory()).toBe('cloud');
    expect(component.filteredApps().every((a) => a.category === 'cloud')).toBe(true);

    component.setCategory('all');
    expect(component.filteredApps().length).toBeGreaterThanOrEqual(1);
  });

  it('should trigger SSO launch simulation notification', () => {
    component.requestedAppName = 'AWS Cloud';
    component.submitAppRequest();
    const req = component.pendingAccessRequests().find((r) => r.appName === 'AWS Cloud');
    if (req) {
      component.approveAccessRequest(req.id);
    }
    const app = component.apps()[0];
    component.launchApp(app);
    expect(component.ssoLaunchingNotice()).toContain(app.name);
    expect(component.ssoLaunchingNotice()).toContain(app.protocol);
  });

  it('should manage application request modal state', () => {
    expect(component.showRequestAppModal()).toBe(false);
    component.openRequestAppModal();
    expect(component.showRequestAppModal()).toBe(true);

    component.requestedAppName = 'Figma Enterprise';
    component.requestAppJustification = 'Design sprint collaboration';
    component.submitAppRequest();
    expect(component.requestAppSuccess()).toBe(true);

    component.closeRequestAppModal();
    expect(component.showRequestAppModal()).toBe(false);
  });

  it('should manage emergency recovery codes generation dynamically', () => {
    expect(component.recoveryCodes().length).toBe(0);
    component.generateRecoveryCodes();
    expect(component.recoveryCodes().length).toBe(10);
    expect(component.recoveryCodes()[0]).toContain('VANG-');
  });

  it('should allow adding and removing public SSH keys', () => {
    const initialCount = component.sshKeys().length;
    component.newKeyLabel = 'Test Laptop';
    component.newKeyContent = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI12345 user@host';
    component.addSshKey();

    expect(component.sshKeys().length).toBe(initialCount + 1);
    const addedKey = component.sshKeys()[0];
    expect(addedKey.label).toBe('Test Laptop');

    component.removeSshKey(addedKey.id);
    expect(component.sshKeys().length).toBe(initialCount);
  });

  it('should reject invalid SSH key content format', () => {
    component.newKeyLabel = 'Invalid Key';
    component.newKeyContent = 'not-a-valid-ssh-key';
    component.addSshKey();

    expect(component.sshKeyError()).toContain('Invalid public key format');
  });

  it('should manage TOTP modal state', () => {
    expect(component.showEnrollTotpModal()).toBe(false);
    component.closeEnrollTotpModal();
    expect(component.showEnrollTotpModal()).toBe(false);
  });

  // ==========================================
  // PHASE 3 TESTS: DIRECTORY, AUDIT, VAULT
  // ==========================================
  it('should manage directory users and allow filtering by department and status', () => {
    component.inviteFirstName = 'Marcus';
    component.inviteLastName = 'Vance';
    component.inviteEmail = 'm.vance@vanguard.security';
    component.inviteDepartment = 'Engineering';
    component.submitInviteUser();

    expect(component.directoryUsers().length).toBeGreaterThanOrEqual(1);

    component.setDirectoryDepartment('Engineering');
    expect(component.directoryDepartmentFilter()).toBe('Engineering');
    expect(component.filteredDirectoryUsers().every((u) => u.department === 'Engineering')).toBe(true);

    component.setDirectoryDepartment('all');
    component.directorySearch.set('marcus');
    expect(component.filteredDirectoryUsers().some((u) => u.name.toLowerCase().includes('marcus'))).toBe(true);
    component.directorySearch.set('');
  });

  it('should filter directory users by search query', () => {
    component.inviteFirstName = 'Marcus';
    component.inviteLastName = 'Vance';
    component.inviteEmail = 'm.vance@vanguard.security';
    component.submitInviteUser();

    component.directorySearch.set('marcus');
    expect(component.filteredDirectoryUsers().some((u) => u.name.toLowerCase().includes('marcus'))).toBe(true);
    component.directorySearch.set('');
  });

  it('should suspend and reactivate directory user', () => {
    component.inviteFirstName = 'Marcus';
    component.inviteLastName = 'Vance';
    component.inviteEmail = 'm.vance@vanguard.security';
    component.submitInviteUser();

    const user = component.directoryUsers()[0];
    component.suspendUser(user);
    const updated = component.directoryUsers().find((u) => u.id === user.id);
    expect(updated?.accountStatus).toBe('Suspended');
    expect(component.adminActionNotice()).toContain('suspended');

    component.reactivateUser(user);
    const reactivated = component.directoryUsers().find((u) => u.id === user.id);
    expect(reactivated?.accountStatus).toBe('Active');
    expect(component.adminActionNotice()).toContain('reactivated');
  });

  it('should change user role, force password reset, and revoke user sessions', () => {
    component.inviteFirstName = 'Marcus';
    component.inviteLastName = 'Vance';
    component.inviteEmail = 'm.vance@vanguard.security';
    component.submitInviteUser();

    const user = component.directoryUsers()[0];
    component.changeUserRole(user, 'Security Officer');
    const updated = component.directoryUsers().find((u) => u.id === user.id);
    expect(updated?.role).toBe('Security Officer');

    component.forceUserPasswordReset(user);
    expect(component.adminActionNotice()).toContain('recovery email dispatched');

    component.adminRevokeUserSessions(user);
    expect(component.adminActionNotice()).toContain('tokens revoked');
  });

  it('should handle invite user validation and creation', () => {
    component.openInviteModal();
    expect(component.showInviteModal()).toBe(true);

    component.submitInviteUser();
    expect(component.inviteError()).toContain('fill out all required fields');

    component.inviteFirstName = 'Jane';
    component.inviteLastName = 'Doe';
    component.inviteEmail = 'not-an-email';
    component.submitInviteUser();
    expect(component.inviteError()).toContain('valid email address');

    const initialCount = component.directoryUsers().length;
    component.inviteEmail = 'jane.doe@vanguard.security';
    component.submitInviteUser();
    expect(component.inviteSuccess()).toBe(true);
    expect(component.directoryUsers().length).toBe(initialCount + 1);
    expect(component.directoryUsers()[0].email).toBe('jane.doe@vanguard.security');

    component.closeInviteModal();
    expect(component.showInviteModal()).toBe(false);
  });

  it('should reject employee invitation and not mutate directoryUsers when backend returns error (SCRUM-174)', () => {
    vi.spyOn(authService, 'sendInviteEmail').mockReturnValue(
      throwError(() => new Error('An active employee account already exists with this email address.'))
    );

    const initialCount = component.directoryUsers().length;
    component.inviteFirstName = 'Duplicate';
    component.inviteLastName = 'User';
    component.inviteEmail = 'dup.employee@vanguard.security';
    component.inviteDepartment = 'Engineering';
    component.submitInviteUser();

    expect(component.inviteSuccess()).toBe(false);
    expect(component.inviteError()).toContain('An active employee account already exists');
    expect(component.directoryUsers().length).toBe(initialCount);
    expect(component.directoryUsers().some((u) => u.email === 'dup.employee@vanguard.security')).toBe(false);
  });

  it('should support dynamic department and role entry, suggestions, and filtering (SCRUM-37)', () => {
    const sendSpy = vi.spyOn(authService, 'sendInviteEmail').mockReturnValue(
      of({ success: true, message: 'Invite sent' })
    );

    // Verify baseline defaults are present
    expect(component.availableDepartments()).toContain('Engineering');
    expect(component.availableDepartments()).toContain('Security Ops');
    expect(component.availableDepartments()).toContain('Human Resources');
    expect(component.availableRoles()).toContain('Directory Member');
    expect(component.availableRoles()).toContain('Security Officer');

    // Validation: blank department or role is rejected
    component.openInviteModal();
    component.inviteFirstName = 'Legal';
    component.inviteLastName = 'Counsel';
    component.inviteEmail = 'counsel@vanguard.security';
    component.inviteDepartment = '   ';
    component.submitInviteUser();
    expect(component.inviteError()).toContain('fill out all required fields');
    expect(component.inviteSuccess()).toBe(false);

    component.inviteDepartment = 'Corporate Legal';
    component.inviteRole = '   ';
    component.submitInviteUser();
    expect(component.inviteError()).toContain('fill out all required fields');
    expect(component.inviteSuccess()).toBe(false);

    // Valid submission with custom department and custom role
    component.inviteDepartment = 'Corporate Legal';
    component.inviteRole = 'General Counsel & DPO';
    component.submitInviteUser();

    expect(component.inviteSuccess()).toBe(true);
    expect(component.inviteError()).toBeNull();

    // Verify user is provisioned with exact custom department and role
    const provisionedUser = component.directoryUsers().find((u) => u.email === 'counsel@vanguard.security');
    expect(provisionedUser).toBeDefined();
    expect(provisionedUser?.department).toBe('Corporate Legal');
    expect(provisionedUser?.role).toBe('General Counsel & DPO');

    // Verify invitation email payload received the custom strings
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'counsel@vanguard.security',
        department: 'Corporate Legal',
        role: 'General Counsel & DPO',
      })
    );

    // Verify availableDepartments dynamically includes the new custom department
    expect(component.availableDepartments()).toContain('Corporate Legal');
    // Verify availableRoles dynamically includes the new custom role
    expect(component.availableRoles()).toContain('General Counsel & DPO');

    // Verify directory filtering by custom department
    component.setDirectoryDepartment('Corporate Legal');
    expect(component.directoryDepartmentFilter()).toBe('Corporate Legal');
    expect(component.filteredDirectoryUsers().length).toBeGreaterThanOrEqual(1);
    expect(component.filteredDirectoryUsers().every((u) => u.department === 'Corporate Legal')).toBe(true);

    // Reset filter
    component.setDirectoryDepartment('all');
  });

  it('should prevent duplicate user creation when active email already exists (SCRUM-40)', () => {
    let existingActive = component.directoryUsers().find((u) => u.accountStatus === 'Active');
    if (!existingActive) {
      existingActive = {
        id: 'usr-active-test',
        name: 'Active User',
        email: 'active.user@vanguard.security',
        department: 'Engineering',
        role: 'Security Analyst',
        mfaStatus: 'Email OTP Only',
        accountStatus: 'Active',
        lastLogin: 'Just now',
        initials: 'AU',
      };
      component.directoryUsers.update((users) => [existingActive!, ...users]);
    }
    expect(existingActive).toBeDefined();

    component.openInviteModal();
    component.inviteFirstName = 'Duplicate';
    component.inviteLastName = 'Active';
    component.inviteEmail = existingActive!.email;
    component.submitInviteUser();

    expect(component.inviteError()).toContain('An active employee account already exists');
    expect(component.existingPendingUser()).toBeNull();
  });

  it('should detect duplicate pending invitation and allow 1-click renewal (SCRUM-40)', () => {
    vi.spyOn(authService, 'sendInviteEmail').mockReturnValue(
      of({ success: true, message: 'Invitation resent' })
    );

    // First invite creates a pending user
    component.openInviteModal();
    component.inviteFirstName = 'Pending';
    component.inviteLastName = 'Person';
    component.inviteEmail = 'pending.person@vanguard.security';
    component.submitInviteUser();
    expect(component.inviteSuccess()).toBe(true);
    const initialUsersCount = component.directoryUsers().length;

    // Reset modal fields and try to invite same email again
    component.openInviteModal();
    component.inviteFirstName = 'Pending';
    component.inviteLastName = 'Person';
    component.inviteEmail = 'pending.person@vanguard.security';
    component.submitInviteUser();

    expect(component.inviteError()).toContain('already pending');
    expect(component.existingPendingUser()).not.toBeNull();
    expect(component.existingPendingUser()?.email).toBe('pending.person@vanguard.security');

    // Perform 1-click renewal
    component.renewExistingPendingUser();
    expect(component.showInviteModal()).toBe(false);
    expect(component.directoryUsers().length).toBe(initialUsersCount); // No duplicate rows!
    const renewed = component.directoryUsers().find((u) => u.email === 'pending.person@vanguard.security');
    expect(renewed?.accountStatus).toBe('Pending');
    expect(renewed?.expiresAt).toBeDefined();
    expect(renewed?.lastLogin).toContain('Invite resent');
  });

  it('should resend invitation with fresh temporary password and renewed 48h expiration (SCRUM-40)', () => {
    const sendSpy = vi.spyOn(authService, 'sendInviteEmail').mockReturnValue(
      of({ success: true, message: 'Invite dispatched' })
    );

    const pendingUser = component.directoryUsers().find((u) => u.accountStatus === 'Pending') || {
      id: 'usr-test-pending',
      name: 'Test Expired User',
      email: 'expired.user@vanguard.security',
      department: 'Engineering',
      role: 'Security Analyst',
      mfaStatus: 'Email OTP Only' as const,
      accountStatus: 'Expired' as const,
      lastLogin: 'Never',
      initials: 'TE',
      temporaryPassword: 'OldPassword123!',
      invitedAt: new Date(Date.now() - 50 * 3600 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    };

    if (!component.directoryUsers().some((u) => u.id === pendingUser.id)) {
      component.directoryUsers.update((users) => [pendingUser, ...users]);
    }

    const oldPassword = pendingUser.temporaryPassword;
    component.resendInvitation(pendingUser);

    expect(sendSpy).toHaveBeenCalled();
    const updated = component.directoryUsers().find((u) => u.id === pendingUser.id);
    expect(updated).toBeDefined();
    expect(updated?.accountStatus).toBe('Pending');
    expect(updated?.temporaryPassword).not.toBe(oldPassword);
    expect(new Date(updated!.expiresAt!).getTime()).toBeGreaterThan(Date.now());
    expect(component.adminActionNotice()).toContain('Invitation successfully re-sent');
  });

  it('should format invite expiry text correctly (SCRUM-40)', () => {
    const now = Date.now();
    const futureUser: any = {
      expiresAt: new Date(now + 40 * 3600 * 1000).toISOString(),
    };
    const expiredUser: any = {
      expiresAt: new Date(now - 1000).toISOString(),
    };
    const noExpiryUser: any = {};

    expect(component.getInviteExpiryText(futureUser)).toContain('Expires in');
    expect(component.getInviteExpiryText(expiredUser)).toBe('Expired');
    expect(component.getInviteExpiryText(noExpiryUser)).toBe('Expires in 48h');
  });

  it('should manage audit events and support status and protocol filtering', () => {
    component.dashboardService.logAuditEvent('Test Auth', 'Corporate-WiFi', 'RADIUS (1812)', 'challenge', 'Medium');
    component.dashboardService.logAuditEvent('Web Login', 'Portal', 'Web Portal', 'success', 'Low');

    expect(component.tenantAuditEvents().length).toBeGreaterThanOrEqual(2);

    component.setAuditStatus('challenge');
    expect(component.auditStatusFilter()).toBe('challenge');
    expect(component.filteredAuditEvents().every((e) => e.status === 'challenge')).toBe(true);

    component.setAuditStatus('all');
    component.setAuditProtocol('RADIUS (1812)');
    expect(component.filteredAuditEvents().every((e) => e.protocol === 'RADIUS (1812)')).toBe(true);
  });

  it('should filter audit events by search query', () => {
    component.dashboardService.logAuditEvent('Test Auth', '194.26.29.112 Gateway', 'Web Portal', 'blocked', 'High');
    component.auditSearchQuery.set('194.26.29.112');
    expect(component.filteredAuditEvents().some((e) => e.target.includes('194.26.29.112') || e.clientIp.includes('127.0.0.1'))).toBe(true);
    component.auditSearchQuery.set('');
  });

  it('should filter audit events by event type and severity (SCRUM-26)', () => {
    component.dashboardService.logAuditEvent('Test Auth', 'Corporate-WiFi', 'RADIUS (1812)', 'success', 'Low', {
      eventType: 'RADIUS_AUTH',
      severity: 'INFO',
    });
    component.dashboardService.logAuditEvent('Brute force alert', 'Directory Gateway', 'Web Portal', 'blocked', 'High', {
      eventType: 'SSO_LOGIN',
      severity: 'SECURITY_ALERT',
    });

    component.setAuditEventType('RADIUS_AUTH');
    expect(component.auditEventTypeFilter()).toBe('RADIUS_AUTH');
    expect(component.filteredAuditEvents().every((e) => e.eventType === 'RADIUS_AUTH')).toBe(true);

    component.setAuditEventType('all');
    component.setAuditSeverity('SECURITY_ALERT');
    expect(component.auditSeverityFilter()).toBe('SECURITY_ALERT');
    expect(component.filteredAuditEvents().every((e) => e.severity === 'SECURITY_ALERT')).toBe(true);

    component.resetAuditFilters();
    expect(component.auditEventTypeFilter()).toBe('all');
    expect(component.auditSeverityFilter()).toBe('all');
    expect(component.auditStatusFilter()).toBe('all');
    expect(component.auditProtocolFilter()).toBe('all');
  });

  it('should filter audit events by anomalies only and date range (SCRUM-26)', () => {
    component.dashboardService.logAuditEvent('Test Auth', 'Corporate-WiFi', 'RADIUS (1812)', 'success', 'Low');
    component.dashboardService.logAuditEvent('Brute force alert', 'Directory Gateway', 'Web Portal', 'blocked', 'High', {
      threatIndicator: {
        anomalyType: 'FAILED_LOGIN_BURST',
        description: 'Rapid attempt bursts',
        alertLevel: 'HIGH',
      },
    });

    component.toggleAuditThreatsOnly();
    expect(component.auditThreatsOnlyFilter()).toBe(true);
    expect(component.filteredAuditEvents().every((e) => !!e.threatIndicator)).toBe(true);
    expect(component.filteredAuditEvents().length).toBe(1);

    component.toggleAuditThreatsOnly();
    expect(component.auditThreatsOnlyFilter()).toBe(false);

    component.setAuditDateRange('24h');
    expect(component.auditDateRangeFilter()).toBe('24h');
    expect(component.filteredAuditEvents().length).toBe(2);

    component.resetAuditFilters();
  });

  it('should open and close audit inspector drawer with full forensics (SCRUM-26)', () => {
    component.dashboardService.logAuditEvent('Test Auth', 'Corporate-WiFi', 'RADIUS (1812)', 'success', 'Low');
    const events = component.tenantAuditEvents();
    expect(events.length).toBeGreaterThan(0);

    const targetEvt = events[0];
    component.openAuditInspector(targetEvt);
    expect(component.showAuditInspector()).toBe(true);
    expect(component.selectedAuditEvent()?.id).toBe(targetEvt.id);
    expect(component.selectedAuditEvent()?.requestId).toBeTruthy();

    component.closeAuditInspector();
    expect(component.showAuditInspector()).toBe(false);
  });

  it('should handle pagination controls and page sizing (SCRUM-26)', () => {
    for (let i = 0; i < 7; i++) {
      component.dashboardService.logAuditEvent(`Event ${i}`, 'Gateway', 'Web Portal', 'success', 'Low');
    }
    component.resetAuditFilters();
    component.setAuditPageSize(5);
    expect(component.auditPageSize()).toBe(5);
    expect(component.paginatedAuditEvents().length).toBeLessThanOrEqual(5);

    const totalPages = component.auditTotalPages();
    expect(totalPages).toBeGreaterThanOrEqual(1);

    component.setAuditPage(2);
    expect(component.auditCurrentPage()).toBe(Math.min(2, totalPages));

    component.setAuditPageSize(10);
    expect(component.auditCurrentPage()).toBe(1);
  });

  it('should trigger audit log CSV export with enhanced columns without error (SCRUM-26)', () => {
    expect(() => component.exportAuditLogs()).not.toThrow();
    expect(component.adminActionNotice()).toContain('exported successfully');
  });

  it('should toggle tenant-wide security policies', () => {
    const initialMfa = component.enforceMfaAll();
    component.toggleEnforceMfa();
    expect(component.enforceMfaAll()).toBe(!initialMfa);

    const initialTor = component.blockHighRiskIps();
    component.toggleBlockHighRiskIps();
    expect(component.blockHighRiskIps()).toBe(!initialTor);
  });

  it('should handle global emergency killswitch modal and execution', () => {
    expect(component.showGlobalKillswitchModal()).toBe(false);
    component.openGlobalKillswitchModal();
    expect(component.showGlobalKillswitchModal()).toBe(true);

    vi.spyOn(component.dashboardService, 'executeGlobalKillswitch').mockImplementation(() => {
      component.dashboardService.globalKillswitchSuccess.set(true);
    });
    component.executeGlobalKillswitch();
    expect(component.globalKillswitchSuccess()).toBe(true);

    component.closeGlobalKillswitchModal();
    expect(component.showGlobalKillswitchModal()).toBe(false);
  });

  // ==========================================
  // PHASE 4 TESTS: SAML 2.0 & OIDC FEDERATION
  // ==========================================
  it('should manage SAML/OIDC sub-tab navigation', () => {
    expect(component.samlSubTab()).toBe('apps');

    component.setSamlSubTab('idp-metadata');
    expect(component.samlSubTab()).toBe('idp-metadata');

    component.setSamlSubTab('oidc-clients');
    expect(component.samlSubTab()).toBe('oidc-clients');

    component.setSamlSubTab('sso-sandbox');
    expect(component.samlSubTab()).toBe('sso-sandbox');
  });

  it('should initialize certificate metadata and handle federated connectors and OIDC clients', () => {
    expect(component.idpCert().daysRemaining).toBe(284);
    expect(component.idpCert().sha256Fingerprint).toBeDefined();

    component.newAppName = 'AWS IAM';
    component.newAppEntityId = 'urn:amazon:webservices';
    component.newAppAcsUrl = 'https://signin.aws.amazon.com/saml';
    component.submitAddAppConnector();
    expect(component.federatedSamlConnectors().length).toBe(1);
  });

  it('should trigger IdP metadata XML and certificate downloads without error', () => {
    expect(() => component.downloadIdpMetadataXml()).not.toThrow();
    expect(component.adminActionNotice()).toContain('Metadata XML exported');

    expect(() => component.downloadX509Cert()).not.toThrow();
    expect(component.adminActionNotice()).toContain('Certificate downloaded');

    expect(() => component.copyCertFingerprint()).not.toThrow();
  });

  it('should handle X.509 certificate rotation modal and execution', () => {
    expect(component.showRotateCertModal()).toBe(false);
    component.openRotateCertModal();
    expect(component.showRotateCertModal()).toBe(true);

    component.executeRotateCert();
    expect(component.rotateCertSuccess()).toBe(true);

    component.closeRotateCertModal();
    expect(component.showRotateCertModal()).toBe(false);
  });

  it('should validate and create new federated application connector', () => {
    component.openAddAppModal();
    expect(component.showAddAppModal()).toBe(true);

    component.submitAddAppConnector();
    expect(component.addAppError()).toContain('fill out all required fields');

    component.newAppName = 'Snowflake Cloud';
    component.newAppEntityId = 'https://snowflake.vanguard';
    component.newAppAcsUrl = 'ftp://bad-url';
    component.submitAddAppConnector();
    expect(component.addAppError()).toContain('valid HTTP or HTTPS');

    const initialCount = component.federatedSamlConnectors().length;
    component.newAppAcsUrl = 'https://app.snowflake.com/sso/saml';
    component.submitAddAppConnector();
    expect(component.addAppSuccess()).toBe(true);
    expect(component.federatedSamlConnectors().length).toBe(initialCount + 1);
    expect(component.federatedSamlConnectors()[0].name).toBe('Snowflake Cloud');

    component.closeAddAppModal();
    expect(component.showAddAppModal()).toBe(false);
  });

  it('should toggle connector status and delete connector from catalog', () => {
    component.newAppName = 'Snowflake Cloud';
    component.newAppEntityId = 'https://snowflake.vanguard';
    component.newAppAcsUrl = 'https://app.snowflake.com/sso/saml';
    component.submitAddAppConnector();

    const conn = component.federatedSamlConnectors()[0];
    const initialStatus = conn.status;
    component.toggleAppConnectorStatus(conn);
    const updated = component.federatedSamlConnectors().find((c) => c.id === conn.id);
    expect(updated?.status).not.toBe(initialStatus);

    const countBeforeDelete = component.federatedSamlConnectors().length;
    component.deleteAppConnector(conn.id);
    expect(component.federatedSamlConnectors().length).toBe(countBeforeDelete - 1);
  });

  it('should reveal and regenerate OIDC client secret', () => {
    component.dashboardService.oidcClients.set([{
      id: 'oidc-test',
      name: 'Test OIDC Client',
      clientId: 'client_123',
      clientSecret: 'secret_abc',
      revealed: false,
      redirectUris: ['https://example.com/callback'],
      grantTypes: ['authorization_code'],
      allowedScopes: ['openid', 'profile'],
      createdAt: 'Today'
    }]);

    const client = component.oidcClients()[0];
    expect(client.revealed).toBe(false);

    component.toggleRevealClientSecret(client);
    const updatedClient = component.oidcClients().find((c) => c.id === client.id);
    expect(updatedClient?.revealed).toBe(true);

    const prevSecret = updatedClient!.clientSecret;
    component.regenerateClientSecret(updatedClient!);
    const regenClient = component.oidcClients().find((c) => c.id === client.id);
    expect(regenClient?.clientSecret).not.toBe(prevSecret);
    expect(regenClient?.clientSecret).toContain('vg_sec_');
  });

  it('should compute simulated SAML 2.0 XML assertion and OIDC JWT in sandbox', () => {
    expect(component.simulatedSamlXml()).toContain('Notice');

    component.dashboardService.directoryUsers.set([{
      id: 'usr-sim',
      name: 'Sim User',
      email: 'sim@vanguard.security',
      department: 'Engineering',
      role: 'Directory Member',
      mfaStatus: 'Enrolled (TOTP)',
      accountStatus: 'Active',
      lastLogin: 'Just now',
      initials: 'SU',
    }]);
    component.dashboardService.federatedSamlConnectors.set([{
      id: 'conn-sim',
      name: 'Sim App',
      icon: '🌐',
      protocol: 'SAML 2.0',
      entityId: 'urn:sim:app',
      acsUrl: 'https://sim.app/acs',
      nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      signResponse: true,
      signAssertion: true,
      status: 'Active',
      assignedGroups: ['Engineering'],
      lastSsoEvent: 'Just now',
    }]);
    component.sandboxSelectedUserId = 'usr-sim';
    component.sandboxSelectedAppId = 'conn-sim';

    const samlXml = component.simulatedSamlXml();
    expect(samlXml).toContain('<samlp:Response');
    expect(samlXml).toContain('urn:vanguard:security:idp');
    expect(samlXml).toContain('<ds:Signature');
    expect(samlXml).toContain('<saml:AttributeStatement');

    const jwtHeader = component.simulatedOidcJwtHeader();
    expect(jwtHeader).toContain('RS256');

    const jwtPayload = component.simulatedOidcJwtPayload();
    expect(jwtPayload).toContain('https://auth.vanguard.security');
    expect(jwtPayload).toContain('mfa_verified');

    expect(() => component.copySimulatedAssertion()).not.toThrow();
  });

  // ==========================================
  // PHASE 5: Cloud LDAP & RADIUS Network Tests
  // ==========================================
  it('should manage LDAP hosts and service credentials', () => {
    expect(component.ldapHosts().length).toBe(0);

    expect(component.ldapAdminPwRevealed()).toBe(false);
    expect(component.ldapReadonlyPwRevealed()).toBe(false);

    component.toggleLdapAdminPwRevealed();
    expect(component.ldapAdminPwRevealed()).toBe(true);

    component.toggleLdapReadonlyPwRevealed();
    expect(component.ldapReadonlyPwRevealed()).toBe(true);

    const prevAdmin = component.ldapAdminPassword();
    const prevRo = component.ldapReadonlyPassword();
    component.regenerateLdapPasswords();
    expect(component.ldapAdminPassword()).not.toBe(prevAdmin);
    expect(component.ldapReadonlyPassword()).not.toBe(prevRo);
  });

  it('should manage LDAP host creation, status toggle, and deletion', () => {
    component.openAddLdapHostModal();
    expect(component.showAddLdapHostModal()).toBe(true);

    component.newLdapHostName = '';
    component.newLdapHostIp = '';
    component.submitAddLdapHost();
    expect(component.addLdapHostError()).toContain('Please provide host name');

    const initialCount = component.ldapHosts().length;
    component.newLdapHostName = 'TrueNAS Core Storage Cluster';
    component.newLdapHostType = 'NAS Storage';
    component.newLdapHostIp = '10.100.2.50';
    component.newLdapHostProtocol = 'LDAPS (636)';
    component.submitAddLdapHost();
    expect(component.addLdapHostSuccess()).toBe(true);
    expect(component.ldapHosts().length).toBe(initialCount + 1);

    const host = component.ldapHosts()[0];
    const prevStatus = host.status;
    component.toggleLdapHostStatus(host);
    const updatedHost = component.ldapHosts().find((h) => h.id === host.id);
    expect(updatedHost?.status).not.toBe(prevStatus);

    const countBeforeDelete = component.ldapHosts().length;
    component.deleteLdapHost(host.id);
    expect(component.ldapHosts().length).toBe(countBeforeDelete - 1);

    component.closeAddLdapHostModal();
    expect(component.showAddLdapHostModal()).toBe(false);
  });

  it('should compute simulated LDAP bind trace log and execute test', () => {
    expect(component.ldapDiagLog()).toContain('Diagnostic Idle');

    component.dashboardService.directoryUsers.set([{
      id: 'usr-1',
      name: 'Admin',
      email: 'admin@vanguard.security',
      department: 'Security Ops',
      role: 'Super Administrator',
      mfaStatus: 'Enrolled (TOTP)',
      accountStatus: 'Active',
      lastLogin: 'Just now',
      initials: 'AD'
    }]);
    component.dashboardService.ldapHosts.set([{
      id: 'host-1',
      name: 'Synology NAS',
      type: 'NAS Storage',
      ipAddress: '10.100.1.15',
      protocol: 'LDAPS (636)',
      status: 'Connected',
      dailyBinds: 10,
      bindUser: 'cn=admin',
      lastActive: 'Just now'
    }]);

    const log = component.ldapDiagLog();
    expect(log).toContain('ldaps://ldap.vanguard.security:636');
    expect(log).toContain('TLS 1.3 Handshake completed');
    expect(log).toContain('Result Code: 0 (LDAP_SUCCESS)');
    expect(log).toContain('memberOf: cn=');

    component.runLdapBindTest();
    expect(component.ldapDiagRunning()).toBe(true);
    expect(() => component.copyLdapDiagLog()).not.toThrow();
  });

  it('should initialize with RADIUS shared secret and allow registration', () => {
    expect(component.radiusAccessPoints().length).toBe(0);
    expect(component.radiusSecretRevealed()).toBe(false);
    component.toggleRadiusSecretRevealed();
    expect(component.radiusSecretRevealed()).toBe(true);
  });

  it('should manage RADIUS access point registration, status toggle, and deletion', () => {
    component.openAddRadiusApModal();
    expect(component.showAddRadiusApModal()).toBe(true);

    component.newRadiusApName = '';
    component.newRadiusApIp = '';
    component.submitAddRadiusAp();
    expect(component.addRadiusApError()).toContain('Please provide AP/Gateway name');

    const initialCount = component.radiusAccessPoints().length;
    component.newRadiusApName = 'HQ Floor 4 - Cisco Catalyst 9130';
    component.newRadiusApType = 'Cisco Catalyst 9100';
    component.newRadiusApIp = '192.168.10.4';
    component.submitAddRadiusAp();
    expect(component.addRadiusApSuccess()).toBe(true);
    expect(component.radiusAccessPoints().length).toBe(initialCount + 1);

    const ap = component.radiusAccessPoints()[0];
    const prevStatus = ap.status;
    component.toggleRadiusApStatus(ap);
    const updatedAp = component.radiusAccessPoints().find((a) => a.id === ap.id);
    expect(updatedAp?.status).not.toBe(prevStatus);

    const countBeforeDelete = component.radiusAccessPoints().length;
    component.deleteRadiusAp(ap.id);
    expect(component.radiusAccessPoints().length).toBe(countBeforeDelete - 1);

    component.closeAddRadiusApModal();
    expect(component.showAddRadiusApModal()).toBe(false);
  });

  it('should manage RADIUS shared secret rotation', () => {
    component.openRotateRadiusSecretModal();
    expect(component.showRotateRadiusSecretModal()).toBe(true);

    component.closeRotateRadiusSecretModal();
    expect(component.showRotateRadiusSecretModal()).toBe(false);

    expect(() => component.executeRotateRadiusSecret()).not.toThrow();
  });

  it('should compute simulated RADIUS 802.1X packet log and dynamic VLAN assignment', () => {
    expect(component.radiusDiagLog()).toContain('Diagnostic Idle');

    component.dashboardService.directoryUsers.set([{
      id: 'usr-1',
      name: 'Admin',
      email: 'admin@vanguard.security',
      department: 'Security Ops',
      role: 'Super Administrator',
      mfaStatus: 'Enrolled (TOTP)',
      accountStatus: 'Active',
      lastLogin: 'Just now',
      initials: 'AD'
    }]);
    component.dashboardService.radiusAccessPoints.set([{
      id: 'ap-1',
      name: 'Aruba AP',
      type: 'Aruba WPA3 Enterprise',
      ipAddress: '192.168.10.1',
      sharedSecret: 'secret',
      status: 'Active',
      lastAuthEvent: 'Just now'
    }]);

    const log = component.radiusDiagLog();
    expect(log).toContain('radtest -t eap');
    expect(log).toContain('Sending Access-Request to radius.vanguard.security:1812');
    expect(log).toContain('Received Access-Accept from radius.vanguard.security:1812');
    expect(log).toContain('Authentication SUCCESS');

    component.runRadiusAuthTest();
    expect(component.radiusDiagRunning()).toBe(true);
    expect(() => component.copyRadiusDiagLog()).not.toThrow();
  });

  // ==========================================
  // SCRUM-23: Cloud RADIUS Client & Network Access Point Manager Tests
  // ==========================================
  it('should validate IPv4 address and CIDR subnet syntax for RADIUS clients', () => {
    component.openAddRadiusApModal();
    component.newRadiusApName = 'Branch AP';
    component.newRadiusApIp = 'invalid-subnet-ip';
    component.submitAddRadiusAp();

    expect(component.addRadiusApError()).toContain('Invalid IPv4 address or CIDR subnet');

    // Valid CIDR notation
    component.newRadiusApIp = '192.168.1.0/24';
    component.submitAddRadiusAp();
    expect(component.addRadiusApSuccess()).toBe(true);
    expect(component.radiusAccessPoints().some(ap => ap.ipAddress === '192.168.1.0/24')).toBe(true);
  });

  it('should generate high-entropy cryptographic secrets and allow reveal and copy', () => {
    component.openAddRadiusApModal();
    expect(component.newRadiusApSecret().length).toBeGreaterThanOrEqual(24);
    expect(component.newRadiusApSecretRevealed()).toBe(false);

    component.toggleNewRadiusSecretRevealed();
    expect(component.newRadiusApSecretRevealed()).toBe(true);

    const firstSecret = component.newRadiusApSecret();
    component.regenerateNewRadiusClientSecret();
    expect(component.newRadiusApSecret()).not.toBe(firstSecret);
    expect(component.newRadiusApSecret().length).toBe(24);

    expect(() => component.copyNewRadiusSecret()).not.toThrow();
  });

  it('should support editing RADIUS client details and rotating per-client secret', () => {
    component.openAddRadiusApModal();
    component.newRadiusApName = 'Main HQ Wi-Fi - UniFi AP';
    component.newRadiusApType = 'Ubiquiti UniFi AP';
    component.newRadiusApIp = '192.168.1.50';
    component.newRadiusApDesc = 'Executive Floor Array';
    component.newRadiusApProtocol = 'PEAP-MSCHAPv2';
    component.submitAddRadiusAp();

    const client = component.radiusAccessPoints().find(a => a.name === 'Main HQ Wi-Fi - UniFi AP');
    expect(client).toBeTruthy();
    expect(client?.description).toBe('Executive Floor Array');
    expect(client?.authProtocol).toBe('PEAP-MSCHAPv2');

    // Per-client secret reveal toggle
    expect(client?.secretRevealed).toBeFalsy();
    component.toggleRadiusClientSecretRevealed(client!.id);
    const revealedClient = component.radiusAccessPoints().find(a => a.id === client!.id);
    expect(revealedClient?.secretRevealed).toBe(true);

    // Per-client secret rotation
    const originalSecret = revealedClient!.sharedSecret;
    component.rotateRadiusClientSecret(client!.id);
    const rotatedClient = component.radiusAccessPoints().find(a => a.id === client!.id);
    expect(rotatedClient?.sharedSecret).not.toBe(originalSecret);
    expect(rotatedClient?.sharedSecret.length).toBe(24);

    // Edit client
    component.openEditRadiusApModal(rotatedClient!);
    expect(component.editingRadiusApId).toBe(rotatedClient!.id);
    expect(component.newRadiusApName).toBe('Main HQ Wi-Fi - UniFi AP');
    component.newRadiusApName = 'Updated HQ Wi-Fi - UniFi AP 6';
    component.submitAddRadiusAp();
    const updatedClient = component.radiusAccessPoints().find(a => a.id === client!.id);
    expect(updatedClient?.name).toBe('Updated HQ Wi-Fi - UniFi AP 6');

    expect(() => component.copyRadiusClientSecret(updatedClient!.sharedSecret)).not.toThrow();
  });

  it('should manage recent 802.1X authentication activity stream and filtering', () => {
    component.dashboardService.radiusAuthActivity.set([
      {
        id: 'rad-act-1',
        timestamp: '2 mins ago',
        clientMac: 'D4:61:9D:3A:8B:01',
        username: 'alex.vanguard@vanguard.security',
        nasClientName: 'Main HQ Wi-Fi - UniFi AP',
        nasIp: '192.168.1.50',
        protocol: 'PEAP-MSCHAPv2',
        status: 'Access-Accept',
        vlanId: 10,
        reason: 'Credentials verified against Supabase Vault',
      },
      {
        id: 'rad-act-2',
        timestamp: '6 mins ago',
        clientMac: 'BC:D0:74:11:F2:A9',
        username: 'sarah.connor@vanguard.security',
        nasClientName: 'Cisco Meraki MR Branch Gateway',
        nasIp: '10.200.0.1',
        protocol: 'EAP-TLS',
        status: 'Access-Accept',
        vlanId: 20,
        reason: 'Valid X.509 client certificate presented',
      },
      {
        id: 'rad-act-3',
        timestamp: '14 mins ago',
        clientMac: 'F0:18:98:C3:4D:7E',
        username: 'unknown_contractor',
        nasClientName: 'Main HQ Wi-Fi - UniFi AP',
        nasIp: '192.168.1.50',
        protocol: 'MS-CHAPv2',
        status: 'Access-Reject',
        reason: 'Authentication failed: Invalid credentials or expired account',
      },
      {
        id: 'rad-act-4',
        timestamp: '28 mins ago',
        clientMac: '70:EF:00:81:4A:23',
        username: 'dev-ops-service',
        nasClientName: 'Aruba CX R&D Lab AP',
        nasIp: '172.16.50.10',
        protocol: 'PAP',
        status: 'Access-Accept',
        vlanId: 30,
        reason: 'Service token authenticated',
      },
    ]);
    const initialEvents = component.radiusAuthActivity();
    expect(initialEvents.length).toBeGreaterThanOrEqual(4);
    expect(initialEvents[0].clientMac).toMatch(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i);

    // Simulate Access-Accept event
    const prevCount = component.radiusAuthActivity().length;
    component.simulateRadiusAuth(true);
    expect(component.radiusAuthActivity().length).toBe(prevCount + 1);
    const latestAccept = component.radiusAuthActivity()[0];
    expect(latestAccept.status).toBe('Access-Accept');
    expect(latestAccept.vlanId).toBeDefined();

    // Simulate Access-Reject event
    component.simulateRadiusAuth(false);
    const latestReject = component.radiusAuthActivity()[0];
    expect(latestReject.status).toBe('Access-Reject');
    expect(latestReject.vlanId).toBeUndefined();

    // Filter by Access-Accept
    component.setRadiusActivityFilter('Access-Accept');
    expect(component.filteredRadiusActivity().every(e => e.status === 'Access-Accept')).toBe(true);

    // Filter by Access-Reject
    component.setRadiusActivityFilter('Access-Reject');
    expect(component.filteredRadiusActivity().every(e => e.status === 'Access-Reject')).toBe(true);

    // Reset filter to all
    component.setRadiusActivityFilter('all');
    expect(component.filteredRadiusActivity().length).toBe(component.radiusAuthActivity().length);
  });

  // ==========================================
  // PHASE 6: Mobile Companion App & Biometrics Tests
  // ==========================================
  it('should initialize with personal and fleet devices and mobile security policies', () => {
    expect(component.userDevices().length).toBe(0);
    expect(component.fleetDevices().length).toBe(0);
    expect(component.mobilePolicy().enforceNumberMatching).toBe(true);

    component.confirmPairDevice();
    expect(component.userDevices().length).toBe(1);
    expect(component.fleetDevices().length).toBe(1);
    expect(component.userDevices()[0].biometricType).toBe('Face ID');
  });

  it('should manage device pairing modal state', () => {
    expect(component.showPairDeviceModal()).toBe(false);
    component.openPairDeviceModal();
    expect(component.showPairDeviceModal()).toBe(true);
    expect(component.newPairingToken()).toBeDefined();
    expect(component.newPairingKey()).toBeDefined();

    component.closePairDeviceModal();
    expect(component.showPairDeviceModal()).toBe(false);
  });

  it('should manage push notification challenge simulation', () => {
    expect(component.showPushSimulatorModal()).toBe(false);
    component.startPushSimulation();
    expect(component.showPushSimulatorModal()).toBe(true);
    expect(component.simulatedPushStep()).toBe('notification');

    component.openNotificationChallenge();
    expect(component.simulatedPushStep()).toBe('challenge');

    const wrongNum = 999999;
    component.selectSimulatedNumberMatch(wrongNum);
    expect(component.simulatedPushStep()).toBe('denied');

    component.retryPushSimulation();
    const correctNum = component.simulatedChallengeNumber();
    component.openNotificationChallenge();
    component.selectSimulatedNumberMatch(correctNum);
    expect(component.simulatedPushStep()).toBe('biometric');

    component.denySimulatedPush();
    expect(component.simulatedPushStep()).toBe('denied');

    component.closePushSimulator();
    expect(component.showPushSimulatorModal()).toBe(false);
  });

  it('should manage remote device wipe workflow', () => {
    component.confirmPairDevice();
    const dev = component.fleetDevices()[0];
    expect(dev).toBeDefined();

    component.openWipeDeviceModal(dev);
    expect(component.showWipeDeviceModal()).toBe(true);
    expect(component.selectedDeviceForWipe()?.id).toBe(dev.id);

    component.closeWipeDeviceModal();
    expect(component.showWipeDeviceModal()).toBe(false);
  });

  it('should toggle fleet device compliance status and update mobile policy', () => {
    component.confirmPairDevice();
    const dev = component.fleetDevices()[0];
    const initialStatus = dev.complianceStatus;
    component.toggleFleetDeviceCompliance(dev);
    const updated = component.fleetDevices().find((d) => d.id === dev.id);
    expect(updated?.complianceStatus).not.toBe(initialStatus);

    component.updateMobilePolicy('enforceBiometrics', false);
    expect(component.mobilePolicy().enforceBiometrics).toBe(false);
  });

  // ==========================================
  // SCRUM-22: SAML 2.0 & OIDC Application Integration Wizard Tests
  // ==========================================
  describe('SCRUM-22: Application Integration Wizard & State Management', () => {
    it('should initialize with pre-configured app catalog templates', () => {
      const templates = component.dashboardService.appCatalogTemplates;
      expect(templates.length).toBeGreaterThanOrEqual(7);
      const ids = templates.map((t) => t.id);
      expect(ids).toContain('aws-iam');
      expect(ids).toContain('google-workspace');
      expect(ids).toContain('salesforce');
      expect(ids).toContain('github-enterprise');
      expect(ids).toContain('slack');
      expect(ids).toContain('custom-saml');
      expect(ids).toContain('custom-oidc');
    });

    it('should filter catalog templates by search query and protocol filter', () => {
      component.dashboardService.wizardCatalogSearch = 'aws';
      expect(component.dashboardService.filteredCatalogTemplates().length).toBe(1);
      expect(component.dashboardService.filteredCatalogTemplates()[0].id).toBe('aws-iam');

      component.dashboardService.wizardCatalogSearch = '';
      component.dashboardService.wizardCatalogFilter.set('OIDC');
      const oidcTemplates = component.dashboardService.filteredCatalogTemplates();
      expect(oidcTemplates.every((t) => t.protocol === 'OIDC')).toBe(true);

      component.dashboardService.wizardCatalogFilter.set('all');
      expect(component.dashboardService.filteredCatalogTemplates().length).toBe(
        component.dashboardService.appCatalogTemplates.length
      );
    });

    it('should select a catalog template and advance to step 2 with presets filled', () => {
      component.dashboardService.openAddAppModal();
      expect(component.dashboardService.wizardStep()).toBe(1);

      const awsTpl = component.dashboardService.appCatalogTemplates.find((t) => t.id === 'aws-iam')!;
      component.dashboardService.selectCatalogTemplate(awsTpl);

      expect(component.dashboardService.wizardStep()).toBe(2);
      expect(component.dashboardService.wizardSelectedTemplate()?.id).toBe('aws-iam');
      expect(component.dashboardService.newAppName).toBe('AWS IAM Identity Center');
      expect(component.dashboardService.newAppProtocol).toBe('SAML 2.0');
      expect(component.dashboardService.newAppEntityId).toBe('https://signin.aws.amazon.com/saml');
      expect(component.dashboardService.newAppAcsUrl).toBe('https://signin.aws.amazon.com/saml');
      expect(component.dashboardService.wizardAttributeStatements().length).toBe(2);
    });

    it('should manage interactive attribute statements mapping rows', () => {
      component.dashboardService.openAddAppModal();
      component.dashboardService.addAttributeStatementRow('department', 'urn:oid:department');
      const statements = component.dashboardService.wizardAttributeStatements();
      expect(statements.some((s) => s.samlClaim === 'urn:oid:department')).toBe(true);

      const idx = statements.findIndex((s) => s.samlClaim === 'urn:oid:department');
      component.dashboardService.updateAttributeStatement(idx, 'samlClaim', 'custom:dept');
      expect(component.dashboardService.wizardAttributeStatements()[idx].samlClaim).toBe('custom:dept');

      component.dashboardService.removeAttributeStatementRow(idx);
      expect(component.dashboardService.wizardAttributeStatements().some((s) => s.samlClaim === 'custom:dept')).toBe(false);
    });

    it('should manage OIDC client credentials, tag chips for redirect URIs, grant types, and scopes', () => {
      component.dashboardService.openAddAppModal();
      const oidcTpl = component.dashboardService.appCatalogTemplates.find((t) => t.id === 'custom-oidc')!;
      component.dashboardService.selectCatalogTemplate(oidcTpl);

      expect(component.dashboardService.newAppProtocol).toBe('OIDC');
      expect(component.dashboardService.wizardClientId()).toContain('vg_client_');
      expect(component.dashboardService.wizardClientSecret()).toContain('vg_sec_');

      // Chip additions and removals
      component.dashboardService.wizardNewRedirectUriInput = 'https://myapp.io/callback';
      component.dashboardService.addRedirectUriChip();
      expect(component.dashboardService.wizardRedirectUris()).toContain('https://myapp.io/callback');

      const chipIdx = component.dashboardService.wizardRedirectUris().indexOf('https://myapp.io/callback');
      component.dashboardService.removeRedirectUriChip(chipIdx);
      expect(component.dashboardService.wizardRedirectUris()).not.toContain('https://myapp.io/callback');

      // Grant types & scopes toggles
      expect(component.dashboardService.wizardGrantTypes()).not.toContain('client_credentials');
      component.dashboardService.toggleWizardGrantType('client_credentials');
      expect(component.dashboardService.wizardGrantTypes()).toContain('client_credentials');

      // 'groups' is present in custom-oidc defaultScopes; toggle off then on
      expect(component.dashboardService.wizardScopes()).toContain('groups');
      component.dashboardService.toggleWizardScope('groups');
      expect(component.dashboardService.wizardScopes()).not.toContain('groups');
      component.dashboardService.toggleWizardScope('groups');
      expect(component.dashboardService.wizardScopes()).toContain('groups');
    });

    it('should enforce client-side validation when stepping through wizard', () => {
      component.dashboardService.openAddAppModal();
      component.dashboardService.wizardStep.set(2);
      component.dashboardService.newAppName = '';
      component.dashboardService.setWizardStep(3);
      expect(component.dashboardService.addAppError()).toContain('Application Name is required');

      component.dashboardService.newAppName = 'Custom App';
      component.dashboardService.newAppProtocol = 'SAML 2.0';
      component.dashboardService.newAppEntityId = '';
      component.dashboardService.setWizardStep(3);
      expect(component.dashboardService.addAppError()).toContain('Entity ID / Audience URI is required');

      component.dashboardService.newAppEntityId = 'https://entity.id';
      component.dashboardService.newAppAcsUrl = 'not-a-url';
      component.dashboardService.setWizardStep(3);
      expect(component.dashboardService.addAppError()).toContain('valid HTTP or HTTPS');
    });

    it('should support addApp(), updateApp(), and deleteApp() reactive actions', () => {
      const initialSamlCount = component.dashboardService.federatedSamlConnectors().length;
      const initialAppsCount = component.dashboardService.apps().length;

      // addApp reactive action
      component.dashboardService.addApp({
        id: 'test-app-1',
        name: 'Datadog Cloud Monitoring',
        protocol: 'SAML 2.0',
        entityId: 'https://datadog.com/sp',
        acsUrl: 'https://app.datadoghq.com/sso/saml',
        assignedGroups: ['Engineering'],
      });

      expect(component.dashboardService.federatedSamlConnectors().length).toBe(initialSamlCount + 1);
      expect(component.dashboardService.apps().length).toBe(initialAppsCount + 1);
      const app = component.dashboardService.federatedSamlConnectors().find((c) => c.id === 'test-app-1');
      expect(app?.name).toBe('Datadog Cloud Monitoring');

      // updateApp reactive action
      component.dashboardService.updateApp('test-app-1', { name: 'Datadog Enterprise' });
      const updatedApp = component.dashboardService.federatedSamlConnectors().find((c) => c.id === 'test-app-1');
      expect(updatedApp?.name).toBe('Datadog Enterprise');

      // deleteApp reactive action
      component.dashboardService.deleteApp('test-app-1');
      expect(component.dashboardService.federatedSamlConnectors().some((c) => c.id === 'test-app-1')).toBe(false);
      expect(component.dashboardService.apps().some((a) => a.id === 'test-app-1')).toBe(false);
    });
  });

  describe('SCRUM-24: Cloud LDAP Configuration & Bind Verification Console', () => {
    it('should expose connection configuration parameters and trigger 1-click copy notice', () => {
      expect(component.ldapServerHost()).toBe('ldap.vanguardsecurity.io');
      expect(component.ldapPortLdaps()).toBe(636);
      expect(component.ldapPortStartTls()).toBe(389);
      expect(component.ldapBaseDn()).toBe('dc=vanguard,dc=security');
      expect(component.ldapOrgDn()).toBe('o=Vanguard Security Enterprise,dc=vanguard,dc=security');
      expect(component.ldapUsersOu()).toBe('ou=Users,dc=vanguard,dc=security');
      expect(component.ldapGroupsOu()).toBe('ou=Groups,dc=vanguard,dc=security');
      expect(component.ldapServicesOu()).toBe('ou=services,dc=vanguard,dc=security');

      // Test copy parameter
      component.copyLdapParam(component.ldapServerHost(), 'Server Host');
      expect(component.copiedLdapParamNotice()).toContain('Server Host copied to clipboard');

      // Test CA Cert download
      expect(component.ldapCaCertPem()).toContain('-----BEGIN CERTIFICATE-----');
      expect(component.ldapCaCertPem()).toContain('-----END CERTIFICATE-----');
      expect(() => component.downloadLdapCaCert()).not.toThrow();
    });

    it('should manage Service Account Bind Credentials lifecycle', () => {
      const initialCount = component.ldapServiceAccounts().length;
      expect(initialCount).toBeGreaterThan(0);

      // Open Modal
      component.openAddServiceAccountModal();
      expect(component.showAddServiceAccountModal()).toBe(true);
      expect(component.newSvcAcctPassword().length).toBe(32);

      // Validation check
      component.newSvcAcctName = '';
      component.newSvcAcctUid = '';
      component.submitAddServiceAccount();
      expect(component.addServiceAccountError()).toContain('Service Account Name and UID are required');

      // Regenerate password
      const firstPw = component.newSvcAcctPassword();
      component.generateSvcAcctPassword();
      const secondPw = component.newSvcAcctPassword();
      expect(secondPw.length).toBe(32);
      expect(secondPw).not.toBe(firstPw);

      // Provision new service account
      component.newSvcAcctName = 'QNAP TS-464 Backup Target';
      component.newSvcAcctUid = 'svc_qnap_ts464';
      component.newSvcAcctType = 'QNAP QTS';
      component.newSvcAcctIpRestriction = '10.200.5.0/24';
      component.submitAddServiceAccount();

      expect(component.addServiceAccountSuccess()).toBe(true);
      expect(component.ldapServiceAccounts().length).toBe(initialCount + 1);

      const created = component.ldapServiceAccounts().find((a) => a.bindDn.includes('svc_qnap_ts464'));
      expect(created).toBeDefined();
      expect(created?.bindDn).toBe('uid=svc_qnap_ts464,ou=services,dc=vanguard,dc=security');
      expect(created?.status).toBe('Active');

      // Password reveal toggle
      const initialRevealed = created?.passwordRevealed ?? false;
      component.toggleSvcAcctPwRevealed(created!.id);
      const afterToggle = component.ldapServiceAccounts().find((a) => a.id === created!.id);
      expect(afterToggle?.passwordRevealed).toBe(!initialRevealed);

      // Status toggle (Active -> Revoked -> Active)
      component.toggleServiceAccountStatus(afterToggle!);
      const revoked = component.ldapServiceAccounts().find((a) => a.id === created!.id);
      expect(revoked?.status).toBe('Revoked');
      component.toggleServiceAccountStatus(revoked!);
      const reactivated = component.ldapServiceAccounts().find((a) => a.id === created!.id);
      expect(reactivated?.status).toBe('Active');

      // Delete service account
      component.deleteServiceAccount(created!.id);
      expect(component.ldapServiceAccounts().some((a) => a.id === created!.id)).toBe(false);

      // Close modal
      component.closeAddServiceAccountModal();
      expect(component.showAddServiceAccountModal()).toBe(false);
    });

    it('should support presets and return code inspection in bind connectivity sandbox', () => {
      // Load service-account preset
      component.loadLdapDiagPreset('service-account');
      expect(component.ldapDiagBindDn).toContain('ou=services');
      expect(component.ldapDiagFilter).toContain('objectClass=posixAccount');

      // Load invalid auth preset
      component.loadLdapDiagPreset('invalid');
      expect(component.ldapDiagBindDn).toContain('uid=svc_invalid');
      expect(component.ldapDiagBindPassword).toBe('WrongPassword123!');

      // Run bind test with invalid auth
      component.runLdapBindTest();
      expect(component.ldapDiagRunning()).toBe(true);

      // Simulate async completion or check immediate test result state
      const invalidResult = component.ldapTestResult();
      expect(invalidResult).toBeDefined();
      expect(invalidResult?.resultCode).toBe(49);
      expect(invalidResult?.resultName).toBe('LDAP_INVALID_CREDENTIALS');
      expect(invalidResult?.status).toBe('error');

      // Load valid user preset and test success
      component.loadLdapDiagPreset('user');
      component.runLdapBindTest();
      const validResult = component.ldapTestResult();
      expect(validResult).toBeDefined();
      expect(validResult?.resultCode).toBe(0);
      expect(validResult?.resultName).toBe('LDAP_SUCCESS');
      expect(validResult?.status).toBe('success');
      expect(validResult?.latencyMs).toBeGreaterThan(0);
      expect(validResult?.cipher).toContain('TLS_AES_256_GCM_SHA384');
    });
  });

  describe('SCRUM-25: User Groups & Group-to-App Permission Matrix', () => {
    beforeEach(() => {
      const rootId = component.directoryUsers()[0]?.id || 'usr-root';
      component.dashboardService.directoryGroups.set([
        {
          id: 'grp-devops',
          name: 'DevOps & Cloud Infrastructure',
          description: 'Core engineering and infrastructure leads with production cloud access.',
          department: 'Engineering',
          email: 'devops-team@vanguard.security',
          memberIds: [rootId],
          appIds: ['aws-iam', 'github', 'datadog'],
          policy: {
            requireMfa: true,
            mfaType: 'hardware_totp',
            sessionDurationHours: 4,
          },
          createdAt: '2026-09-01T00:00:00.000Z',
        },
        {
          id: 'grp-secops',
          name: 'Security Operations (SecOps)',
          description: 'Cybersecurity threat responders, SOC analysts, and incident handlers.',
          department: 'Security Ops',
          email: 'secops@vanguard.security',
          memberIds: [rootId, 'johnroben.manayon31@gmail.com'],
          appIds: ['jira', 'github', 'slack'],
          policy: {
            requireMfa: true,
            mfaType: 'hardware_totp',
            sessionDurationHours: 2,
          },
          createdAt: '2026-09-01T00:00:00.000Z',
        },
        {
          id: 'grp-design',
          name: 'Product & Design',
          description: 'UI/UX product designers, design system engineers, and product managers.',
          department: 'Engineering',
          email: 'design-team@vanguard.security',
          memberIds: [],
          appIds: ['figma', 'slack', 'jira'],
          policy: {
            requireMfa: true,
            mfaType: 'any',
            sessionDurationHours: 8,
          },
          createdAt: '2026-09-02T00:00:00.000Z',
        },
        {
          id: 'grp-sales',
          name: 'Sales & Marketing',
          description: 'Enterprise account executives, marketing leads, and customer success specialists.',
          department: 'Finance',
          email: 'revenue-ops@vanguard.security',
          memberIds: [],
          appIds: ['salesforce', 'slack', 'google-workspace'],
          policy: {
            requireMfa: false,
            mfaType: 'any',
            sessionDurationHours: 12,
          },
          createdAt: '2026-09-03T00:00:00.000Z',
        },
      ]);
    });
    it('should initialize default user groups with expected policy configurations', () => {
      const groups = component.directoryGroups();
      expect(groups.length).toBeGreaterThanOrEqual(4);

      const devops = groups.find((g) => g.id === 'grp-devops');
      expect(devops).toBeDefined();
      expect(devops?.name).toBe('DevOps & Cloud Infrastructure');
      expect(devops?.department).toBe('Engineering');
      expect(devops?.appIds).toContain('aws-iam');
      expect(devops?.policy.requireMfa).toBe(true);
      expect(devops?.policy.mfaType).toBe('hardware_totp');

      const secops = groups.find((g) => g.id === 'grp-secops');
      expect(secops?.policy.sessionDurationHours).toBe(2);
    });

    it('should filter groups by search query (name, department, email)', () => {
      component.dashboardService.directoryGroupSearch.set('DevOps');
      expect(component.filteredDirectoryGroups().length).toBe(1);
      expect(component.filteredDirectoryGroups()[0].id).toBe('grp-devops');

      component.dashboardService.directoryGroupSearch.set('Security Ops');
      expect(component.filteredDirectoryGroups().some((g) => g.id === 'grp-secops')).toBe(true);

      component.dashboardService.directoryGroupSearch.set('nonexistent-query-xyz');
      expect(component.filteredDirectoryGroups().length).toBe(0);

      component.dashboardService.directoryGroupSearch.set('');
      expect(component.filteredDirectoryGroups().length).toBe(component.directoryGroups().length);
    });

    it('should toggle directory subtabs and group modal subtabs', () => {
      component.setDirectoryActiveSubTab('groups');
      expect(component.directoryActiveSubTab()).toBe('groups');

      component.setDirectoryActiveSubTab('users');
      expect(component.directoryActiveSubTab()).toBe('users');

      component.openCreateGroupModal();
      expect(component.showGroupModal()).toBe(true);
      expect(component.groupModalActiveTab()).toBe('details');

      component.setGroupModalActiveTab('members');
      expect(component.groupModalActiveTab()).toBe('members');

      component.setGroupModalActiveTab('apps');
      expect(component.groupModalActiveTab()).toBe('apps');

      component.setGroupModalActiveTab('policies');
      expect(component.groupModalActiveTab()).toBe('policies');

      component.closeGroupModal();
      expect(component.showGroupModal()).toBe(false);
    });

    it('should validate form and create a new enterprise user group', () => {
      component.openCreateGroupModal();

      // Empty validation
      component.groupFormName = '';
      component.saveGroup();
      expect(component.groupFormError()).toContain('Group name is required');

      component.groupFormName = 'QA & Test Automation';
      component.groupFormEmail = 'invalid-email';
      component.saveGroup();
      expect(component.groupFormError()).toContain('valid group email');

      const initialCount = component.directoryGroups().length;
      component.groupFormEmail = 'qa-team@vanguard.security';
      component.groupFormDescription = 'Quality engineers responsible for automated E2E testing.';
      component.groupFormDepartment = 'Engineering';
      component.toggleGroupFormApp('github');
      component.toggleGroupFormApp('jira');

      component.saveGroup();
      expect(component.groupFormSuccess()).toBe(true);
      expect(component.directoryGroups().length).toBe(initialCount + 1);

      const created = component.directoryGroups().find((g) => g.name === 'QA & Test Automation');
      expect(created).toBeDefined();
      expect(created?.email).toBe('qa-team@vanguard.security');
      expect(created?.appIds).toContain('github');
      expect(created?.appIds).toContain('jira');
    });

    it('should edit an existing group, toggle member and app assignments, and persist updates', () => {
      const group = component.directoryGroups()[0];
      component.openEditGroupModal(group);
      expect(component.editingGroup()?.id).toBe(group.id);
      expect(component.groupFormName).toBe(group.name);

      // Toggle member and app
      component.toggleGroupFormMember('usr-test-123');
      expect(component.groupFormMemberIds()).toContain('usr-test-123');
      component.toggleGroupFormMember('usr-test-123');
      expect(component.groupFormMemberIds()).not.toContain('usr-test-123');

      component.toggleGroupFormApp('figma');
      expect(component.groupFormAppIds()).toContain('figma');

      // Update name and description
      component.groupFormName = group.name + ' Updated';
      component.groupFormDescription = 'Updated description';
      component.saveGroup();

      const updated = component.directoryGroups().find((g) => g.id === group.id);
      expect(updated?.name).toContain('Updated');
      expect(updated?.appIds).toContain('figma');
    });

    it('should automatically grant inherited app access to users who are members of the group', () => {
      authService.currentUser.set({
        id: 'usr-member-1',
        email: 's.connor@vanguard.security',
        firstName: 'Sarah',
        lastName: 'Connor',
        role: 'user',
        companyName: 'Vanguard Security Systems',
        phone: '+1 555 0199',
      });

      // Set test user
      component.dashboardService.directoryUsers.set([
        {
          id: 'usr-member-1',
          name: 'Sarah Connor',
          email: 's.connor@vanguard.security',
          department: 'Engineering',
          role: 'Directory Member',
          mfaStatus: 'Enrolled (TOTP)',
          accountStatus: 'Active',
          lastLogin: 'Today',
          initials: 'SC',
        },
      ]);

      // Create group containing usr-member-1 with datadog and github
      component.openCreateGroupModal();
      component.groupFormName = 'Site Reliability Engineering';
      component.groupFormEmail = 'sre@vanguard.security';
      component.toggleGroupFormMember('usr-member-1');
      component.toggleGroupFormApp('datadog');
      component.toggleGroupFormApp('github');
      component.saveGroup();

      // Check user groups
      const user = component.dashboardService.directoryUsers()[0];
      const userGroups = component.dashboardService.getUserGroups(user);
      expect(userGroups.some((g) => g.name === 'Site Reliability Engineering')).toBe(true);

      // Check that apps were inherited
      const userApps = component.dashboardService.apps();
      const inheritedDatadog = userApps.find((a) => a.id === 'datadog');
      expect(inheritedDatadog).toBeDefined();
      expect(inheritedDatadog?.inheritedViaGroup).toBe('Site Reliability Engineering');
    });

    it('should delete a group and synchronize member permissions', () => {
      const initialCount = component.directoryGroups().length;
      const targetGroup = component.directoryGroups()[0];

      component.deleteGroup(targetGroup.id);
      expect(component.directoryGroups().length).toBe(initialCount - 1);
      expect(component.directoryGroups().some((g) => g.id === targetGroup.id)).toBe(false);
    });
  });

  describe('SCRUM-42: Admin Approval Workflow & Access Request Queue', () => {
    beforeEach(() => {
      component.dashboardService.appAccessRequests.set([
        {
          id: 'req-101',
          userId: 'usr-analyst-1',
          userName: 'Elena Rostova',
          userEmail: 'elena.rostova@vanguard.security',
          department: 'Security Ops',
          role: 'SOC Analyst',
          appName: 'Datadog Cloud SIEM',
          protocol: 'SAML 2.0',
          category: 'cloud',
          icon: '📊',
          launchUrl: 'https://app.datadoghq.com',
          justification: 'Need access to inspect real-time firewall threat telemetry and incident event correlations.',
          status: 'Pending Approval',
          submittedAt: new Date().toISOString(),
        },
      ]);
    });
    it('should filter access requests by search query and status badge', () => {
      component.setAccessRequestStatusFilter('all');
      expect(component.filteredAccessRequests().length).toBeGreaterThanOrEqual(1);

      component.setAccessRequestStatusFilter('Pending Approval');
      expect(component.filteredAccessRequests().every((r) => r.status === 'Pending Approval')).toBe(true);

      component.accessRequestSearch = 'Elena';
      expect(component.filteredAccessRequests().every((r) => r.userName.includes('Elena') || r.userEmail.includes('Elena'))).toBe(true);

      component.accessRequestSearch = '';
      component.setAccessRequestStatusFilter('all');
    });

    it('should open Access Requests queue directly via sidebar navigation', () => {
      component.openAccessRequestsQueue();
      expect(component.dashboardService.viewMode()).toBe('admin');
      expect(component.dashboardService.activeTab()).toBe('access-requests');
    });

    it('should approve an access request, assign SaaS app, and log audit event', () => {
      component.requestedAppName = 'Slack Enterprise Grid';
      component.requestAppJustification = 'Org-wide security incident channels';
      component.submitAppRequest();

      const req = component.pendingAccessRequests().find((r) => r.appName === 'Slack Enterprise Grid');
      expect(req).toBeDefined();

      component.approveAccessRequest(req!.id, 'Approved for Incident Responders');

      const approvedReq = component.appAccessRequests().find((r) => r.id === req!.id);
      expect(approvedReq?.status).toBe('Approved');
      expect(approvedReq?.adminNotes).toBe('Approved for Incident Responders');

      // Check app assigned
      const app = component.apps().find((a) => a.name === 'Slack Enterprise Grid');
      expect(app).toBeDefined();
      expect(app?.assigned).toBe(true);

      // Check audit log
      const auditLog = component.tenantAuditEvents().find((e) => e.action?.includes('Slack Enterprise Grid'));
      expect(auditLog).toBeDefined();
    });

    it('should reject an access request, prevent assignment, and record rejection audit log', () => {
      component.requestedAppName = 'High Risk Unsanctioned SaaS';
      component.requestAppJustification = 'Personal use';
      component.submitAppRequest();

      const req = component.pendingAccessRequests().find((r) => r.appName === 'High Risk Unsanctioned SaaS');
      expect(req).toBeDefined();

      component.rejectAccessRequest(req!.id, 'Violates corporate security policy');

      const rejectedReq = component.appAccessRequests().find((r) => r.id === req!.id);
      expect(rejectedReq?.status).toBe('Rejected');
      expect(rejectedReq?.adminNotes).toBe('Violates corporate security policy');

      // Check app is NOT assigned
      const app = component.apps().find((a) => a.name === 'High Risk Unsanctioned SaaS');
      expect(app).toBeUndefined();

      // Check audit log
      const auditLog = component.tenantAuditEvents().find((e) => e.action?.includes('High Risk Unsanctioned SaaS'));
      expect(auditLog).toBeDefined();
      expect(auditLog?.status).toBe('blocked');
    });
  });

  describe('SCRUM-176: Interactive Dashboard Approval Challenge', () => {
    it('should delegate approveLiveSsoChallenge and denyLiveSsoChallenge to dashboardService', () => {
      const approveSpy = vi.spyOn(component.dashboardService, 'approveLiveSsoChallenge').mockImplementation(() => {});
      const denySpy = vi.spyOn(component.dashboardService, 'denyLiveSsoChallenge').mockImplementation(() => {});

      component.approveLiveSsoChallenge('push_123', 42);
      expect(approveSpy).toHaveBeenCalledWith('push_123', 42);

      component.denyLiveSsoChallenge('push_123', true);
      expect(denySpy).toHaveBeenCalledWith('push_123', true);
    });

    it('SCRUM-167: refreshes access requests when user approves a live SSO challenge', () => {
      vi.spyOn(authService, 'respondPushMfa').mockReturnValue(
        of({ success: true, message: 'Approved', action: 'approved' })
      );
      const reloadSpy = vi.spyOn(component.dashboardService, 'loadAccessRequests').mockResolvedValue();
      component.dashboardService.liveSsoChallenge.set({
        id: 'push_dummy_1',
        clientId: 'vanguard-dummy-portal',
        appName: 'Acme Dummy Portal (Angular SPA)',
      });

      component.approveLiveSsoChallenge('push_dummy_1', 42);

      expect(reloadSpy).toHaveBeenCalledWith(true);
    });
  });
});


