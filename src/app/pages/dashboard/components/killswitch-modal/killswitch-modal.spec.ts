import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { KillswitchModal } from './killswitch-modal';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../../../services/auth.service';
import { vi } from 'vitest';

describe('KillswitchModal Component (SCRUM-191)', () => {
  let component: KillswitchModal;
  let fixture: ComponentFixture<KillswitchModal>;
  let dashboardService: DashboardService;
  let authService: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [KillswitchModal],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    authService.currentUser.set({
      id: 'admin-1',
      email: 'admin@acme.io',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'admin',
      companyName: 'Acme Corp',
    });

    dashboardService = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);

    dashboardService.directoryUsers.set([
      {
        id: 'admin-1',
        name: 'Ada Lovelace',
        email: 'admin@acme.io',
        department: 'Security',
        role: 'Admin',
        mfaStatus: 'Enrolled (TOTP)',
        accountStatus: 'Active',
        lastLogin: 'Now',
        initials: 'AL',
      },
      {
        id: 'emp-1',
        name: 'Grace Hopper',
        email: 'grace@acme.io',
        department: 'Engineering',
        role: 'Member',
        mfaStatus: 'Email OTP Only',
        accountStatus: 'Active',
        lastLogin: '1h ago',
        initials: 'GH',
      },
    ]);

    fixture = TestBed.createComponent(KillswitchModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    TestBed.resetTestingModule();
  });

  it('should exclude acting admin from nonAdminMemberCount and open regardless of activeTab', () => {
    dashboardService.setActiveTab('settings');
    dashboardService.openGlobalKillswitchModal();
    fixture.detectChanges();

    expect(component.showGlobalKillswitchModal()).toBe(true);
    expect(component.nonAdminMemberCount()).toBe(1);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.modal-backdrop')).toBeTruthy();
    expect(compiled.textContent).toContain('Also sign out my current administrator session');
  });

  it('should execute killswitch with signOutAdmin=false by default and compute residualMinutes', () => {
    dashboardService.openGlobalKillswitchModal();
    const revokeSpy = vi.spyOn(dashboardService, 'revokeAllSessions');

    component.execute();
    const req = httpMock.expectOne((r) => r.url.endsWith('/apps/killswitch') && r.method === 'POST');
    req.flush({
      tenantId: 't-1',
      totalMembers: 1,
      revoked: 1,
      failed: 0,
      maxResidualAccessSeconds: 300,
      notCovered: ['In-flight JWT tokens until exp'],
    });
    fixture.detectChanges();

    expect(component.residualMinutes()).toBe(5);
    expect(dashboardService.globalKillswitchSuccess()).toBe(true);
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it('should trigger self session revocation when signOutCurrentAdmin is checked', () => {
    dashboardService.openGlobalKillswitchModal();
    component.signOutCurrentAdmin.set(true);
    const revokeSpy = vi.spyOn(dashboardService, 'revokeAllSessions').mockImplementation(() => {});

    component.execute();
    const req = httpMock.expectOne((r) => r.url.endsWith('/apps/killswitch') && r.method === 'POST');
    req.flush({
      tenantId: 't-1',
      totalMembers: 1,
      revoked: 1,
      failed: 0,
      maxResidualAccessSeconds: 180,
      notCovered: [],
    });

    expect(revokeSpy).toHaveBeenCalledWith(true);
    expect(dashboardService.showGlobalKillswitchModal()).toBe(false);
  });

  it('should close and reset signOutCurrentAdmin on Escape when not pending', () => {
    dashboardService.openGlobalKillswitchModal();
    component.signOutCurrentAdmin.set(true);
    component.onEscape();

    expect(dashboardService.showGlobalKillswitchModal()).toBe(false);
    expect(component.signOutCurrentAdmin()).toBe(false);
  });
});
