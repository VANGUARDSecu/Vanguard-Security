import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { UserPersonalVault } from './user-personal-vault';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../../../services/auth.service';

describe('UserPersonalVault Component (SCRUM-50 Personal Credential Manager)', () => {
  let component: UserPersonalVault;
  let fixture: ComponentFixture<UserPersonalVault>;
  let dashboardService: DashboardService;
  let authService: AuthService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [UserPersonalVault],
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
    fixture = TestBed.createComponent(UserPersonalVault);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('should create the UserPersonalVault component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with zero hardcoded credentials in personal vault', () => {
    expect(component.vaultItems().length).toBe(0);
    expect(component.filteredVaultItems().length).toBe(0);
  });

  it('should filter items by category and search query after items are added', () => {
    dashboardService.addVaultItem({
      title: 'GitHub Developer Token',
      category: 'Login',
      username: 'dev-secops',
      password: 'ghp_VanguardKey9928#SecureToken',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      url: 'https://github.com',
      notes: 'Personal PAT token',
      favorite: true,
    });
    dashboardService.addVaultItem({
      title: 'Master Recovery Key',
      category: 'Secure Note',
      username: '',
      password: '',
      notes: 'Recovery seed phrase',
      favorite: false,
    });
    fixture.detectChanges();

    component.setCategory('Login');
    fixture.detectChanges();
    for (const item of component.filteredVaultItems()) {
      expect(item.category).toBe('Login');
    }

    component.setCategory('all');
    component.setSearch('GitHub');
    fixture.detectChanges();
    expect(component.filteredVaultItems().some((i) => i.title.includes('GitHub'))).toBe(true);
  });

  it('should toggle password visibility for a specific credential', () => {
    dashboardService.addVaultItem({
      title: 'Test Service',
      category: 'Login',
      username: 'user@test.com',
      password: 'Password123!',
    });
    fixture.detectChanges();

    const item = component.vaultItems()[0];
    expect(component.isPasswordRevealed(item.id)).toBe(false);

    component.togglePasswordVisibility(item.id);
    expect(component.isPasswordRevealed(item.id)).toBe(true);

    component.togglePasswordVisibility(item.id);
    expect(component.isPasswordRevealed(item.id)).toBe(false);
  });

  it('should toggle favorite status of a credential', () => {
    dashboardService.addVaultItem({
      title: 'Fav Service',
      category: 'Login',
      username: 'user@fav.com',
      password: 'FavPassword123!',
      favorite: false,
    });
    fixture.detectChanges();

    const item = component.vaultItems()[0];
    const initialFavorite = !!item.favorite;

    component.toggleFavorite(item.id);
    const updated = component.vaultItems().find((i) => i.id === item.id);
    expect(updated?.favorite).toBe(!initialFavorite);
  });

  it('should add a new credential via modal', () => {
    component.openAddModal();
    expect(component.showAddModal()).toBe(true);

    component.formTitle = 'Cloudflare Zero-Trust API';
    component.formCategory = 'Login';
    component.formUsername = 'ops@cloudflare.com';
    component.formPassword = 'CF_Secret_Key_99182#';
    component.formFavorite = true;

    component.saveCredential();
    expect(component.showAddModal()).toBe(false);

    const added = component.vaultItems().find((i) => i.title === 'Cloudflare Zero-Trust API');
    expect(added).toBeDefined();
    expect(added?.username).toBe('ops@cloudflare.com');
    expect(added?.favorite).toBe(true);
  });

  it('should edit an existing credential', () => {
    dashboardService.addVaultItem({
      title: 'Original Title',
      category: 'Login',
      username: 'edit@test.com',
      password: 'OriginalPassword123!',
    });
    fixture.detectChanges();

    const target = component.vaultItems()[0];
    component.openEditModal(target);
    expect(component.showAddModal()).toBe(true);
    expect(component.formTitle).toBe(target.title);

    component.formTitle = 'Updated Credential Title';
    component.saveCredential();

    const updated = component.vaultItems().find((i) => i.id === target.id);
    expect(updated?.title).toBe('Updated Credential Title');
  });

  it('should generate a strong password with custom length and entropy', () => {
    component.openGeneratorModal();
    expect(component.showGeneratorModal()).toBe(true);

    component.genLength = 24;
    component.regeneratePassword();
    const pw = component.generatedPassword();

    expect(pw.length).toBe(24);
    const strength = component.generatedPasswordStrength();
    expect(strength.score).toBeGreaterThanOrEqual(70);
  });

  it('SCRUM-114: unlock with the login password unlocks the vault and loads items', async () => {
    const httpMock = TestBed.inject(HttpTestingController);
    expect(component.isUnlocked()).toBe(false);
    component.unlockPassword = 'LoginPass#1';
    const p = component.unlock();
    // The unlock first pulls the latest envelope from the backend; respond with none.
    const req = httpMock.expectOne((r) => r.url.endsWith('/vault'));
    req.flush({ envelope: null });
    await p;
    expect(component.isUnlocked()).toBe(true);
    expect(component.unlockError()).toBeNull();
  });

  it('SCRUM-114: unlock requires a password', async () => {
    component.unlockPassword = '';
    await component.unlock();
    expect(component.isUnlocked()).toBe(false);
    expect(component.unlockError()).toContain('Vanguard password');
  });
});
