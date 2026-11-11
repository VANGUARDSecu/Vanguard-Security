import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminSettings } from './admin-settings';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../../../services/auth.service';
import { vi } from 'vitest';

describe('AdminSettings Component (SCRUM-28 Multi-Tenant & Branding Studio)', () => {
  let component: AdminSettings;
  let fixture: ComponentFixture<AdminSettings>;
  let dashboardService: DashboardService;
  let authService: AuthService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [AdminSettings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    // Dynamically set authenticated user without hardcoded mock company names
    authService.currentUser.set({
      id: 'test-admin-1',
      email: 'admin@acme-defense.io',
      firstName: 'Alex',
      lastName: 'Vance',
      role: 'admin',
      companyName: 'Acme Defense Systems',
    });

    dashboardService = TestBed.inject(DashboardService);
    fixture = TestBed.createComponent(AdminSettings);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should create the admin settings component', () => {
    expect(component).toBeTruthy();
  });

  it('should dynamically initialize tenant organizations derived from the active user profile', () => {
    const orgs = component.organizations();
    expect(orgs.length).toBeGreaterThanOrEqual(1);
    const activeOrg = component.activeOrganization();
    expect(activeOrg).toBeDefined();
    // Dynamic company name from user profile
    expect(activeOrg.name).toBe('Acme Defense Systems');
    expect(activeOrg.slug).toBe('acme-defense-systems');
    expect(activeOrg.primaryContactEmail).toBe('admin@acme-defense.io');
  });

  it('should switch between subtabs: governance, branding, and tenants', () => {
    expect(component.settingsSubTab()).toBe('governance');

    component.setSubTab('branding');
    expect(component.settingsSubTab()).toBe('branding');
    expect(component.brandCompanyName()).toBe('Acme Defense Systems');

    component.setSubTab('tenants');
    expect(component.settingsSubTab()).toBe('tenants');
  });

  describe('Multi-Tenant Organization Management', () => {
    it('should open, validate, and create a new tenant organization', () => {
      component.openCreateOrg();
      expect(component.showCreateOrgModal()).toBe(true);

      // Attempt creation with empty name triggers validation error
      component.newOrgName.set('');
      component.createOrg();
      expect(component.newOrgError()).toBeTruthy();

      // Valid new tenant creation
      component.newOrgName.set('Cyber Ops Division');
      component.newOrgTier.set('Enterprise');
      component.newOrgDomain.set('cyberops.acme.io');
      component.createOrg();

      expect(component.newOrgError()).toBeNull();
      expect(component.showCreateOrgModal()).toBe(false);

      const created = component.organizations().find(o => o.name === 'Cyber Ops Division');
      expect(created).toBeDefined();
      expect(created?.tier).toBe('Enterprise');
      expect(created?.domain).toBe('cyberops.acme.io');
      expect(component.activeOrganizationId()).toBe(created?.id);
    });

    it('should close create organization modal on escape key', () => {
      component.openCreateOrg();
      expect(component.showCreateOrgModal()).toBe(true);

      component.onEscape();
      expect(component.showCreateOrgModal()).toBe(false);
    });

    it('should switch between tenant organizations and synchronize state', () => {
      // Create a secondary tenant
      component.newOrgName.set('Beta Subsidiary');
      component.newOrgTier.set('Business');
      component.createOrg();

      const betaOrg = component.organizations().find(o => o.name === 'Beta Subsidiary');
      expect(betaOrg).toBeDefined();
      expect(component.activeOrganizationId()).toBe(betaOrg!.id);

      // Switch back to root organization
      const rootOrg = component.organizations().find(o => o.name === 'Acme Defense Systems');
      component.switchOrg(rootOrg!.id);

      expect(component.activeOrganizationId()).toBe(rootOrg!.id);
      expect(component.activeOrganization().name).toBe('Acme Defense Systems');
      expect(component.brandCompanyName()).toBe('Acme Defense Systems');
    });

    it('should delete a tenant organization with confirmation', () => {
      // Create a secondary tenant to delete
      component.newOrgName.set('Temporary Org');
      component.createOrg();

      const tempOrg = component.organizations().find(o => o.name === 'Temporary Org');
      expect(tempOrg).toBeDefined();

      vi.spyOn(window, 'confirm').mockReturnValue(true);
      component.deleteOrg(tempOrg!.id);

      const exists = component.organizations().some(o => o.id === tempOrg!.id);
      expect(exists).toBe(false);
    });
  });

  describe('White-Label Branding Studio', () => {
    beforeEach(() => {
      component.setSubTab('branding');
    });

    it('should update primary accent color via preset selection and apply CSS variable', () => {
      const spyApply = vi.spyOn(dashboardService, 'applyBrandAccent');

      component.selectPresetColor('#10b981'); // Matrix Emerald
      expect(component.brandAccentColor()).toBe('#10b981');
      expect(spyApply).toHaveBeenCalledWith('#10b981');
    });

    it('should update accent color via custom color picker', () => {
      const spyApply = vi.spyOn(dashboardService, 'applyBrandAccent');

      component.onCustomColorChange('#a855f7'); // Neon Purple
      expect(component.brandAccentColor()).toBe('#a855f7');
      expect(spyApply).toHaveBeenCalledWith('#a855f7');
    });

    it('should validate logo file uploads and reject unsupported formats or oversized files', () => {
      // Invalid MIME type
      const invalidEvent = {
        target: {
          files: [new File(['dummy'], 'doc.pdf', { type: 'application/pdf' })],
        },
      } as unknown as Event;

      component.onLogoFileSelected(invalidEvent);
      expect(component.logoUploadError()).toContain('Only PNG, SVG, WEBP, or JPEG');

      // Oversized file > 2MB
      const oversizedBlob = new Blob([new Uint8Array(2.5 * 1024 * 1024)]);
      const oversizedFile = new File([oversizedBlob], 'large-logo.png', { type: 'image/png' });
      const oversizedEvent = {
        target: {
          files: [oversizedFile],
        },
      } as unknown as Event;

      component.onLogoFileSelected(oversizedEvent);
      expect(component.logoUploadError()).toContain('less than 2 MB');
    });

    it('should remove uploaded logo', () => {
      component.brandLogoUrl.set('data:image/png;base64,sample');
      component.removeLogo();
      expect(component.brandLogoUrl()).toBe('');
    });

    it('should save white-label branding configuration reactively', () => {
      component.brandCompanyName.set('Apex Cybersec');
      component.brandAccentColor.set('#06b6d4');
      component.brandCustomDomain.set('auth.apexcyber.com');
      component.brandSupportEmail.set('support@apexcyber.com');
      component.brandGreeting.set('Welcome to Apex Zero-Trust Portal');
      component.brandButtonText.set('Enter Workspace');

      component.saveBranding();

      const saved = dashboardService.tenantBranding();
      expect(saved.companyName).toBe('Apex Cybersec');
      expect(saved.primaryAccentColor).toBe('#06b6d4');
      expect(saved.ssoCustomDomain).toBe('auth.apexcyber.com');
      expect(saved.supportEmail).toBe('support@apexcyber.com');
      expect(saved.emailCustomGreeting).toBe('Welcome to Apex Zero-Trust Portal');
      expect(saved.emailButtonText).toBe('Enter Workspace');
      expect(dashboardService.brandingSavedNotice()).toBe(true);
    });

    it('should reset branding to defaults upon user confirmation', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      component.brandAccentColor.set('#f59e0b');
      component.resetBranding();

      expect(component.brandAccentColor()).toBe('#3b82f6');
      expect(dashboardService.tenantBranding().primaryAccentColor).toBe('#3b82f6');
    });

    it('should trigger simulated DNS CNAME verification', async () => {
      vi.useFakeTimers();
      try {
        component.verifyDns();
        expect(dashboardService.domainVerificationStatus()).toBe('checking');

        await vi.advanceTimersByTimeAsync(500);
        expect(dashboardService.domainVerificationStatus()).toBe('verified');
        expect(dashboardService.tenantBranding().ssoDomainVerified).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Zero-Trust Governance Actions', () => {
    it('should delegate governance toggle actions to dashboard service', () => {
      const mfaSpy = vi.spyOn(dashboardService, 'toggleEnforceMfa');
      const ipSpy = vi.spyOn(dashboardService, 'toggleBlockHighRiskIps');
      const killswitchSpy = vi.spyOn(dashboardService, 'openGlobalKillswitchModal');

      component.toggleEnforceMfa();
      expect(mfaSpy).toHaveBeenCalled();

      component.toggleBlockHighRiskIps();
      expect(ipSpy).toHaveBeenCalled();

      component.openGlobalKillswitchModal();
      expect(killswitchSpy).toHaveBeenCalled();
    });
  });
});
