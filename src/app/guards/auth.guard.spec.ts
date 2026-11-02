import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { signal } from '@angular/core';

describe('authGuard (SCRUM-155)', () => {
  let mockAuthService: {
    isLoggedIn: ReturnType<typeof vi.fn>;
    isPasswordResetRequired: ReturnType<typeof signal<boolean>>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAuthService = {
      isLoggedIn: vi.fn(),
      isPasswordResetRequired: signal<boolean>(false),
    };
    mockRouter = {
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  it('redirects unauthenticated users to /login', () => {
    mockAuthService.isLoggedIn.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));

    expect(result).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('redirects to /reset-password when isPasswordResetRequired is true', () => {
    mockAuthService.isLoggedIn.mockReturnValue(true);
    mockAuthService.isPasswordResetRequired.set(true);

    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));

    expect(result).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/reset-password']);
  });

  it('allows access to protected routes when authenticated and no reset is required', () => {
    mockAuthService.isLoggedIn.mockReturnValue(true);
    mockAuthService.isPasswordResetRequired.set(false);

    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));

    expect(result).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});
