import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import {
  NewUserGuideService,
  resolveGuideRole,
  GuideStep,
} from './new-user-guide.service';

describe('NewUserGuideService (SCRUM-194)', () => {
  let service: NewUserGuideService;
  let router: Router;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      providers: [provideRouter([])],
    }).compileComponents();

    service = TestBed.inject(NewUserGuideService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('resolves role deterministically across all 3 account types', () => {
    expect(resolveGuideRole({ isIndividual: true, isAdmin: false })).toBe('individual');
    expect(resolveGuideRole({ isIndividual: true, isAdmin: true })).toBe('individual');
    expect(resolveGuideRole({ isIndividual: false, isAdmin: true })).toBe('company-admin');
    expect(resolveGuideRole({ isIndividual: false, isAdmin: false })).toBe('employee');
  });

  it('auto-opens once per user on first dashboard login with role-tailored 3 steps', () => {
    expect(service.isOpen()).toBe(false);

    const opened = service.autoOpenIfFirstDashboardVisit('usr-admin-1', 'company-admin');
    expect(opened).toBe(true);
    expect(service.isOpen()).toBe(true);
    expect(service.context()).toBe('dashboard');
    expect(service.activeRole()).toBe('company-admin');
    expect(service.activeSteps().length).toBe(3);

    // Leaving "Don't show automatically again" checked saves per-user dismissal flag
    service.close(true);
    expect(service.isOpen()).toBe(false);
    expect(service.isDismissedForUser('usr-admin-1')).toBe(true);

    // Next dashboard load does NOT auto-open for the same user
    expect(service.autoOpenIfFirstDashboardVisit('usr-admin-1', 'company-admin')).toBe(false);
    expect(service.isOpen()).toBe(false);

    // Another user on the same browser STILL gets their own first-time guide
    expect(service.autoOpenIfFirstDashboardVisit('usr-emp-2', 'employee')).toBe(true);
    expect(service.activeRole()).toBe('employee');
  });

  it('does not persist dismissal when "Don\'t show again" is unchecked', () => {
    service.autoOpenIfFirstDashboardVisit('usr-temp-1', 'individual');
    service.setDontShowAgain(false);
    service.close(true);

    expect(service.isDismissedForUser('usr-temp-1')).toBe(false);
    // Suppressed only for the remainder of this session
    expect(service.autoOpenIfFirstDashboardVisit('usr-temp-1', 'individual')).toBe(false);
  });

  it('allows explicit reopening via header Help button even after permanent dismissal', () => {
    service.autoOpenIfFirstDashboardVisit('usr-1', 'employee');
    service.close(true);
    expect(service.isDismissedForUser('usr-1')).toBe(true);

    service.openFromDashboard('usr-1', 'employee');
    expect(service.isOpen()).toBe(true);
    expect(service.context()).toBe('dashboard');
    expect(service.activeRole()).toBe('employee');
  });

  it('executes step shortcut by switching dashboard tab when opened inside dashboard', () => {
    const tabSpy = vi.fn();
    service.registerDashboardNavigator(tabSpy);
    service.openFromDashboard('usr-1', 'company-admin');

    const directoryStep: GuideStep = service.activeSteps()[1];
    expect(directoryStep.targetTab).toBe('directory');

    service.executeStepAction(directoryStep);
    expect(tabSpy).toHaveBeenCalledWith('directory');
    expect(service.isOpen()).toBe(false);
  });

  it('executes step shortcut by navigating to register/login when opened from landing', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    service.openFromLanding('company-admin');
    expect(service.isOpen()).toBe(true);
    expect(service.context()).toBe('landing');

    const step = service.activeSteps()[0];
    service.executeStepAction(step);

    expect(navSpy).toHaveBeenCalledWith(['/register']);
    expect(service.isOpen()).toBe(false);
  });

  it('handles SSR safely without throwing when PLATFORM_ID is server', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    }).compileComponents();

    const ssrService = TestBed.inject(NewUserGuideService);
    expect(() => ssrService.isDismissedForUser('usr-ssr')).not.toThrow();
    expect(ssrService.isDismissedForUser('usr-ssr')).toBe(false);
    expect(() => ssrService.autoOpenIfFirstDashboardVisit('usr-ssr', 'individual')).not.toThrow();
  });
});
