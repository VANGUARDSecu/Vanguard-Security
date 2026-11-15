import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Navbar } from './navbar';
import { NewUserGuideService } from '../../../../shared/new-user-guide/new-user-guide.service';

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;
  let guideService: NewUserGuideService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([])]
    }).compileComponents();

    guideService = TestBed.inject(NewUserGuideService);
    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens New User Guide modal from Landing when clicking Quick Guide button (SCRUM-194)', () => {
    const guideBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('[data-testid="landing-guide-btn"]');
    expect(guideBtn).not.toBeNull();
    guideBtn?.click();

    expect(guideService.isOpen()).toBe(true);
    expect(guideService.context()).toBe('landing');
  });
});
