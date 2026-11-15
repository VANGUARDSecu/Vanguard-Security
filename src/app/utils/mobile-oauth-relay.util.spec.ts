import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MOBILE_OAUTH_REDIRECT,
  buildMobileOAuthDeepLink,
  isAllowedMobileRedirectUri,
} from './mobile-oauth-relay.util';

describe('mobile-oauth-relay.util', () => {
  it('allows only Vanguard mobile schemes', () => {
    expect(isAllowedMobileRedirectUri('mobilevanguard://login')).toBe(true);
    expect(isAllowedMobileRedirectUri('vanguard-auth://oauth/authorize')).toBe(true);
    expect(isAllowedMobileRedirectUri('vanguard-enroll://pair')).toBe(true);
    expect(isAllowedMobileRedirectUri('exp://127.0.0.1:8082/--/login')).toBe(true);

    expect(isAllowedMobileRedirectUri('https://evil.com/steal')).toBe(false);
    expect(isAllowedMobileRedirectUri('http://localhost:4200/login')).toBe(false);
    expect(isAllowedMobileRedirectUri('javascript:alert(1)')).toBe(false);
    expect(isAllowedMobileRedirectUri('data:text/html,hi')).toBe(false);
    expect(isAllowedMobileRedirectUri('')).toBe(false);
    expect(isAllowedMobileRedirectUri(null)).toBe(false);
  });

  it('preserves hash tokens when relaying to default mobilevanguard://login', () => {
    const deepLink = buildMobileOAuthDeepLink({
      search: '',
      hash: '#access_token=jwt.tok.sig&refresh_token=ref_123&token_type=bearer',
    });

    expect(deepLink).toBe(
      `${DEFAULT_MOBILE_OAUTH_REDIRECT}#access_token=jwt.tok.sig&refresh_token=ref_123&token_type=bearer`
    );
  });

  it('honors valid mobile_redirect and forwards OAuth query params without leaking mobile_redirect', () => {
    const deepLink = buildMobileOAuthDeepLink({
      search: '?mobile_redirect=mobilevanguard%3A%2F%2Flogin&code=auth_code_1&state=st_9',
      hash: '',
    });

    expect(deepLink).toBe('mobilevanguard://login?code=auth_code_1&state=st_9');
  });

  it('falls back to default mobilevanguard://login when mobile_redirect is unsafe', () => {
    const deepLink = buildMobileOAuthDeepLink({
      search: '?mobile_redirect=https%3A%2F%2Fevil.example%2Fphish&error=access_denied',
      hash: '#error_description=User+denied',
    });

    expect(deepLink).toBe(
      'mobilevanguard://login?error=access_denied#error_description=User+denied'
    );
  });
});
