import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

/**
 * Supported user roles displayed inside the simplified onboarding guide.
 */
export type GuideRole = 'company-admin' | 'employee' | 'individual';

/**
 * Entry context determining whether step buttons switch dashboard tabs or navigate to auth routes.
 */
export type GuideContext = 'landing' | 'dashboard';

/**
 * Single plain-English step shown inside the onboarding modal.
 */
export interface GuideStep {
  stepNumber: number;
  icon: string;
  title: string;
  description: string;
  targetTab: string;
  landingRoute: string;
  actionLabel: string;
  landingActionLabel: string;
}

/**
 * Complete role profile rendered inside the simplified onboarding guide.
 */
export interface GuideRoleProfile {
  role: GuideRole;
  tabLabel: string;
  badge: string;
  headline: string;
  summary: string;
  landingActionLabel: string;
  landingRoute: string;
  steps: GuideStep[];
}

const GUIDE_STORAGE_PREFIX = 'vanguard_guide_dismissed_';

const GUIDE_PROFILES: Record<GuideRole, GuideRoleProfile> = {
  'company-admin': {
    role: 'company-admin',
    tabLabel: 'Company Owner',
    badge: 'Team Control',
    headline: 'Set up your team safely in 3 quick steps',
    summary:
      'Keep an eye on company activity, invite teammates with private setup links, and approve app requests from one place.',
    landingActionLabel: 'Create Company Account',
    landingRoute: '/register',
    steps: [
      {
        stepNumber: 1,
        icon: '📊',
        title: 'Check Your Company Overview',
        description:
          'See active team members, approved apps, and recent sign-ins at a glance before changing anything.',
        targetTab: 'overview',
        landingRoute: '/register',
        actionLabel: 'Open Overview',
        landingActionLabel: 'Create Company Account',
      },
      {
        stepNumber: 2,
        icon: '✉️',
        title: 'Invite Employees With Private Links',
        description:
          'Send new hires a 48-hour setup link so they choose their own password instead of sharing one in chat.',
        targetTab: 'directory',
        landingRoute: '/register',
        actionLabel: 'Open Directory',
        landingActionLabel: 'Start Team Setup',
      },
      {
        stepNumber: 3,
        icon: '✅',
        title: 'Approve Work App Requests',
        description:
          'Whenever someone asks to open a work tool, review the request and allow or block access in one click.',
        targetTab: 'access-requests',
        landingRoute: '/login',
        actionLabel: 'Review Requests',
        landingActionLabel: 'Sign In as Admin',
      },
    ],
  },
  employee: {
    role: 'employee',
    tabLabel: 'Team Employee',
    badge: 'Easy Work Access',
    headline: 'Open your work apps safely in 3 quick steps',
    summary:
      'Launch apps shared by your team, sign in with one click, and add extra protection so nobody else can enter.',
    landingActionLabel: 'Sign In to Portal',
    landingRoute: '/login',
    steps: [
      {
        stepNumber: 1,
        icon: '🚀',
        title: 'Open Saved Work Apps',
        description:
          'Find the tools your company assigned to you and open them cleanly without typing passwords manually.',
        targetTab: 'my-apps',
        landingRoute: '/login',
        actionLabel: 'Open My Apps',
        landingActionLabel: 'Sign In to Work Portal',
      },
      {
        stepNumber: 2,
        icon: '🔑',
        title: 'Launch One-Click Company Apps',
        description:
          'Open connected company portals directly with your Vanguard account—no extra passwords to remember.',
        targetTab: 'sso-apps',
        landingRoute: '/login',
        actionLabel: 'Open SSO Apps',
        landingActionLabel: 'Open Employee Sign-In',
      },
      {
        stepNumber: 3,
        icon: '🛡️',
        title: 'Turn On Two-Step Protection',
        description:
          'Enable phone approval prompts and save backup codes so your account stays safe even if someone guesses a password.',
        targetTab: 'user-security',
        landingRoute: '/login',
        actionLabel: 'Open Security',
        landingActionLabel: 'Go to Sign In',
      },
    ],
  },
  individual: {
    role: 'individual',
    tabLabel: 'Personal Vault',
    badge: 'Personal Safety',
    headline: 'Protect your personal accounts in 3 easy steps',
    summary:
      'Store passwords privately in one place, keep two-step codes handy, and stay in control of every signed-in device.',
    landingActionLabel: 'Create Personal Account',
    landingRoute: '/register',
    steps: [
      {
        stepNumber: 1,
        icon: '🔒',
        title: 'Save Your First Password',
        description:
          'Store website logins, private notes, or cards inside your personal vault so only you can open them.',
        targetTab: 'personal-vault',
        landingRoute: '/register',
        actionLabel: 'Open Personal Vault',
        landingActionLabel: 'Create Personal Account',
      },
      {
        stepNumber: 2,
        icon: '📱',
        title: 'Keep Two-Step Codes Ready',
        description:
          'Add your everyday 6-digit login codes here so you can sign into your favorite accounts quickly.',
        targetTab: 'authenticator',
        landingRoute: '/register',
        actionLabel: 'Open Authenticator',
        landingActionLabel: 'Get Started Free',
      },
      {
        stepNumber: 3,
        icon: '🛟',
        title: 'Save Backup Codes & Check Devices',
        description:
          'Check which phones or browsers are signed in and download backup codes in case you lose your phone.',
        targetTab: 'user-security',
        landingRoute: '/login',
        actionLabel: 'Open Security',
        landingActionLabel: 'Sign In to Vault',
      },
    ],
  },
};

/**
 * Deterministically maps account flags to one of the three onboarding guide roles.
 */
export function resolveGuideRole(opts: {
  isIndividual: boolean;
  isAdmin: boolean;
}): GuideRole {
  if (opts.isIndividual) return 'individual';
  if (opts.isAdmin) return 'company-admin';
  return 'employee';
}

/**
 * Shared state store for the simplified, role-aware New User Guide modal across Landing and Dashboard.
 */
@Injectable({
  providedIn: 'root',
})
export class NewUserGuideService {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  readonly isOpen = signal<boolean>(false);
  readonly context = signal<GuideContext>('landing');
  readonly activeRole = signal<GuideRole>('company-admin');
  readonly activeUserKey = signal<string | null>(null);
  readonly dontShowAgain = signal<boolean>(true);

  readonly roleTabs: ReadonlyArray<{ role: GuideRole; label: string }> = [
    { role: 'company-admin', label: GUIDE_PROFILES['company-admin'].tabLabel },
    { role: 'employee', label: GUIDE_PROFILES['employee'].tabLabel },
    { role: 'individual', label: GUIDE_PROFILES['individual'].tabLabel },
  ];

  readonly activeProfile = computed<GuideRoleProfile>(
    () => GUIDE_PROFILES[this.activeRole()]
  );

  readonly activeSteps = computed<GuideStep[]>(
    () => this.activeProfile().steps
  );

  private dashboardNavigator: ((tab: string) => void) | null = null;
  private readonly sessionDismissedKeys = new Set<string>();

  /**
   * Builds the normalized localStorage dismissal key for a specific user principal.
   */
  static storageKeyForUser(userKey: string): string {
    return `${GUIDE_STORAGE_PREFIX}${userKey.trim().toLowerCase()}`;
  }

  private canUseStorage(): boolean {
    return isPlatformBrowser(this.platformId) && typeof localStorage !== 'undefined';
  }

  private normalizeUserKey(userKey: string | null | undefined): string {
    return (userKey ?? '').trim().toLowerCase();
  }

  private readRawPreference(userKey: string): string | null {
    if (!this.canUseStorage()) return null;
    try {
      return localStorage.getItem(NewUserGuideService.storageKeyForUser(userKey));
    } catch {
      return null;
    }
  }

  /**
   * Returns true if the given user previously opted out of automatic guide popups.
   */
  isDismissedForUser(userKey: string): boolean {
    const normalized = this.normalizeUserKey(userKey);
    if (!normalized) return false;
    return this.readRawPreference(normalized) === 'true';
  }

  /**
   * Registers the dashboard tab switcher so step shortcuts open matching workspace panels directly.
   */
  registerDashboardNavigator(fn: ((tab: string) => void) | null): void {
    this.dashboardNavigator = fn;
  }

  /**
   * Auto-opens the guide once for a first-time logged-in user unless dismissed or already closed this session.
   */
  autoOpenIfFirstDashboardVisit(
    userKey: string | null | undefined,
    role: GuideRole
  ): boolean {
    const normalized = this.normalizeUserKey(userKey);
    if (!normalized) return false;
    if (this.isDismissedForUser(normalized) || this.sessionDismissedKeys.has(normalized)) {
      return false;
    }
    this.activeUserKey.set(normalized);
    this.context.set('dashboard');
    this.activeRole.set(role);
    this.dontShowAgain.set(true);
    this.isOpen.set(true);
    return true;
  }

  /**
   * Explicitly opens the guide from the public Landing page navigation bar.
   */
  openFromLanding(role: GuideRole = 'company-admin'): void {
    this.activeUserKey.set(null);
    this.context.set('landing');
    this.activeRole.set(role);
    this.isOpen.set(true);
  }

  /**
   * Explicitly reopens the guide from the Dashboard header Help button.
   */
  openFromDashboard(userKey: string | null | undefined, role: GuideRole): void {
    const normalized = this.normalizeUserKey(userKey);
    this.activeUserKey.set(normalized || null);
    this.context.set('dashboard');
    this.activeRole.set(role);
    if (normalized) {
      const stored = this.readRawPreference(normalized);
      this.dontShowAgain.set(stored === null ? true : stored === 'true');
    } else {
      this.dontShowAgain.set(true);
    }
    this.isOpen.set(true);
  }

  /**
   * Switches the currently displayed role walkthrough inside the modal.
   */
  selectRole(role: GuideRole): void {
    this.activeRole.set(role);
  }

  /**
   * Updates whether closing the dashboard guide suppresses future automatic popups.
   */
  setDontShowAgain(value: boolean): void {
    this.dontShowAgain.set(Boolean(value));
  }

  /**
   * Closes the guide modal and optionally persists the per-user auto-open preference.
   */
  close(persistPreference = true): void {
    const userKey = this.activeUserKey();
    if (this.context() === 'dashboard' && userKey) {
      this.sessionDismissedKeys.add(userKey);
      if (persistPreference && this.canUseStorage()) {
        try {
          const storageKey = NewUserGuideService.storageKeyForUser(userKey);
          if (this.dontShowAgain()) {
            localStorage.setItem(storageKey, 'true');
          } else {
            localStorage.removeItem(storageKey);
          }
        } catch {
          // Non-fatal in private browsing or restricted storage environments.
        }
      }
    }
    this.isOpen.set(false);
  }

  /**
   * Executes a step shortcut CTA, switching dashboard tab or routing to signup/sign-in on landing.
   */
  executeStepAction(step: GuideStep): void {
    const currentContext = this.context();
    const targetRoute = step.landingRoute || this.activeProfile().landingRoute;
    this.close(true);

    if (currentContext === 'dashboard' && step.targetTab && this.dashboardNavigator) {
      this.dashboardNavigator(step.targetTab);
      return;
    }

    if (currentContext === 'landing') {
      void this.router.navigate([targetRoute]);
    }
  }
}
