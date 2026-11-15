import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { NewUserGuideModalComponent } from './new-user-guide-modal.component';
import { NewUserGuideService } from './new-user-guide.service';

describe('NewUserGuideModalComponent (SCRUM-194)', () => {
  let fixture: ComponentFixture<NewUserGuideModalComponent>;
  let service: NewUserGuideService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    await TestBed.configureTestingModule({
      imports: [NewUserGuideModalComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    service = TestBed.inject(NewUserGuideService);
    fixture = TestBed.createComponent(NewUserGuideModalComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('does not render modal markup while closed', () => {
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders plain-English 3-step cards and "Don\'t show again" checkbox in dashboard mode', () => {
    service.autoOpenIfFirstDashboardVisit('usr-modal-1', 'company-admin');
    fixture.detectChanges();

    const dialog: HTMLElement | null = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    const stepCards = fixture.nativeElement.querySelectorAll('.guide-step-card');
    expect(stepCards.length).toBe(3);

    const checkbox: HTMLInputElement | null = fixture.nativeElement.querySelector('[data-testid="guide-dont-show-checkbox"]');
    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(true);
  });

  it('switches role tabs interactively and hides checkbox on landing context', () => {
    service.openFromLanding('individual');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="guide-dont-show-checkbox"]')).toBeNull();

    const employeeTab: HTMLButtonElement | null = fixture.nativeElement.querySelector('[data-role-tab="employee"]');
    expect(employeeTab).not.toBeNull();
    employeeTab?.click();
    fixture.detectChanges();

    expect(service.activeRole()).toBe('employee');
    expect(fixture.nativeElement.textContent).toContain('Open Saved Work Apps');
  });

  it('closes on Escape key and dispatches shortcut action when step button clicked', () => {
    const navSpy = vi.fn();
    service.registerDashboardNavigator(navSpy);
    service.openFromDashboard('usr-modal-2', 'employee');
    fixture.detectChanges();

    const actionBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('[data-testid="guide-step-action-2"]');
    expect(actionBtn).not.toBeNull();
    actionBtn?.click();
    fixture.detectChanges();

    expect(navSpy).toHaveBeenCalledWith('user-security');
    expect(service.isOpen()).toBe(false);

    service.openFromDashboard('usr-modal-2', 'employee');
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(service.isOpen()).toBe(false);
  });
});
