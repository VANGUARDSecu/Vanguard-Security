import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardService } from './dashboard.service';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

describe('DashboardService Cross-Device Sync (SCRUM-178)', () => {
  let dashboardService: DashboardService;
  let authService: AuthService;
  let httpMock: HttpTestingController;
  const apiBase = environment.apiUrl;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    authService.currentUser.set({
      id: 'usr-sync-1',
      email: 'sync@vanguard.dev',
      firstName: 'Sync',
      lastName: 'User',
      role: 'user',
      accountType: 'individual',
      companyName: 'Personal',
    });
    authService.token.set('live-jwt-token-sync');

    dashboardService = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
    // Drain any constructor init calls
    httpMock.match(() => true).forEach((r) => r.flush({ success: true, connectedApps: [] }));
  });

  afterEach(() => {
    dashboardService.cleanupCrossDeviceSync();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    httpMock.verify();
  });

  it('pushes add, update, and delete TOTP operations to /totp-accounts and reconciles server deletions', async () => {
    dashboardService.addTotpAccount({
      issuer: 'GitHub',
      accountName: 'sync@vanguard.dev',
      secret: 'JBSWY3DPEHPK3PXP',
    });

    const postReq = httpMock.expectOne(`${apiBase}/totp-accounts`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body.issuer).toBe('GitHub');
    const createdId = postReq.request.body.id;
    postReq.flush({
      account: {
        id: createdId,
        issuer: 'GitHub',
        accountName: 'sync@vanguard.dev',
        secret: 'JBSWY3DPEHPK3PXP',
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
      },
    });

    dashboardService.updateTotpAccount(createdId, { issuer: 'GitHub Enterprise' });
    const patchReq = httpMock.expectOne(`${apiBase}/totp-accounts/${encodeURIComponent(createdId)}`);
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.body.issuer).toBe('GitHub Enterprise');
    patchReq.flush({ account: { id: createdId, issuer: 'GitHub Enterprise' } });

    // Simulate mobile deleting the account: server returns empty accounts + deletedIds
    const loadPromise = dashboardService.loadTotpAccounts();
    const getReq = httpMock.expectOne(`${apiBase}/totp-accounts`);
    expect(getReq.request.method).toBe('GET');
    getReq.flush({ accounts: [], deletedIds: [createdId], updatedAt: '2026-11-15T01:00:00Z' });
    await loadPromise;

    expect(dashboardService.totpAccounts().length).toBe(0);

    // Deleting locally also dispatches DELETE /totp-accounts/:id
    dashboardService.deleteTotpAccount(createdId);
    const delReq = httpMock.expectOne(`${apiBase}/totp-accounts/${encodeURIComponent(createdId)}`);
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush({ success: true, id: createdId });
  });

  it('pushes personal apps to /apps/personal and removes locally when deleted on mobile', async () => {
    // Initial server bootstrap completes with empty personal apps
    const initLoad = dashboardService.loadPersonalApps();
    const initGetReq = httpMock.expectOne(`${apiBase}/apps/personal`);
    expect(initGetReq.request.method).toBe('GET');
    initGetReq.flush([]);
    await initLoad;

    const app = dashboardService.addApplication({
      name: 'Notion',
      category: 'collaboration',
      launchUrl: 'https://www.notion.so',
      icon: '📝',
    });

    const postReq = httpMock.expectOne(`${apiBase}/apps/personal`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body.name).toBe('Notion');
    postReq.flush({ ...app });
    expect(dashboardService.personalApps().length).toBe(1);

    // Server returns empty list after mobile deletes it
    const loadPromise = dashboardService.loadPersonalApps();
    const getReq = httpMock.expectOne(`${apiBase}/apps/personal`);
    expect(getReq.request.method).toBe('GET');
    getReq.flush([]);
    await loadPromise;

    expect(dashboardService.personalApps().length).toBe(0);

    dashboardService.deletePersonalApp(app.id);
    const delReq = httpMock.expectOne(`${apiBase}/apps/personal/${encodeURIComponent(app.id)}`);
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush({ success: true, id: app.id });
  });

  it('treats backend connected apps as authoritative when disconnected on another device', () => {
    dashboardService.connectedApps.set([
      {
        id: 'conn-acme-web',
        clientId: 'acme-web',
        clientName: 'Acme Dummy Web',
        originUrl: 'http://localhost:4201',
        redirectUri: 'http://localhost:4201/callback',
        userEmail: 'sync@vanguard.dev',
        scopes: ['openid', 'profile'],
        protocol: 'OIDC',
        connectedAt: '2026-11-15T00:00:00Z',
        lastActiveAt: '2026-11-15T00:00:00Z',
        status: 'Active',
      },
    ]);

    dashboardService.fetchConnectedApps();
    const req = httpMock.expectOne(
      `${apiBase}/oauth/connected-apps?email=${encodeURIComponent('sync@vanguard.dev')}`,
    );
    req.flush({ success: true, connectedApps: [] });

    expect(dashboardService.connectedApps().length).toBe(0);
  });

  it('refreshes changed domains when checkSyncState detects updated watermarks', async () => {
    const initial = dashboardService.checkSyncState();
    const stateReq1 = httpMock.expectOne(`${apiBase}/sync/state`);
    stateReq1.flush({
      totpUpdatedAt: '2026-11-15T00:00:00Z',
      personalAppsUpdatedAt: '2026-11-15T00:00:00Z',
      enterpriseAppsUpdatedAt: null,
      connectedAppsUpdatedAt: '2026-11-15T00:00:00Z',
      accessRequestsUpdatedAt: null,
    });
    await initial;

    // Second check with updated totp & connectedApps watermarks
    const second = dashboardService.checkSyncState();
    const stateReq2 = httpMock.expectOne(`${apiBase}/sync/state`);
    stateReq2.flush({
      totpUpdatedAt: '2026-11-15T00:05:00Z',
      personalAppsUpdatedAt: '2026-11-15T00:00:00Z',
      enterpriseAppsUpdatedAt: null,
      connectedAppsUpdatedAt: '2026-11-15T00:05:00Z',
      accessRequestsUpdatedAt: null,
    });

    await Promise.resolve();
    const totpReq = httpMock.expectOne(`${apiBase}/totp-accounts`);
    totpReq.flush({ accounts: [], deletedIds: [], updatedAt: '2026-11-15T00:05:00Z' });
    // loadTotpAccounts awaits refreshTotpCodes() before checkSyncState proceeds to fetchConnectedApps()
    await new Promise((resolve) => setTimeout(resolve, 25));
    const connReq = httpMock.expectOne(
      `${apiBase}/oauth/connected-apps?email=${encodeURIComponent('sync@vanguard.dev')}`,
    );
    connReq.flush({ success: true, connectedApps: [] });
    await second;
  });
});
