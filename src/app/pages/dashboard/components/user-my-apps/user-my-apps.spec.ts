import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { UserMyApps } from './user-my-apps';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../../../services/auth.service';

describe('UserMyApps Component (SCRUM-52 Multi-Workspace & Personal App Launcher)', () => {
  let component: UserMyApps;
  let fixture: ComponentFixture<UserMyApps>;
  let dashboardService: DashboardService;
  let authService: AuthService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [UserMyApps],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    authService.currentUser.set({
      id: 'usr-indiv-1',
      email: 'alex@personal.me',
      firstName: 'Alex',
      lastName: 'Mercer',
      role: 'user',
      accountType: 'individual',
      companyName: "Alex's Personal Vault",
    });

    dashboardService = TestBed.inject(DashboardService);
    dashboardService.switchWorkspace('personal');

    fixture = TestBed.createComponent(UserMyApps);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.match(() => true).forEach((r) => r.flush([]));
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should create the UserMyApps component', () => {
    expect(component).toBeTruthy();
  });

  it('should reflect personal workspace mode correctly with zero hardcoded apps', () => {
    expect(component.isPersonalWorkspace()).toBe(true);
    expect(component.personalApps().length).toBe(0);
    expect(component.activeAppsList().length).toBe(0);
  });

  it('should apply quick presets for popular applications like Figma and Facebook', () => {
    component.openAddPersonalAppModal();
    expect(component.showAddPersonalAppModal()).toBe(true);

    component.applyPreset('figma');
    expect(component.newAppName).toBe('Figma');
    expect(component.newAppUrl).toBe('https://www.figma.com/login');
    expect(component.newAppCategory).toBe('collaboration');

    component.applyPreset('facebook');
    expect(component.newAppName).toBe('Facebook');
    expect(component.newAppUrl).toBe('https://www.facebook.com/login');
  });

  it('should validate inputs when adding a personal application', () => {
    component.openAddPersonalAppModal();
    component.newAppName = '';
    component.newAppUrl = '';
    component.submitAddPersonalApp();

    expect(component.addAppError()).toBe('Please provide an application name.');
    expect(component.showAddPersonalAppModal()).toBe(true);

    component.newAppName = 'Custom Service';
    component.newAppUrl = 'not-a-valid-url';
    component.submitAddPersonalApp();
    expect(component.addAppError()).toBe('Please provide a valid website or login URL.');
  });

  it('should successfully add and remove a personal application', () => {
    const initialCount = component.personalApps().length;
    component.openAddPersonalAppModal();
    component.newAppName = 'Custom Cloud Hub';
    component.newAppUrl = 'https://cloudhub.io/login';
    component.newAppCategory = 'cloud';
    component.newAppDescription = 'Cloud storage test app';
    component.submitAddPersonalApp();

    expect(component.showAddPersonalAppModal()).toBe(false);
    expect(component.personalApps().length).toBe(initialCount + 1);
    expect(component.personalApps()[0].name).toBe('Custom Cloud Hub');

    // Remove the newly created app
    const createdId = component.personalApps()[0].id;
    component.deletePersonalApp(createdId);
    expect(component.personalApps().length).toBe(initialCount);
  });

  it('should match domain credentials for web extension autofill integration', () => {
    dashboardService.addVaultItem({
      title: 'Figma Cloud',
      category: 'Login',
      username: 'designer@test.com',
      password: 'FigmaPassword123!',
      url: 'https://www.figma.com/login',
    });
    dashboardService.addPersonalApp({
      name: 'Figma',
      launchUrl: 'https://www.figma.com/login',
      category: 'collaboration',
    });
    fixture.detectChanges();

    const figmaApp = component.personalApps().find((a) => a.name.toLowerCase().includes('figma'));
    expect(figmaApp).toBeDefined();
    if (figmaApp) {
      const matched = component.getMatchingVaultCredentials(figmaApp);
      // The default seed vault contains Figma credentials
      expect(matched.length).toBeGreaterThanOrEqual(1);
      expect(matched[0].url).toContain('figma.com');
    }
  });

  it('should retain personal workspace for individual accounts and disallow enterprise context (SCRUM-150)', () => {
    dashboardService.switchWorkspace('org_root');
    expect(dashboardService.isPersonalWorkspace()).toBe(true);
    expect(dashboardService.activeWorkspaceId()).toBe('personal');

    dashboardService.switchWorkspace('personal');
    expect(dashboardService.isPersonalWorkspace()).toBe(true);
    expect(dashboardService.activeOrganization().id).toBe('personal');
  });

  it('should filter personal applications by category', () => {
    dashboardService.addPersonalApp({
      name: 'GitHub',
      launchUrl: 'https://github.com',
      category: 'developer',
    });
    dashboardService.addPersonalApp({
      name: 'Slack',
      launchUrl: 'https://slack.com',
      category: 'collaboration',
    });
    fixture.detectChanges();

    component.setCategory('developer');
    const devApps = component.filteredApps();
    expect(devApps.every((a) => a.category === 'developer')).toBe(true);

    component.setCategory('all');
    expect(component.filteredApps().length).toBe(component.personalApps().length);
  });

  describe('SCRUM-42 Admin Approval Workflow & Access Request Queue', () => {
    beforeEach(() => {
      authService.currentUser.set({
        id: 'usr-employee-1',
        email: 'employee@vanguard.security',
        firstName: 'Marcus',
        lastName: 'Vance',
        role: 'user',
        accountType: 'company',
        companyName: 'Acme Corp',
      });
      // Switch to organization workspace
      dashboardService.switchWorkspace('org_root');
      fixture.detectChanges();
    });

    it('should queue access request with Pending Approval status instead of immediate auto-provisioning', () => {
      const initialAppsCount = component.apps().length;
      component.openRequestAppModal();
      expect(component.showRequestAppModal()).toBe(true);

      component.requestedAppName = 'Figma Enterprise';
      component.requestAppJustification = 'Design systems and UI prototyping';
      component.submitAppRequest();

      // Verified: does NOT immediately grant access / does NOT add to assigned apps
      expect(component.apps().length).toBe(initialAppsCount);

      // Verified: request recorded in access requests queue with status 'Pending Approval'
      const pendingReq = dashboardService.appAccessRequests().find((r) => r.appName === 'Figma Enterprise');
      expect(pendingReq).toBeDefined();
      expect(pendingReq?.status).toBe('Pending Approval');
      expect(pendingReq?.justification).toBe('Design systems and UI prototyping');
      expect(component.pendingRequestsCount()).toBeGreaterThanOrEqual(1);
    });

    it('should block launching unapproved or pending applications with Zero-Trust Assertion Guard', () => {
      const unapprovedApp: any = {
        id: 'app-unapproved-1',
        name: 'Shadow IT App',
        assigned: false,
        status: 'Pending Approval',
        protocol: 'SAML 2.0',
        launchUrl: 'https://shadow.security',
        category: 'cloud',
        description: 'Unassigned application',
        icon: '⚠️',
      };

      component.launchApp(unapprovedApp);
      expect(dashboardService.adminActionNotice()).toContain('Zero-Trust Assertion Guard');
      expect(dashboardService.ssoLaunchingNotice()).toBeNull();
    });

    it('should provision application to user launchpad upon admin approval and enable SSO', () => {
      // 1. Submit request
      component.requestedAppName = 'AWS IAM Identity Center';
      component.requestAppJustification = 'Infrastructure maintenance';
      component.submitAppRequest();

      const req = dashboardService.appAccessRequests().find((r) => r.appName === 'AWS IAM Identity Center');
      expect(req).toBeDefined();
      expect(req?.status).toBe('Pending Approval');

      // 2. Admin approves request
      dashboardService.approveAccessRequest(req!.id, 'Approved by SecOps Admin');

      // 3. Verify request is updated to Approved
      const updatedReq = dashboardService.appAccessRequests().find((r) => r.id === req!.id);
      expect(updatedReq?.status).toBe('Approved');
      expect(updatedReq?.reviewedBy).toBeDefined();
      expect(updatedReq?.adminNotes).toBe('Approved by SecOps Admin');

      // 4. Verify application is assigned to user's apps
      const assignedApp = component.apps().find((a) => a.name === 'AWS IAM Identity Center');
      expect(assignedApp).toBeDefined();
      expect(assignedApp?.assigned).toBe(true);

      // 5. Verify launch succeeds for approved app
      component.launchApp(assignedApp!);
      expect(dashboardService.ssoLaunchingNotice()).toContain('AWS IAM Identity Center');
    });

    it('should reject access request and prevent application assignment', () => {
      component.requestedAppName = 'Unauthorized Cloud DB';
      component.requestAppJustification = 'Testing unauthorized access';
      component.submitAppRequest();

      const req = dashboardService.appAccessRequests().find((r) => r.appName === 'Unauthorized Cloud DB');
      expect(req).toBeDefined();

      // Admin rejects request
      dashboardService.rejectAccessRequest(req!.id, 'License not granted for this tier');

      const updatedReq = dashboardService.appAccessRequests().find((r) => r.id === req!.id);
      expect(updatedReq?.status).toBe('Rejected');
      expect(updatedReq?.adminNotes).toBe('License not granted for this tier');

      // Verified: NOT in assigned apps
      const assignedApp = component.apps().find((a) => a.name === 'Unauthorized Cloud DB');
      expect(assignedApp).toBeUndefined();
    });

    it('SCRUM-159: should move approved requests to active applications and exclude from requested list', () => {
      // 1. Submit request
      component.requestedAppName = 'Datadog APM';
      component.requestAppJustification = 'Application performance monitoring';
      component.submitAppRequest();

      // Before approval: in requested apps queue, not in active apps
      expect(component.myAccessRequests().some((r) => r.appName === 'Datadog APM')).toBe(true);

      const req = dashboardService.appAccessRequests().find((r) => r.appName === 'Datadog APM');
      expect(req).toBeDefined();

      // 2. Admin approves request
      dashboardService.approveAccessRequest(req!.id, 'Approved by SecOps Admin');

      // 3. After approval: excluded from myAccessRequests (requested applications queue)
      expect(component.myAccessRequests().some((r) => r.appName === 'Datadog APM')).toBe(false);

      // 4. Present in activeAppsList (applications launchpad)
      const inActiveApps = component.activeAppsList().some((a) => a.name === 'Datadog APM');
      expect(inActiveApps).toBe(true);
    });
  });

  // ==========================================================================
  // SCRUM-57: Active SSO Integrations & Connected Applications Display
  // ==========================================================================
  describe('SCRUM-57 Connected Client Applications & Live Status', () => {
    beforeEach(() => {
      component.dashboardService.connectedApps.set([
        {
          id: 'conn-dummy-portal',
          clientId: 'vanguard-dummy-portal',
          clientName: 'Acme Dummy Web',
          protocol: 'OpenID Connect 1.0 (PKCE)',
          scopes: ['openid', 'profile', 'email', 'roles', 'offline_access'],
          redirectUri: 'http://localhost:4201/auth/callback',
          originUrl: 'http://localhost:4201',
          status: 'Connected',
          connectedAt: 'Oct 23, 2026',
          lastActiveAt: 'Active Session',
          icon: '🌐',
          description: 'Single-page web portal connected to your Vanguard Security account via OpenID Connect 1.0 PKCE authentication.',
        },
      ]);
    });
    it('should display Acme Dummy Web as an active connected integration with live status', () => {
      expect(component.activeConnectedApps().length).toBeGreaterThanOrEqual(1);

      const dummyApp = component.activeConnectedApps().find((a) => a.clientId === 'vanguard-dummy-portal');
      expect(dummyApp).toBeDefined();
      expect(dummyApp?.clientName).toBe('Acme Dummy Web');
      expect(dummyApp?.status).toBe('Connected');
      expect(dummyApp?.originUrl).toBe('http://localhost:4201');
      expect(dummyApp?.redirectUri).toBe('http://localhost:4201/auth/callback');
      expect(dummyApp?.protocol).toBe('OpenID Connect 1.0 (PKCE)');
      expect(dummyApp?.scopes).toContain('openid');
      expect(dummyApp?.scopes).toContain('profile');
    });

    it('should launch connected app in browser window', () => {
      const dummyApp = component.activeConnectedApps().find((a) => a.clientId === 'vanguard-dummy-portal')!;
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null as any);

      component.launchConnectedApp(dummyApp);
      expect(openSpy).toHaveBeenCalledWith('http://localhost:4201', '_blank');
      openSpy.mockRestore();
    });

    it('should disconnect an integrated application when requested', () => {
      expect(component.activeConnectedApps().some((a) => a.clientId === 'vanguard-dummy-portal')).toBe(true);

      component.disconnectApp('vanguard-dummy-portal');

      expect(component.activeConnectedApps().some((a) => a.clientId === 'vanguard-dummy-portal')).toBe(false);
    });

    it('should strictly deduplicate connected applications and prevent duplicates (SCRUM-58)', () => {
      dashboardService.connectedApps.set([
        {
          id: 'conn-1',
          clientId: 'vanguard-dummy-portal',
          clientName: 'Acme Dummy Web',
          protocol: 'OpenID Connect 1.0 (PKCE)',
          scopes: ['openid'],
          redirectUri: 'http://localhost:4201/auth/callback',
          originUrl: 'http://localhost:4201',
          status: 'Connected',
          connectedAt: '2026-09-27',
        },
        {
          id: 'conn-2',
          clientId: 'vg_client_b3121c514e83037d',
          clientName: 'Acme Dummy Web',
          protocol: 'OpenID Connect 1.0 (PKCE)',
          scopes: ['openid', 'email'],
          redirectUri: 'http://localhost:4201/auth/callback',
          originUrl: 'http://localhost:4201',
          status: 'Connected',
          connectedAt: '2026-09-27',
        },
        {
          id: 'conn-3',
          clientId: 'another-dummy-id',
          clientName: 'Acme Dummy Web',
          protocol: 'OpenID Connect 1.0 (PKCE)',
          scopes: ['openid'],
          redirectUri: 'http://localhost:4201/auth/callback',
          originUrl: 'http://localhost:4201/',
          status: 'Connected',
          connectedAt: '2026-09-27',
        },
      ]);

      expect(component.activeConnectedApps().length).toBe(1);
      expect(component.activeConnectedApps()[0].clientName).toBe('Acme Dummy Web');
    });
  });

  describe('SCRUM-94 Backend-sourced company apps & account_type gating', () => {
    it('resolves to empty company apps for an individual account (no backend call)', () => {
      const httpMock = TestBed.inject(HttpTestingController);
      // Current auth user is individual (set in outer beforeEach).
      dashboardService.loadCompanyApps();
      httpMock.expectNone('http://localhost:3000/apps/my');
      expect(dashboardService.apps().length).toBe(0);
    });

    it('loads and maps company apps from GET /apps/my for a company account', () => {
      authService.currentUser.set({
        id: 'owner-9',
        email: 'owner@acme.com',
        firstName: 'Owner',
        lastName: 'Admin',
        role: 'admin',
        accountType: 'company',
        companyName: 'Acme',
        user_metadata: { account_type: 'company', tenant_id: 'tenant-xyz' },
      } as any);

      const httpMock = TestBed.inject(HttpTestingController);
      dashboardService.loadCompanyApps();

      const req = httpMock.expectOne(
        (r) => r.url === 'http://localhost:3000/apps/my',
      );
      req.flush([
        {
          app_id: 'github',
          name: 'GitHub',
          category: 'developer',
          protocol: 'OIDC',
          launch_url: 'https://github.com',
          icon: '🐙',
          assigned: true,
        },
      ]);

      const apps = dashboardService.apps();
      expect(apps.length).toBe(1);
      expect(apps[0].id).toBe('github');
      expect(apps[0].launchUrl).toBe('https://github.com');
      expect(apps[0].protocol).toBe('OIDC');
    });

    it('assignCompanyApp posts to /apps/assign with the admin userId', () => {
      authService.currentUser.set({
        id: 'owner-9', email: 'owner@acme.com', role: 'admin',
        accountType: 'company', companyName: 'Acme',
        user_metadata: { account_type: 'company', tenant_id: 'tenant-xyz' },
      } as any);

      const httpMock = TestBed.inject(HttpTestingController);
      dashboardService
        .assignCompanyApp({ appId: 'slack', name: 'Slack' }, { all: true })
        .subscribe();

      const req = httpMock.expectOne(
        (r) => r.url === 'http://localhost:3000/apps/assign',
      );
      expect(req.request.body.target).toBe('all');
      expect(req.request.body.appId).toBe('slack');
      req.flush({ assigned: 3 });
    });
  // ==========================================================================
  // SCRUM-161: End-to-End Application Request Lifecycle & Duplicate Prevention
  // ==========================================================================
  describe('SCRUM-161 Request Application Lifecycle, Duplicate Prevention & Removal', () => {
    beforeEach(() => {
      authService.currentUser.set({
        id: 'usr-employee-1',
        email: 'employee@vanguard.security',
        role: 'user',
        accountType: 'company',
        user_metadata: { department: 'Engineering', account_type: 'company', tenant_id: 'tenant-vanguard' },
      } as any);
      dashboardService.switchWorkspace('org_root');
      fixture.detectChanges();
    });
    it('should detect duplicate and block submission if application is already assigned and active', () => {
      // 1. App already in active apps
      dashboardService.apps.set([
        {
          id: 'app-jira-cloud',
          name: 'Jira Cloud',
          category: 'collaboration',
          description: 'Project tracking',
          icon: '📋',
          protocol: 'SAML 2.0',
          launchUrl: 'https://jira.atlassian.com',
          assigned: true,
        },
      ]);

      component.reqAppName.set('Jira Cloud');
      expect(component.duplicateCheck().isDuplicate).toBe(true);
      expect(component.duplicateCheck().type).toBe('assigned');

      // Attempt submit
      component.submitAppRequest();
      expect(component.requestAppError()).toContain('already assigned');
    });

    it('should detect duplicate and block submission if a request is already pending approval', () => {
      component.reqAppName.set('Snowflake DW');
      component.reqJustification.set('Analytics modeling');
      component.submitAppRequest();

      expect(component.duplicateCheck().isDuplicate).toBe(true);
      expect(component.duplicateCheck().type).toBe('pending');

      // Attempt second submission
      const initialCount = dashboardService.appAccessRequests().length;
      component.submitAppRequest();
      expect(dashboardService.appAccessRequests().length).toBe(initialCount);
      expect(component.requestAppError()).toContain('pending administrator review');
    });

    it('should allow tenant to remove an assigned company app and re-request it afterwards', () => {
      const app = {
        id: 'app-datadog-test',
        name: 'Datadog Cloud',
        category: 'cloud' as const,
        description: 'APM monitoring',
        icon: '🐶',
        protocol: 'Extension Autofill' as const,
        launchUrl: 'https://app.datadoghq.com',
        assigned: true,
      };
      dashboardService.apps.set([app]);
      expect(component.activeAppsList().some((a) => a.name === 'Datadog Cloud')).toBe(true);

      // Remove company application
      component.removeCompanyApp(app);
      expect(component.activeAppsList().some((a) => a.name === 'Datadog Cloud')).toBe(false);

      // Verify duplicate check is now clear
      const check = dashboardService.checkDuplicateAppRequest('Datadog Cloud');
      expect(check.isDuplicate).toBe(false);

      // Re-request is permitted
      component.reqAppName.set('Datadog Cloud');
      component.reqJustification.set('Re-requesting after project reassignment');
      component.submitAppRequest();
      expect(dashboardService.appAccessRequests().some((r) => r.appName === 'Datadog Cloud')).toBe(true);
    });

    it('should allow tenant to withdraw an access request and re-request it later', () => {
      component.reqAppName.set('Notion Enterprise');
      component.reqJustification.set('Documentation wiki');
      component.submitAppRequest();

      const req = dashboardService.appAccessRequests().find((r) => r.appName === 'Notion Enterprise');
      expect(req).toBeDefined();

      // Withdraw the request
      component.withdrawAccessRequest(req!);
      expect(dashboardService.appAccessRequests().some((r) => r.appName === 'Notion Enterprise')).toBe(false);

      // Duplicate check should be cleared
      expect(dashboardService.checkDuplicateAppRequest('Notion Enterprise').isDuplicate).toBe(false);
    });

    it('should populate delivery modes and auto-extract domains from URL inputs', () => {
      // SSO Mode
      component.setDeliveryMode('sso');
      expect(component.reqDeliveryMode()).toBe('sso');
      expect(component.reqAppName()).toBe('Acme Dummy Web');
      expect(component.reqUrl()).toBe('http://localhost:4201');
      expect(component.reqDomain()).toBe('localhost:4201');

      // Extension Mode
      component.setDeliveryMode('extension');
      expect(component.reqDeliveryMode()).toBe('extension');
      expect(component.reqAppName()).toBe('GitHub');
      expect(component.reqUrl()).toBe('https://github.com/login');
      expect(component.reqDomain()).toBe('github.com');

      // Live URL change auto-extracts domain
      component.onUrlChange('https://analytics.google.com/reporting');
      expect(component.reqDomain()).toBe('analytics.google.com');
    });
  });

  // ==========================================================================
  // SCRUM-169: Pre-Launch Security Verification & Auto-Fill Credential Injection
  // ==========================================================================
  describe('SCRUM-169 Security Verification Before Launching Apps & Auto-Fill Injection', () => {
    it('requires security verification before launching an application that is not yet logged in', () => {
      const figmaApp = {
        id: 'app-figma-sec',
        name: 'Figma',
        category: 'collaboration' as const,
        description: 'Design platform',
        icon: '🎨',
        protocol: 'Extension Autofill' as const,
        launchUrl: 'https://www.figma.com/login',
        assigned: true,
        assignedUsername: 'designer@acme.com',
        assignedPassword: 'FigmaSecretPassword!',
      };

      component.initiateSecureAppLaunch(figmaApp);
      expect(component.showLaunchVerifyModal()).toBe(true);
      expect(component.pendingLaunchApp()?.id).toBe('app-figma-sec');
      expect(component.launchCustomUsername()).toBe('designer@acme.com');
      expect(component.launchCustomPassword()).toBe('FigmaSecretPassword!');

      // Empty password should fail verification
      component.launchVerifyMethod.set('password');
      component.launchVerifySecret.set('');
      component.confirmSecureAppLaunch();
      expect(component.launchVerifyError()).toContain('password');
      expect(component.showLaunchVerifyModal()).toBe(true);

      // Valid password verifies, launches with auto-fill payload, and marks app as logged in
      component.launchVerifySecret.set('MasterPass123!');
      component.confirmSecureAppLaunch();
      expect(component.showLaunchVerifyModal()).toBe(false);
      expect(dashboardService.activeAutofillToast()?.username).toBe('designer@acme.com');
      expect(dashboardService.isAppSessionLoggedIn('app-figma-sec')).toBe(true);
    });

    it('skips verification modal and launches directly when application is already logged in', () => {
      const fbApp = {
        id: 'app-fb-sec',
        name: 'Facebook',
        category: 'collaboration' as const,
        description: 'Social suite',
        icon: '📘',
        protocol: 'Extension Autofill' as const,
        launchUrl: 'https://www.facebook.com/login',
        assigned: true,
      };

      dashboardService.markAppSessionLoggedIn('app-fb-sec', true);
      component.initiateSecureAppLaunch(fbApp);

      expect(component.showLaunchVerifyModal()).toBe(false);
      expect(dashboardService.ssoLaunchingNotice()).toContain('Session active for Facebook');
    });

    it('builds #vg_autofill=1 hash payload URL for extension auto-fill injection', () => {
      const url = dashboardService.buildAutofillLaunchUrl(
        'https://www.figma.com/login',
        'designer@acme.com',
        'MyPass123!',
      );
      expect(url).toContain('https://www.figma.com/login#');
      expect(url).toContain('vg_autofill=1');
      expect(url).toContain('vg_u=designer%40acme.com');
      expect(url).toContain('vg_p=MyPass123!');
    });
  });
  });
});
