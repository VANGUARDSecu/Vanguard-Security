import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BillingModal } from './billing-modal';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../../../services/auth.service';

describe('BillingModal Component (SCRUM-184 Isolation)', () => {
  let component: BillingModal;
  let fixture: ComponentFixture<BillingModal>;
  let dashboardService: DashboardService;
  let authService: AuthService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [BillingModal],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    dashboardService = TestBed.inject(DashboardService);
    fixture = TestBed.createComponent(BillingModal);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('shows only Individual plans when logged in as an Individual user', () => {
    authService.currentUser.set({
      id: 'usr-indiv-1',
      email: 'alex@personal.me',
      firstName: 'Alex',
      lastName: 'Mercer',
      role: 'user',
      accountType: 'individual',
    });
    dashboardService.openPaywallModal();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Personal Pro');
    expect(text).not.toContain('Business Pro');
    expect(text).not.toContain('Enterprise Zero-Trust');
  });

  it('shows only Company plans when logged in as a Company Admin', () => {
    authService.currentUser.set({
      id: 'usr-admin-1',
      email: 'admin@acme.com',
      firstName: 'Ada',
      lastName: 'Admin',
      role: 'admin',
      accountType: 'company',
      companyName: 'Acme Corp',
    });
    dashboardService.openPaywallModal();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Business Pro');
    expect(text).toContain('Enterprise Zero-Trust');
    expect(text).not.toContain('Personal Pro');
  });

  it('shows read-only Managed by Company Admin notice with no subscribe buttons for Tenant Employees', () => {
    authService.currentUser.set({
      id: 'usr-emp-1',
      email: 'employee@acme.com',
      firstName: 'Bob',
      lastName: 'Member',
      role: 'user',
      accountType: 'company',
      companyName: 'Acme Corp',
    });
    dashboardService.openPaywallModal();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(component.isTenantMember()).toBe(true);
    expect(component.canManageBilling()).toBe(false);
    expect(text).toContain('Managed by Company Administrator');
    expect(text).not.toContain('Subscribe via PayMongo');
    expect(text).not.toContain('Personal Pro');
  });
});
