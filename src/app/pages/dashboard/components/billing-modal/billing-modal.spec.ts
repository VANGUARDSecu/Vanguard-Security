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

  it('shows $0 Restore button after downgrading within an active paid cycle and restores without PayMongo charge', () => {
    authService.currentUser.set({
      id: 'usr-indiv-restore',
      email: 'registered@altmail.test',
      firstName: 'Reg',
      lastName: 'User',
      role: 'user',
      accountType: 'individual',
    });

    dashboardService.subscriptionPlanId.set('personal_pro');
    dashboardService.subscriptionStatus.set('active');
    dashboardService.currentPeriodEnd.set(
      new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString(),
    );
    dashboardService.cancelSubscriptionPlan();
    dashboardService.openPaywallModal();
    fixture.detectChanges();

    expect(dashboardService.subscriptionPlanId()).toBe('free');
    expect(dashboardService.paidCredit()?.planId).toBe('personal_pro');

    const textAfterDowngrade = fixture.nativeElement.textContent as string;
    expect(textAfterDowngrade).toContain('Restore Personal Pro ($0');

    component.restorePlan('personal_pro');
    fixture.detectChanges();

    expect(dashboardService.subscriptionPlanId()).toBe('personal_pro');
    expect(dashboardService.isFreeTier()).toBe(false);
  });

  it('displays official Vanguard receipt sent to registered account email separately from PayMongo checkout email and expands details', () => {
    authService.currentUser.set({
      id: 'usr-indiv-rcpt',
      email: 'account-login@vanguard.test',
      firstName: 'Re',
      lastName: 'Ceipt',
      role: 'user',
      accountType: 'individual',
    });

    dashboardService.billingInvoices.set([
      {
        id: 'inv_101',
        receiptNumber: 'VG-RCPT-20261115-4821',
        date: '2026-11-15',
        planName: 'Personal Pro',
        amountUsd: 5,
        amountPhp: 290,
        paymentMethod: 'PayMongo Test Card',
        status: 'paid',
        transactionId: 'cs_pm_4821',
        buyerEmail: 'account-login@vanguard.test',
        receiptSentTo: 'account-login@vanguard.test',
        gatewayPayerEmail: 'main-gmail@gmail.com',
        receiptDeliveryStatus: 'sent',
      },
    ]);
    dashboardService.openPaywallModal();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Official Vanguard Purchase Receipts');
    expect(text).toContain('VG-RCPT-20261115-4821');
    expect(text).toContain('account-login@vanguard.test');
    expect(text).toContain('PayMongo Checkout Email: main-gmail@gmail.com');

    component.toggleReceiptView('inv_101');
    fixture.detectChanges();
    const drawer = fixture.nativeElement.querySelector('[data-testid="receipt-detail-drawer"]');
    expect(drawer).toBeTruthy();
    expect(drawer?.textContent).toContain('VANGUARD OFFICIAL TAX & SUBSCRIPTION RECEIPT');
  });
});
