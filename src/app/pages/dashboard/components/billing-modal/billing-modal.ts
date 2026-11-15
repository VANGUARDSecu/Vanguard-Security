import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-billing-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './billing-modal.html',
  styleUrl: './billing-modal.css',
})
export class BillingModal {
  readonly dashboardService = inject(DashboardService);

  readonly showPaywallModal = this.dashboardService.showPaywallModal;
  readonly paywallFeatureMessage = this.dashboardService.paywallFeatureMessage;
  readonly subscriptionPlanId = this.dashboardService.subscriptionPlanId;
  readonly isFreeTier = this.dashboardService.isFreeTier;
  readonly currentPlanDisplayName = this.dashboardService.currentPlanDisplayName;
  readonly billingInvoices = this.dashboardService.billingInvoices;
  readonly isIndividual = this.dashboardService.isIndividual;
  readonly isCompanyAdmin = this.dashboardService.isCompanyAdmin;
  readonly isTenantMember = this.dashboardService.isTenantMember;
  readonly canManageBilling = this.dashboardService.canManageBilling;
  readonly organizationName = this.dashboardService.organizationName;
  readonly auditRetentionDays = this.dashboardService.auditRetentionDays;
  readonly canExportAuditCsv = this.dashboardService.canExportAuditCsv;
  readonly isRedirectingToPaymongo = this.dashboardService.isRedirectingToPaymongo;
  readonly isRestoringPaidPlan = this.dashboardService.isRestoringPaidPlan;
  readonly resendingReceiptId = this.dashboardService.resendingReceiptId;
  readonly paidCredit = this.dashboardService.paidCredit;
  readonly billingCheckoutError = this.dashboardService.billingCheckoutError;
  readonly isLoadingBillingState = this.dashboardService.isLoadingBillingState;

  readonly showGatewayConfigForm = signal<boolean>(false);
  readonly selectedReceiptId = signal<string | null>(null);
  gatewayProviderInput = this.dashboardService.sandboxGatewayProvider();
  gatewayUrlInput = this.dashboardService.sandboxGatewayUrl();
  gatewayApiKeyInput = this.dashboardService.sandboxGatewayApiKey();

  closeModal(): void {
    this.selectedReceiptId.set(null);
    this.dashboardService.closePaywallModal();
  }

  subscribeWithPaymongo(planId: 'personal_pro' | 'business_pro' | 'enterprise'): void {
    this.dashboardService.startPaymongoCheckout(planId);
  }

  canRestorePlan(planId: 'personal_pro' | 'business_pro' | 'enterprise'): boolean {
    return this.dashboardService.canRestorePlanWithoutCharge(planId);
  }

  restorePlan(planId: 'personal_pro' | 'business_pro' | 'enterprise'): void {
    this.dashboardService.resumePaidSubscription(planId);
  }

  resendReceipt(invoiceId?: string): void {
    this.dashboardService.resendBillingReceipt(invoiceId);
  }

  toggleReceiptView(invoiceId: string): void {
    this.selectedReceiptId.update((curr) => (curr === invoiceId ? null : invoiceId));
  }

  printReceipt(): void {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }

  cancelPlan(): void {
    this.dashboardService.cancelSubscriptionPlan();
  }

  refreshTenantPlan(): void {
    this.dashboardService.loadBillingSubscription();
  }

  toggleGatewayConfig(): void {
    if (!this.showGatewayConfigForm()) {
      this.gatewayProviderInput = this.dashboardService.sandboxGatewayProvider();
      this.gatewayUrlInput = this.dashboardService.sandboxGatewayUrl();
      this.gatewayApiKeyInput = this.dashboardService.sandboxGatewayApiKey();
    }
    this.showGatewayConfigForm.update((v) => !v);
  }

  saveGatewaySettings(): void {
    this.dashboardService.saveSandboxGatewayConfig(
      this.gatewayProviderInput,
      this.gatewayUrlInput,
      this.gatewayApiKeyInput,
    );
    this.showGatewayConfigForm.set(false);
  }
}
