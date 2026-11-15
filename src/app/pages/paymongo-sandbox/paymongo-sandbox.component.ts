import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { DashboardService } from '../dashboard/services/dashboard.service';

@Component({
  selector: 'app-paymongo-sandbox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paymongo-sandbox.component.html',
  styleUrl: './paymongo-sandbox.component.css',
})
export class PaymongoSandboxComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);

  readonly sessionId = signal<string>('');
  readonly planId = signal<string>('personal_pro');
  readonly planName = signal<string>('Personal Pro');
  readonly accountType = signal<'individual' | 'company'>('individual');
  readonly amountPhp = signal<number>(290);
  readonly amountUsd = signal<number>(5);
  readonly customerEmail = signal<string>(
    this.authService.currentUser()?.email || 'customer@vanguard.local',
  );

  readonly selectedMethod = signal<'card' | 'gcash' | 'maya' | 'grab_pay'>('card');
  readonly isProcessing = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  cardNumber = '4343 4343 4343 4343';
  cardExpiry = '12/28';
  cardCvc = '123';
  cardHolderName = this.authService.currentUser()?.name || 'Vanguard Subscriber';
  mobileNumber = '09171234567';

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const sid = String(params['session'] || `pm_sbx_${Date.now()}`);
    const plan = String(params['plan'] || 'personal_pro');
    const acct = params['accountType'] === 'company' ? 'company' : 'individual';
    const php = Number(params['amountPhp'] || (plan === 'enterprise' ? 4590 : plan === 'business_pro' ? 1690 : 290));
    const usd = Number(params['amountUsd'] || (plan === 'enterprise' ? 79 : plan === 'business_pro' ? 29 : 5));

    this.sessionId.set(sid);
    this.planId.set(plan);
    this.accountType.set(acct);
    this.amountPhp.set(php);
    this.amountUsd.set(usd);
    this.planName.set(this.formatPlanName(plan));

    if (this.authService.token()) {
      this.http
        .get<any>(`${environment.apiUrl}/billing/checkout/session`, {
          params: { sessionId: sid },
        })
        .subscribe({
          next: (sess) => {
            if (!sess) return;
            if (sess.planName) this.planName.set(sess.planName);
            if (sess.planId) this.planId.set(sess.planId);
            if (sess.accountType) this.accountType.set(sess.accountType);
            if (typeof sess.amountPhp === 'number') this.amountPhp.set(sess.amountPhp);
            if (typeof sess.amountUsd === 'number') this.amountUsd.set(sess.amountUsd);
            if (sess.email) this.customerEmail.set(sess.email);
          },
          error: () => {
            // Fall back smoothly to query parameters in dev/mock setups
          },
        });
    }
  }

  private formatPlanName(planId: string): string {
    if (planId === 'enterprise') return 'Enterprise Zero-Trust';
    if (planId === 'business_pro') return 'Business Pro';
    return 'Personal Pro';
  }

  private methodLabel(): string {
    const m = this.selectedMethod();
    if (m === 'gcash') return 'PayMongo GCash (Sandbox)';
    if (m === 'maya') return 'PayMongo Maya (Sandbox)';
    if (m === 'grab_pay') return 'PayMongo GrabPay (Sandbox)';
    return `PayMongo Test Card •••• ${this.cardNumber.replace(/\s+/g, '').slice(-4) || '4343'}`;
  }

  authorizeTestPayment(): void {
    this.errorMessage.set(null);
    this.isProcessing.set(true);
    const sid = this.sessionId();
    const method = this.methodLabel();

    this.dashboardService.completeLocalSandboxSession(sid, 'pay', method).subscribe({
      next: (res) => {
        this.isProcessing.set(false);
        if (res?.unlocked) {
          void this.router.navigate(['/dashboard'], {
            queryParams: {
              billing_status: 'success',
              billing_session: sid,
            },
          });
        } else {
          this.errorMessage.set(res?.message || 'Payment did not authorize.');
        }
      },
      error: (err) => {
        this.isProcessing.set(false);
        this.errorMessage.set(err?.error?.message || 'PayMongo sandbox authorization error.');
      },
    });
  }

  simulateFailedPayment(): void {
    this.errorMessage.set(null);
    this.isProcessing.set(true);
    this.dashboardService
      .completeLocalSandboxSession(this.sessionId(), 'fail', this.methodLabel())
      .subscribe({
        next: (res) => {
          this.isProcessing.set(false);
          this.errorMessage.set(
            res?.message || 'Simulated payment declined (card_declined). Subscription remains on Free tier.',
          );
        },
        error: () => {
          this.isProcessing.set(false);
          this.errorMessage.set('Simulated payment declined. Subscription remains on Free tier.');
        },
      });
  }

  cancelCheckout(): void {
    const sid = this.sessionId();
    this.dashboardService
      .completeLocalSandboxSession(sid, 'cancel', this.methodLabel())
      .subscribe({
        next: () => {
          void this.router.navigate(['/dashboard'], {
            queryParams: {
              billing_status: 'cancelled',
              billing_session: sid,
            },
          });
        },
        error: () => {
          void this.router.navigate(['/dashboard'], {
            queryParams: {
              billing_status: 'cancelled',
              billing_session: sid,
            },
          });
        },
      });
  }
}
