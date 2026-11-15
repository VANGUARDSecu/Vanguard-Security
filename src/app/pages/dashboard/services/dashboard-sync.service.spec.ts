import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  it('refreshes /vault when checkSyncState detects updated vaultUpdatedAt or vaultRevision (SCRUM-193)', async () => {
    const first = dashboardService.checkSyncState();
    httpMock.expectOne(`${apiBase}/sync/state`).flush({
      totpUpdatedAt: '2026-11-15T00:00:00Z',
      vaultUpdatedAt: '2026-11-15T00:00:00Z',
      vaultRevision: 1,
      personalAppsUpdatedAt: '2026-11-15T00:00:00Z',
      enterpriseAppsUpdatedAt: null,
      connectedAppsUpdatedAt: '2026-11-15T00:00:00Z',
      accessRequestsUpdatedAt: null,
    });
    await first;

    const refreshSpy = vi.spyOn(dashboardService, 'refreshVaultFromBackend').mockResolvedValue();

    const second = dashboardService.checkSyncState();
    httpMock.expectOne(`${apiBase}/sync/state`).flush({
      totpUpdatedAt: '2026-11-15T00:00:00Z',
      vaultUpdatedAt: '2026-11-15T00:05:00Z',
      vaultRevision: 2,
      personalAppsUpdatedAt: '2026-11-15T00:00:00Z',
      enterpriseAppsUpdatedAt: null,
      connectedAppsUpdatedAt: '2026-11-15T00:00:00Z',
      accessRequestsUpdatedAt: null,
    });
    await second;

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    refreshSpy.mockRestore();
  });

  it('SCRUM-201: generates RFC 4122 UUID ids for addTotpAccount and hydrates canonical server id', () => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    dashboardService.addTotpAccount({
      issuer: 'GitHub',
      accountName: 'sync@vanguard.dev',
      secret: 'JBSWY3DPEHPK3PXP',
    });

    const req = httpMock.expectOne(`${apiBase}/totp-accounts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.id).toMatch(uuidRegex);
    expect(String(req.request.body.id)).not.toMatch(/^totp-acc-/);

    const canonicalId = '11111111-2222-4333-8444-555555555555';
    req.flush({
      account: {
        id: canonicalId,
        issuer: 'GitHub',
        accountName: 'sync@vanguard.dev',
        secret: 'JBSWY3DPEHPK3PXP',
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
      },
    });

    expect(dashboardService.totpAccounts().some((a) => a.id === canonicalId)).toBe(true);
  });

  it('SCRUM-201: addTotpAccountAsync recovers missing token from Supabase session and rolls back on DB failure', async () => {
    authService.token.set(null);
    const getSessionSpy = vi
      .spyOn(dashboardService.supabaseService.client.auth, 'getSession')
      .mockResolvedValue({
        data: { session: { access_token: 'recovered-jwt-token' } },
      } as any);

    const savePromise = dashboardService.addTotpAccountAsync({
      issuer: 'Cloudflare',
      accountName: 'sync@vanguard.dev',
      secret: 'JBSWY3DPEHPK3PXP',
    });

    await Promise.resolve();
    await Promise.resolve();

    const req = httpMock.expectOne(`${apiBase}/totp-accounts`);
    expect(authService.token()).toBe('recovered-jwt-token');
    req.flush(
      { message: 'Failed to persist 2FA authenticator account to database.' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    const result = await savePromise;
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Failed to persist 2FA authenticator account to database.');
    expect(dashboardService.totpAccounts().length).toBe(0);
    getSessionSpy.mockRestore();
  });

  it('SCRUM-203: immediately logs out when killswitch/suspension lifecycle signal targets the current user', () => {
    const logoutSpy = vi.spyOn(authService, 'logout').mockImplementation(() => {});

    // Unrelated user event must not sign out current session
    const ignored = dashboardService.handleSessionLifecycleSignal({
      userId: 'other-user-999',
      email: 'other@vanguard.dev',
      status: 'suspended',
      type: 'SUSPENDED',
    });
    expect(ignored).toBe(false);
    expect(logoutSpy).not.toHaveBeenCalled();

    // Matching userId / suspended event must immediately log out
    const terminated = dashboardService.handleSessionLifecycleSignal({
      userId: 'usr-sync-1',
      status: 'suspended',
      type: 'SUSPENDED',
    });
    expect(terminated).toBe(true);
    expect(logoutSpy).toHaveBeenCalledTimes(1);
    logoutSpy.mockRestore();
  });

  it('SCRUM-204: reactivateUser sends targetUserId and targetEmail and rolls back status on HTTP error', () => {
    const target = {
      id: 'usr-suspended-204',
      name: 'Suspended User',
      email: 'suspended@acme.com',
      department: 'Engineering',
      role: 'Directory Member' as const,
      mfaStatus: 'Email OTP Only' as const,
      accountStatus: 'Suspended' as const,
      lastLogin: 'Active',
      initials: 'SU',
    };
    dashboardService.directoryUsers.set([target]);

    dashboardService.reactivateUser(target);
    const req = httpMock.expectOne(
      (r) =>
        r.url.startsWith(`${apiBase}/apps/reactivate-member`) &&
        r.url.includes('targetUserId=usr-suspended-204') &&
        r.url.includes('targetEmail=suspended%40acme.com'),
    );
    expect(req.request.method).toBe('POST');
    req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    const rolledBack = dashboardService.directoryUsers().find((u) => u.id === target.id);
    expect(rolledBack?.accountStatus).toBe('Suspended');
  });
});
