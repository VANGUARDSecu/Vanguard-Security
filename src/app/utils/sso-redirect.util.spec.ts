import { describe, it, expect } from 'vitest';
import {
  buildSsoCallbackUrl,
  isCustomMobileSchemeUrl,
  isSafeSsoCallbackUrl,
} from './sso-redirect.util';

describe('sso-redirect.util', () => {
  it('detects custom mobile SSO schemes such as vanguard-dummy:// and exp://', () => {
    expect(isCustomMobileSchemeUrl('vanguard-dummy://oauth/callback?code=c1')).toBe(true);
    expect(isCustomMobileSchemeUrl('exp://192.168.1.25:8081/--/oauth/callback?code=c2')).toBe(true);
    expect(isCustomMobileSchemeUrl('http://localhost:4201/auth/callback?code=c3')).toBe(false);
    expect(isCustomMobileSchemeUrl('https://portal.example.com/callback')).toBe(false);
    expect(isCustomMobileSchemeUrl('javascript:alert(1)')).toBe(false);
  });

  it('allows http(s) and allowlisted custom schemes while rejecting unsafe schemes', () => {
    expect(isSafeSsoCallbackUrl('http://localhost:4201/auth/callback')).toBe(true);
    expect(isSafeSsoCallbackUrl('https://portal.example.com/auth/callback')).toBe(true);
    expect(isSafeSsoCallbackUrl('vanguard-dummy://oauth/callback')).toBe(true);
    expect(isSafeSsoCallbackUrl('exp://192.168.1.25:8081/--/oauth/callback')).toBe(true);

    expect(isSafeSsoCallbackUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeSsoCallbackUrl('data:text/html,xss')).toBe(false);
    expect(isSafeSsoCallbackUrl('')).toBe(false);
    expect(isSafeSsoCallbackUrl(null)).toBe(false);
  });

  it('prefers validated redirectUrl and builds safe fallback callbacks cleanly', () => {
    expect(
      buildSsoCallbackUrl({
        redirectUrl: 'exp://192.168.1.25:8081/--/oauth/callback?code=abc&state=st_1',
        redirectUri: 'exp://192.168.1.25:8081/--/oauth/callback',
        code: 'abc',
        state: 'st_1',
      }),
    ).toBe('exp://192.168.1.25:8081/--/oauth/callback?code=abc&state=st_1');

    expect(
      buildSsoCallbackUrl({
        redirectUrl: 'javascript:alert(1)',
        redirectUri: 'vanguard-dummy://oauth/callback',
        code: 'xyz',
        state: 'st_2',
      }),
    ).toBe('vanguard-dummy://oauth/callback?code=xyz&state=st_2');
  });
});
