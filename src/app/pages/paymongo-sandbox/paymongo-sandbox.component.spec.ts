import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { PaymongoSandboxComponent } from './paymongo-sandbox.component';
import { DashboardService } from '../dashboard/services/dashboard.service';
import { AuthService } from '../../services/auth.service';

describe('PaymongoSandboxComponent (SCRUM-184 Checkout Simulation)', () => {
  let component: PaymongoSandboxComponent;
  let fixture: ComponentFixture<PaymongoSandboxComponent>;
  let dashboardService: DashboardService;
  let authService: AuthService;
  let router: Router;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [PaymongoSandboxComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: {
                session: 'pm_test_session_123',
                plan: 'personal_pro',
                accountType: 'individual',
                amountPhp: '290',
                amountUsd: '5',
              },
            },
          },
        },
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
    });

    dashboardService = TestBed.inject(DashboardService);
    router = TestBed.inject(Router);
    localStorage.setItem(
      'vanguard_pending_paymongo_session',
      JSON.stringify({
        sessionId: 'pm_test_session_123',
        planId: 'personal_pro',
        planName: 'Personal Pro',
        accountType: 'individual',
        amountUsd: 5,
        amountPhp: 290,
        email: 'alex@personal.me',
        mode: 'local_sandbox',
      }),
    );

    fixture = TestBed.createComponent(PaymongoSandboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('hydrates PayMongo checkout summary from route query params', () => {
    expect(component.sessionId()).toBe('pm_test_session_123');
    expect(component.planName()).toBe('Personal Pro');
    expect(component.amountPhp()).toBe(290);
  });

  it('keeps plan locked on Free tier when simulated payment fails', () => {
    component.simulateFailedPayment();
    expect(dashboardService.subscriptionPlanId()).toBe('free');
    expect(component.errorMessage()).toContain('declined');
  });

  it('unlocks subscription and redirects back to /dashboard on authorized PayMongo test payment', () => {
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.authorizeTestPayment();

    expect(dashboardService.subscriptionPlanId()).toBe('personal_pro');
    expect(navSpy).toHaveBeenCalledWith(['/dashboard'], {
      queryParams: {
        billing_status: 'success',
        billing_session: 'pm_test_session_123',
      },
    });
  });
});
