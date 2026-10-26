import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { UserAuthenticator } from './user-authenticator';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../../../services/auth.service';

describe('UserAuthenticator Component (SCRUM-50 2FA Rolling Code Authenticator)', () => {
  let component: UserAuthenticator;
  let fixture: ComponentFixture<UserAuthenticator>;
  let dashboardService: DashboardService;
  let authService: AuthService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [UserAuthenticator],
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
    fixture = TestBed.createComponent(UserAuthenticator);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should create the UserAuthenticator component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with zero hardcoded 2FA accounts', () => {
    expect(component.activeTotpAccounts().length).toBe(0);
  });

  it('should generate valid 6-digit rolling codes when 2FA account is added', async () => {
    dashboardService.addTotpAccount({
      issuer: 'Google Cloud Platform',
      accountName: 'admin@vanguard.dev',
      secret: 'JBSWY3DPEHPK3PXP',
    });
    // SCRUM-116: real RFC 6238 codes are computed asynchronously (HMAC-SHA1).
    await dashboardService.refreshTotpCodes();
    fixture.detectChanges();

    const active = component.activeTotpAccounts();
    expect(active.length).toBe(1);

    for (const acc of active) {
      expect(acc.currentCode).toBeDefined();
      expect(acc.currentCode?.length).toBe(6);
      expect(/^\d{6}$/.test(acc.currentCode!)).toBe(true);
    }
  });

  it('should format 6-digit code with space in between', () => {
    expect(component.formatCode('123456')).toBe('123 456');
    expect(component.formatCode(undefined)).toBe('------');
  });

  it('should add a new 2FA authenticator account', () => {
    component.openAddModal();
    expect(component.showAddModal()).toBe(true);

    component.formIssuer = 'ProtonMail';
    component.formAccountName = 'alex@proton.me';
    component.formSecret = 'JBSWY3DPEHPK3PXP';

    component.saveAccount();
    expect(component.showAddModal()).toBe(false);

    const added = component.activeTotpAccounts().find((a) => a.issuer === 'ProtonMail');
    expect(added).toBeDefined();
    expect(added?.currentCode?.length).toBe(6);
  });

  it('should prevent saving account when issuer or secret is missing', () => {
    component.openAddModal();
    component.formIssuer = '';
    component.formSecret = '';
    component.saveAccount();

    expect(component.formErrorMessage()).toBeTruthy();
    expect(component.showAddModal()).toBe(true);
  });
});
