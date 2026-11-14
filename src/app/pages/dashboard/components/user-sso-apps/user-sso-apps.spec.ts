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
  });
});
