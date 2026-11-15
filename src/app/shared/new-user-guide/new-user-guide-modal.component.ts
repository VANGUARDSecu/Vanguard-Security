import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GuideStep, NewUserGuideService } from './new-user-guide.service';

/**
 * Shared simplified, role-aware New User Guide modal mounted once at app root.
 */
@Component({
  selector: 'app-new-user-guide-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './new-user-guide-modal.component.html',
  styleUrl: './new-user-guide-modal.component.css',
})
export class NewUserGuideModalComponent {
  readonly guideService = inject(NewUserGuideService);

  readonly isOpen = this.guideService.isOpen;
  readonly context = this.guideService.context;
  readonly activeRole = this.guideService.activeRole;
  readonly activeProfile = this.guideService.activeProfile;
  readonly activeSteps = this.guideService.activeSteps;
  readonly roleTabs = this.guideService.roleTabs;
  readonly dontShowAgain = this.guideService.dontShowAgain;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  onDontShowChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.guideService.setDontShowAgain(input.checked);
  }

  onPrimaryLandingAction(): void {
    const profile = this.activeProfile();
    const firstStep = profile.steps[0];
    if (firstStep) {
      this.guideService.executeStepAction(firstStep);
    } else {
      this.close();
    }
  }

  onStepAction(step: GuideStep): void {
    this.guideService.executeStepAction(step);
  }

  close(): void {
    this.guideService.close(true);
  }
}
