import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardHeader } from './header';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../../../services/auth.service';
import { vi } from 'vitest';

describe('DashboardHeader Component (SCRUM-28 Header Org Switcher)', () => {
  let component: DashboardHeader;
  let fixture: ComponentFixture<DashboardHeader>;
  let dashboardService: DashboardService;
  let authService: AuthService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [DashboardHeader],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    authService.currentUser.set({
      id: 'usr-corp-lead',
      email: 'lead@sentinel-defense.com',
      firstName: 'Sarah',
      lastName: 'Connor',
      role: 'admin',
      companyName: 'Sentinel Defense Group',
    });

    dashboardService = TestBed.inject(DashboardService);
    fixture = TestBed.createComponent(DashboardHeader);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should create the dashboard header component', () => {
    expect(component).toBeTruthy();
  });

  it('should display active organization from user profile dynamically', () => {
    const active = component.activeOrganization();
    expect(active.name).toBe('Sentinel Defense Group');
    expect(component.showOrgDropdown()).toBe(false);
  });

  it('should toggle organization switcher dropdown and close on escape key', () => {
    component.toggleOrgDropdown();
    expect(component.showOrgDropdown()).toBe(true);

    component.onEscape();
    expect(component.showOrgDropdown()).toBe(false);
  });

  it('should close dropdown when clicking outside', () => {
    component.toggleOrgDropdown();
    expect(component.showOrgDropdown()).toBe(true);

    // Click outside
    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);
    const clickEvt = new MouseEvent('click', { bubbles: true });
    outsideEl.dispatchEvent(clickEvt);

    component.onDocumentClick(clickEvt);
    expect(component.showOrgDropdown()).toBe(false);
    outsideEl.remove();
  });

  it('should switch organization via dropdown and close dropdown', () => {
    const switchSpy = vi.spyOn(dashboardService, 'switchOrganization');
    component.toggleOrgDropdown();

    component.switchOrg('org_root');
    expect(switchSpy).toHaveBeenCalledWith('org_root');
    expect(component.showOrgDropdown()).toBe(false);
  });

  it('should trigger create organization modal from dropdown', () => {
    const openSpy = vi.spyOn(dashboardService, 'openCreateOrgModal');
    component.toggleOrgDropdown();

    component.openCreateOrgModal();
    expect(openSpy).toHaveBeenCalled();
    expect(component.showOrgDropdown()).toBe(false);
  });

  it('should route to branding studio in settings from dropdown', () => {
    const tabSpy = vi.spyOn(dashboardService, 'setActiveTab');
    component.toggleOrgDropdown();

    component.goToBrandingStudio();
    expect(tabSpy).toHaveBeenCalledWith('settings');
    expect(component.showOrgDropdown()).toBe(false);
  });

  it('should display Individual role tag and hide organization switcher for individual accounts', () => {
    authService.currentUser.set({
      id: 'usr-individual-1',
      email: 'alex@personal.vault',
      firstName: 'Alex',
      lastName: 'Mercer',
      role: 'user',
      accountType: 'individual',
    });
    fixture.detectChanges();

    expect(component.isIndividual()).toBe(true);
    expect(component.userRoleLabel()).toBe('Individual');

    // Workspace switcher and upgrade button should not be rendered
    const orgSwitcher = fixture.nativeElement.querySelector('.org-switcher-container');
    expect(orgSwitcher).toBeNull();

    const upgradeBtn = fixture.nativeElement.querySelector('.individual-upgrade-wrapper');
    expect(upgradeBtn).toBeNull();
  });

  it('should render Admin Console scope badge and enterprise switcher for Company Admin (SCRUM-150)', () => {
    authService.currentUser.set({
      id: 'usr-company-admin',
      email: 'admin@acmecorp.com',
      firstName: 'Bruce',
      lastName: 'Wayne',
      role: 'admin',
      accountType: 'company',
      companyName: 'Wayne Enterprises',
    });
    fixture.detectChanges();

    const companyBadge = fixture.nativeElement.querySelector('.badge-company');
    expect(companyBadge).toBeTruthy();
    expect(companyBadge.textContent).toContain('Admin Console');

    // Individual & Tenant badges and indicators must NOT be present
    expect(fixture.nativeElement.querySelector('.badge-individual')).toBeNull();
    expect(fixture.nativeElement.querySelector('.badge-tenant')).toBeNull();
    expect(fixture.nativeElement.querySelector('.individual-vault-indicator')).toBeNull();
    expect(fixture.nativeElement.querySelector('.tenant-org-indicator')).toBeNull();

    // Enterprise Org Switcher must be present for company admin
    expect(fixture.nativeElement.querySelector('.org-switcher-container')).toBeTruthy();
  });

  it('should render Personal Vault scope badge and indicator for Individual Account (SCRUM-150)', () => {
    authService.currentUser.set({
      id: 'usr-indiv-1',
      email: 'clark@kent.io',
      firstName: 'Clark',
      lastName: 'Kent',
      role: 'user',
      accountType: 'individual',
    });
    fixture.detectChanges();

    const indivBadge = fixture.nativeElement.querySelector('.badge-individual');
    expect(indivBadge).toBeTruthy();
    expect(indivBadge.textContent).toContain('Personal Vault');

    const indivIndicator = fixture.nativeElement.querySelector('.individual-vault-indicator');
    expect(indivIndicator).toBeTruthy();
    expect(indivIndicator.textContent).toContain('Personal Vault');

    // Company & Tenant badges must NOT be present
    expect(fixture.nativeElement.querySelector('.badge-company')).toBeNull();
    expect(fixture.nativeElement.querySelector('.badge-tenant')).toBeNull();
    expect(fixture.nativeElement.querySelector('.tenant-org-indicator')).toBeNull();
    expect(fixture.nativeElement.querySelector('.org-switcher-container')).toBeNull();
  });

  it('should render User Portal scope badge and corporate directory indicator for Tenant Account (SCRUM-150)', () => {
    authService.currentUser.set({
      id: 'usr-tenant-1',
      email: 'barry@waynecorp.com',
      firstName: 'Barry',
      lastName: 'Allen',
      role: 'user',
      accountType: 'company',
      companyName: 'Wayne Enterprises',
    });
    fixture.detectChanges();

    const tenantBadge = fixture.nativeElement.querySelector('.badge-tenant');
    expect(tenantBadge).toBeTruthy();
    expect(tenantBadge.textContent).toContain('User Portal');

    const tenantIndicator = fixture.nativeElement.querySelector('.tenant-org-indicator');
    expect(tenantIndicator).toBeTruthy();
    expect(tenantIndicator.textContent).toContain('Corporate Directory');

    // Admin & Individual badges must NOT be present
    expect(fixture.nativeElement.querySelector('.badge-company')).toBeNull();
    expect(fixture.nativeElement.querySelector('.badge-individual')).toBeNull();
    expect(fixture.nativeElement.querySelector('.individual-vault-indicator')).toBeNull();
    expect(fixture.nativeElement.querySelector('.org-switcher-container')).toBeNull();
  });
});
