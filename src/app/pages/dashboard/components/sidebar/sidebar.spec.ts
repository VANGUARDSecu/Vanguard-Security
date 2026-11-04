import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardSidebar } from './sidebar';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../../../services/auth.service';

describe('DashboardSidebar Component (SCRUM-54 Individual Security Suite)', () => {
  let component: DashboardSidebar;
  let fixture: ComponentFixture<DashboardSidebar>;
  let dashboardService: DashboardService;
  let authService: AuthService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [DashboardSidebar],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    authService.currentUser.set({
      id: 'usr-ind-1',
      email: 'individual@vanguard.security',
      firstName: 'Jordan',
      lastName: 'Vance',
      role: 'user',
      accountType: 'individual',
    });

    dashboardService = TestBed.inject(DashboardService);
    fixture = TestBed.createComponent(DashboardSidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should create the dashboard sidebar component', () => {
    expect(component).toBeTruthy();
  });

  it('should render PERSONAL SECURITY SUITE for individual accounts', () => {
    expect(component.isIndividual()).toBe(true);
    expect(component.isPersonalWorkspace()).toBe(true);

    const sectionLabel = fixture.nativeElement.querySelector('.sidebar-section-label');
    expect(sectionLabel.textContent).toContain('PERSONAL SECURITY SUITE');
  });

  it('should render Personal Vault and personal security tools for individual accounts', () => {
    const navButtons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.nav-link-btn'));
    const buttonTexts = navButtons.map((btn) => btn.textContent?.trim() || '');

    // Individual users must have access to full personal cybersecurity tools
    expect(buttonTexts.some((t) => t.includes('Personal Vault'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('My Applications'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('2FA Authenticator'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Security & MFA'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Mobile & Devices'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('SSH Keys'))).toBe(true);

    // Corporate governance tabs must NOT be present
    expect(buttonTexts.some((t) => t.includes('Directory Users'))).toBe(false);
    expect(buttonTexts.some((t) => t.includes('Cloud LDAP'))).toBe(false);
    expect(buttonTexts.some((t) => t.includes('Cloud RADIUS'))).toBe(false);
  });

  it('should display Personal Security Vault in footer status box for individuals', () => {
    const statusTitle = fixture.nativeElement.querySelector('.status-title');
    const statusSub = fixture.nativeElement.querySelector('.status-sub');

    expect(statusTitle.textContent).toContain('Personal Security Vault');
    expect(statusSub.textContent).toContain('End-to-End Encrypted');
  });

  it('should render genuine production tabs and hide obsolete deferred tabs for company admin (SCRUM-151)', () => {
    authService.currentUser.set({
      id: 'usr-admin-corp',
      email: 'admin@sentinel.corp',
      firstName: 'Sarah',
      lastName: 'Connor',
      role: 'admin',
      accountType: 'company',
      companyName: 'Sentinel Defense',
    });
    dashboardService.initDashboardForCurrentUser();
    fixture.detectChanges();

    const navButtons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.nav-link-btn'));
    const buttonTexts = navButtons.map((btn) => btn.textContent?.trim() || '');

    // Genuine production tabs MUST be present
    expect(buttonTexts.some((t) => t.includes('Overview'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Directory Users'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('OIDC Applications & SSO'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Access Requests'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Security Audit Log'))).toBe(true);
    expect(buttonTexts.some((t) => t.includes('Enterprise Settings'))).toBe(true);

    // Obsolete and deferred tabs MUST NOT be present
    expect(buttonTexts.some((t) => t.includes('Cloud LDAP'))).toBe(false);
    expect(buttonTexts.some((t) => t.includes('Cloud RADIUS'))).toBe(false);
    expect(buttonTexts.some((t) => t.includes('Webhooks'))).toBe(false);
    expect(buttonTexts.some((t) => t.includes('Device Fleet'))).toBe(false);
    expect(buttonTexts.some((t) => t.includes('Personal Vault'))).toBe(false);
  });
});
