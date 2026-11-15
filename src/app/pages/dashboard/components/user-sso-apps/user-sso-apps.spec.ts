import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { UserSsoApps } from './user-sso-apps';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../../../services/auth.service';

describe('UserSsoApps (SCRUM-184 Dedicated SSO Applications Separation)', () => {
  let fixture: ComponentFixture<UserSsoApps>;
  let component: UserSsoApps;
  let dashboardService: DashboardService;
  let authService: AuthService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [UserSsoApps],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    authService.currentUser.set({
      id: 'usr-emp-184',
      email: 'employee@acme.corp',
      role: 'user',
      accountType: 'company',
      user_metadata: { account_type: 'company', tenant_id: 'tenant-184' },
    } as any);

    dashboardService = TestBed.inject(DashboardService);
    dashboardService.switchWorkspace('tenant-184');

    fixture = TestBed.createComponent(UserSsoApps);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('displays Acme Dummy Web and OIDC/SAML apps in SSO Applications while excluding them from Extension Autofill & synced extension storage', () => {
    dashboardService.apps.set([
      {
        id: 'vanguard-dummy-portal',
        name: 'Acme Dummy Web',
        category: 'cloud',
        description: 'Dummy OIDC SSO app',
        icon: '🏢',
        protocol: 'OIDC',
        launchUrl: 'http://localhost:4201',
        assigned: true,
        status: 'Approved',
      },
      {
        id: 'app-github-ext',
        name: 'GitHub Extension Login',
        category: 'developer',
        description: 'Autofill app',
        icon: '🐙',
        protocol: 'Extension Autofill',
        launchUrl: 'https://github.com/login',
        assigned: true,
        status: 'Approved',
      },
    ]);

    fixture.detectChanges();

    expect(component.ssoApplicationsList().some((a) => a.name === 'Acme Dummy Web')).toBe(true);
    expect(dashboardService.activeAppsList().some((a) => a.name === 'Acme Dummy Web')).toBe(false);
    expect(dashboardService.activeAppsList().some((a) => a.name === 'GitHub Extension Login')).toBe(true);

    dashboardService.broadcastAppsSync();
    const syncedRaw = localStorage.getItem('vanguard_synced_apps') || '[]';
    const synced = JSON.parse(syncedRaw);
    expect(synced.some((s: any) => s.name === 'Acme Dummy Web')).toBe(false);
    expect(synced.some((s: any) => s.name === 'GitHub Extension Login')).toBe(true);
  });

  it('displays active connected SSO apps and supports disconnecting', () => {
    dashboardService.connectedApps.set([
      {
        id: 'conn-dummy-184',
        clientId: 'vanguard-dummy-portal',
        clientName: 'Acme Dummy Web',
        protocol: 'OpenID Connect 1.0 (PKCE)',
        scopes: ['openid', 'profile', 'email'],
        redirectUri: 'http://localhost:4201/auth/callback',
        originUrl: 'http://localhost:4201',
        status: 'Connected',
        connectedAt: 'Nov 14, 2026',
        description: 'Connected OIDC client',
        userEmail: 'employee@acme.corp',
      },
    ]);
    fixture.detectChanges();

    expect(component.activeConnectedApps().length).toBe(1);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Acme Dummy Web');

    component.disconnectApp('vanguard-dummy-portal');
    expect(component.activeConnectedApps().length).toBe(0);
    fixture.detectChanges();
    expect(el.textContent).toContain('No SSO Applications Connected Yet');
  });

  it('SCRUM-201: removes duplicate Assigned SSO Applications subsection from template', () => {
    dashboardService.connectedApps.set([
      {
        id: 'conn-dummy-201',
        clientId: 'vanguard-dummy-portal',
        clientName: 'Acme Dummy Web',
        protocol: 'OpenID Connect 1.0 (PKCE)',
        scopes: ['openid', 'profile', 'email'],
        redirectUri: 'http://localhost:4201/auth/callback',
        originUrl: 'http://localhost:4201',
        status: 'Connected',
        connectedAt: 'Nov 15, 2026',
        description: 'Connected OIDC client',
        userEmail: 'employee@acme.corp',
      },
    ]);
    dashboardService.apps.set([
      {
        id: 'vanguard-dummy-portal',
        name: 'Acme Dummy Web',
        category: 'cloud',
        description: 'Dummy OIDC SSO app',
        icon: '🏢',
        protocol: 'OIDC',
        launchUrl: 'http://localhost:4201',
        assigned: true,
        status: 'Approved',
      },
    ]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Assigned SSO Applications');
    expect(el.textContent).toContain('Active Connected SSO Integrations');
  });

  it('SCRUM-181: strips /auth/callback from SSO launchUrl and initiates OIDC login via ?sso=vanguard', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null as any);
    const appWithCallback: any = {
      id: 'app-dummy-cb',
      name: 'Acme Dummy Web',
      category: 'cloud',
      description: 'Dummy Web SSO',
      icon: '🌐',
      protocol: 'OpenID Connect 1.0 (PKCE)',
      launchUrl: 'http://localhost:4201/auth/callback',
      assigned: true,
      status: 'Approved',
    };

    dashboardService.apps.set([appWithCallback]);
    fixture.detectChanges();

    const listed = component.ssoApplicationsList().find((a) => a.id === 'app-dummy-cb');
    expect(listed?.launchUrl).toBe('http://localhost:4201');

    component.launchSsoApp(appWithCallback);
    expect(openSpy).toHaveBeenCalledTimes(1);
    const openedUrl = openSpy.mock.calls[0][0] as string;
    expect(openedUrl).not.toContain('/auth/callback');
    expect(openedUrl).toContain('http://localhost:4201/');
    expect(openedUrl).toContain('sso=vanguard');
    expect(openedUrl).toContain('login_hint=employee%40acme.corp');

    openSpy.mockRestore();
  });
});
