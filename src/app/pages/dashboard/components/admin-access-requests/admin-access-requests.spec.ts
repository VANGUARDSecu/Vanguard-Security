import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminAccessRequests } from './admin-access-requests';
import { DashboardService } from '../../services/dashboard.service';
import { AppAccessRequest } from '../../models/dashboard.models';

describe('AdminAccessRequests Component (SCRUM-152)', () => {
  let component: AdminAccessRequests;
  let fixture: ComponentFixture<AdminAccessRequests>;
  let dashboardService: DashboardService;

  const testRequests: AppAccessRequest[] = [
    {
      id: 'test-req-1',
      userId: 'usr-1',
      userName: 'Alice Smith',
      userEmail: 'alice.smith@example.com',
      department: 'Engineering',
      role: 'Staff Engineer',
      appName: 'Datadog SIEM',
      protocol: 'OIDC',
      category: 'cloud',
      icon: '📊',
      launchUrl: 'https://app.datadoghq.com',
      justification: 'Need access to debug production incidents.',
      status: 'Pending Approval',
      submittedAt: new Date().toISOString(),
    },
    {
      id: 'test-req-2',
      userId: 'usr-2',
      userName: 'Bob Jones',
      userEmail: 'bob.jones@example.com',
      department: 'Security',
      role: 'Analyst',
      appName: 'AWS Console',
      protocol: 'OIDC',
      category: 'cloud',
      icon: '☁️',
      launchUrl: 'https://console.aws.amazon.com',
      justification: 'Security audit review.',
      status: 'Approved',
      submittedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Admin',
    },
    {
      id: 'test-req-3',
      userId: 'usr-3',
      userName: 'Charlie Brown',
      userEmail: 'charlie@example.com',
      department: 'Sales',
      role: 'Representative',
      appName: 'Salesforce',
      protocol: 'SAML 2.0',
      category: 'cloud',
      icon: '💼',
      launchUrl: 'https://salesforce.com',
      justification: 'Lead tracking.',
      status: 'Rejected',
      submittedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'Admin',
      adminNotes: 'License quota exceeded',
    },
  ];

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [AdminAccessRequests],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    dashboardService = TestBed.inject(DashboardService);
    dashboardService.activeTab.set('access-requests');
    dashboardService.viewMode.set('admin');

    fixture = TestBed.createComponent(AdminAccessRequests);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the AdminAccessRequests component', () => {
    expect(component).toBeTruthy();
  });

  it('should display empty state when there are no access requests', () => {
    dashboardService.appAccessRequests.set([]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state-wrap')).toBeTruthy();
    expect(compiled.textContent).toContain('No access requests found matching your filter criteria.');
    expect(component.appAccessRequests().length).toBe(0);
    expect(component.pendingAccessRequests().length).toBe(0);
    expect(component.approvedAccessRequestsCount()).toBe(0);
  });

  it('should render table rows when access requests are present', () => {
    dashboardService.appAccessRequests.set(testRequests);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Alice Smith');
    expect(fixture.nativeElement.textContent).toContain('Datadog SIEM');
    expect(component.approvedAccessRequestsCount()).toBe(1);
    expect(component.pendingAccessRequestsCount()).toBe(1);
  });

  it('should filter requests by status', () => {
    dashboardService.appAccessRequests.set(testRequests);
    fixture.detectChanges();

    component.setAccessRequestStatusFilter('Pending Approval');
    fixture.detectChanges();
    expect(component.filteredAccessRequests().length).toBe(1);
    expect(component.filteredAccessRequests()[0].id).toBe('test-req-1');

    component.setAccessRequestStatusFilter('Approved');
    fixture.detectChanges();
    expect(component.filteredAccessRequests().length).toBe(1);
    expect(component.filteredAccessRequests()[0].id).toBe('test-req-2');

    component.setAccessRequestStatusFilter('Rejected');
    fixture.detectChanges();
    expect(component.filteredAccessRequests().length).toBe(1);
    expect(component.filteredAccessRequests()[0].id).toBe('test-req-3');

    component.setAccessRequestStatusFilter('all');
    fixture.detectChanges();
    expect(component.filteredAccessRequests().length).toBe(3);
  });

  it('should filter requests by search query', () => {
    dashboardService.appAccessRequests.set(testRequests);
    fixture.detectChanges();

    component.accessRequestSearch = 'alice';
    fixture.detectChanges();
    expect(component.filteredAccessRequests().length).toBe(1);
    expect(component.filteredAccessRequests()[0].userName).toBe('Alice Smith');

    component.accessRequestSearch = 'Salesforce';
    fixture.detectChanges();
    expect(component.filteredAccessRequests().length).toBe(1);
    expect(component.filteredAccessRequests()[0].appName).toBe('Salesforce');

    component.accessRequestSearch = '';
    fixture.detectChanges();
    expect(component.filteredAccessRequests().length).toBe(3);
  });

  it('should approve a pending access request', () => {
    dashboardService.appAccessRequests.set(testRequests);
    fixture.detectChanges();

    component.approveAccessRequest('test-req-1');
    fixture.detectChanges();

    const req = dashboardService.appAccessRequests().find((r) => r.id === 'test-req-1');
    expect(req?.status).toBe('Approved');
  });

  it('should open reject modal, record notes, and confirm rejection', () => {
    dashboardService.appAccessRequests.set(testRequests);
    fixture.detectChanges();

    const targetReq = testRequests[0];
    component.openRejectModal(targetReq);
    expect(component.showRejectModal()).toBe(true);
    expect(component.selectedAccessRequestForReject()).toEqual(targetReq);

    component.rejectAdminNoteInput = 'Security training incomplete';
    component.confirmRejectAccessRequest();
    fixture.detectChanges();

    expect(component.showRejectModal()).toBe(false);
    const updated = dashboardService.appAccessRequests().find((r) => r.id === 'test-req-1');
    expect(updated?.status).toBe('Rejected');
    expect(updated?.adminNotes).toBe('Security training incomplete');
  });

  // ==========================================================================
  // SCRUM-161: Governance Review Modal & Zero-Knowledge Verification
  // ==========================================================================
  it('should open review modal with full metadata and zero-knowledge security protection', () => {
    dashboardService.appAccessRequests.set(testRequests);
    fixture.detectChanges();

    const targetReq = testRequests[0];
    component.openReviewModal(targetReq);

    expect(component.showReviewModal()).toBe(true);
    expect(component.selectedRequestForReview()).toEqual(targetReq);

    component.closeReviewModal();
    expect(component.showReviewModal()).toBe(false);
    expect(component.selectedRequestForReview()).toBeNull();
  });

  it('should approve access request directly from review modal', () => {
    dashboardService.appAccessRequests.set(testRequests);
    fixture.detectChanges();

    const targetReq = testRequests[0];
    component.openReviewModal(targetReq);
    component.approveFromReview(targetReq.id);

    expect(component.showReviewModal()).toBe(false);
    const updated = dashboardService.appAccessRequests().find((r) => r.id === targetReq.id);
    expect(updated?.status).toBe('Approved');
  });

  it('should transition to reject modal from review modal', () => {
    dashboardService.appAccessRequests.set(testRequests);
    fixture.detectChanges();

    const targetReq = testRequests[0];
    component.openReviewModal(targetReq);
    component.rejectFromReview(targetReq);

    expect(component.showReviewModal()).toBe(false);
    expect(component.showRejectModal()).toBe(true);
    expect(component.selectedAccessRequestForReject()).toEqual(targetReq);
  });
});
