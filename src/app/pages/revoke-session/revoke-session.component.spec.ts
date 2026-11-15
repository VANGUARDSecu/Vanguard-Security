import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RevokeSessionComponent } from './revoke-session.component';
import { AuthService } from '../../services/auth.service';

describe('RevokeSessionComponent (SCRUM-190)', () => {
  const createComponent = (
    token: string | null,
    authOverrides: Partial<{
      previewAlertRevocation: ReturnType<typeof vi.fn>;
      confirmAlertRevocation: ReturnType<typeof vi.fn>;
      isLoggedIn: ReturnType<typeof vi.fn>;
      logout: ReturnType<typeof vi.fn>;
    }> = {}
  ) => {
    const paramMap = convertToParamMap(token ? { token } : {});
    const mockAuth = {
      previewAlertRevocation:
        authOverrides.previewAlertRevocation ??
        vi.fn().mockReturnValue(
          of({
            valid: true,
            emailMasked: 'd***d@vanguardsecurity.io',
            applicationName: 'Acme Dummy Web',
            ipAddress: '172.16.0.4',
            device: 'Chrome on Windows',
            timestamp: '2026-11-15T10:00:00.000Z',
            expiresAt: '2026-11-16T10:00:00.000Z',
          })
        ),
      confirmAlertRevocation:
        authOverrides.confirmAlertRevocation ??
        vi.fn().mockReturnValue(
          of({
            success: true,
            emailMasked: 'd***d@vanguardsecurity.io',
            refreshRevoked: true,
            oidcGrantsRevoked: 2,
            maxResidualAccessSeconds: 3600,
            notCovered: ['Direct app sessions are not terminated.'],
            message: 'All active Vanguard sessions revoked.',
          })
        ),
      isLoggedIn: authOverrides.isLoggedIn ?? vi.fn().mockReturnValue(false),
      logout: authOverrides.logout ?? vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [RevokeSessionComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuth },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: paramMap },
            queryParamMap: of(paramMap),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(RevokeSessionComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, mockAuth };
  };

  it('shows error state when token query param is missing', () => {
    const { component, mockAuth } = createComponent(null);
    expect(component.state()).toBe('error');
    expect(mockAuth.previewAlertRevocation).not.toHaveBeenCalled();
  });

  it('loads scanner-safe preview details and executes POST revocation only when user confirms', () => {
    const logout = vi.fn();
    const { component, mockAuth } = createComponent('signed.alert.token', {
      isLoggedIn: vi.fn().mockReturnValue(true),
      logout,
    });

    expect(mockAuth.previewAlertRevocation).toHaveBeenCalledWith('signed.alert.token');
    expect(mockAuth.confirmAlertRevocation).not.toHaveBeenCalled();
    expect(component.state()).toBe('ready');
    expect(component.preview()?.applicationName).toBe('Acme Dummy Web');

    component.confirmRevoke();

    expect(mockAuth.confirmAlertRevocation).toHaveBeenCalledWith('signed.alert.token');
    expect(logout).toHaveBeenCalledWith(false, false);
    expect(component.state()).toBe('revoked');
    expect(component.result()?.oidcGrantsRevoked).toBe(2);
  });

  it('transitions to error state when preview fails with expired/used link', () => {
    const { component } = createComponent('used.token', {
      previewAlertRevocation: vi.fn().mockReturnValue(
        throwError(() => new Error('This security revocation link has already been used.'))
      ),
    });

    expect(component.state()).toBe('error');
    expect(component.errorMessage()).toContain('already been used');
  });
});
