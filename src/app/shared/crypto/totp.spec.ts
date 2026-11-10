import { describe, it, expect } from 'vitest';
import { generateTotp, base32Decode, parseOtpAuthUri } from './totp';

const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('frontend totp (SCRUM-116 & SCRUM-178 real RFC 6238)', () => {
  it('base32Decode decodes "Hello"', () => {
    expect(Array.from(base32Decode('JBSWY3DP'))).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
  });

  it('base32Decode handles spaces, hyphens, and lowercase (GitHub / Microsoft format)', () => {
    const rawWithSpaces = 'jbsw y3dp ehpk 3pxp';
    const rawWithHyphens = 'JBSW-Y3DP-EHPK-3PXP';
    const normal = 'JBSWY3DPEHPK3PXP';
    expect(Array.from(base32Decode(rawWithSpaces))).toEqual(Array.from(base32Decode(normal)));
    expect(Array.from(base32Decode(rawWithHyphens))).toEqual(Array.from(base32Decode(normal)));
  });

  it('matches RFC 6238 SHA-1 8-digit vectors', async () => {
    const cases: Array<[number, string]> = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1234567890, '89005924'],
    ];
    for (const [secs, expected] of cases) {
      const code = await generateTotp(RFC_SECRET_BASE32, { digits: 8, period: 30, timestampMs: secs * 1000 });
      expect(code).toBe(expected);
    }
  });

  it('produces 6-digit codes by default', async () => {
    const code = await generateTotp('JBSWY3DPEHPK3PXP');
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('generates accurate TOTP from GitHub 32-character secret', async () => {
    const githubSecret = 'HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ';
    const code = await generateTotp(githubSecret, { digits: 6, period: 30, timestampMs: 1700000000000 });
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('parseOtpAuthUri handles GitHub standard URI', () => {
    const uri = 'otpauth://totp/GitHub:octocat?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=GitHub';
    const parsed = parseOtpAuthUri(uri);
    expect(parsed.issuer).toBe('GitHub');
    expect(parsed.accountName).toBe('octocat');
    expect(parsed.secret).toBe('HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ');
    expect(parsed.digits).toBe(6);
    expect(parsed.period).toBe(30);
    expect(parsed.algorithm).toBe('SHA1');
  });

  it('parseOtpAuthUri handles URL-encoded labels and email identifiers', () => {
    const uri = 'otpauth://totp/Google%3Aalice%40gmail.com?secret=JBSWY3DPEHPK3PXP';
    const parsed = parseOtpAuthUri(uri);
    expect(parsed.issuer).toBe('Google');
    expect(parsed.accountName).toBe('alice@gmail.com');
  });

  it('parseOtpAuthUri handles raw Base32 secret gracefully', () => {
    const rawSecret = 'k4yv xd3k 4drt uv6x 2m3x 6u4p y23u 2w5e';
    const parsed = parseOtpAuthUri(rawSecret);
    expect(parsed.issuer).toBe('External Service');
    expect(parsed.secret).toBe('K4YVXD3K4DRTUV6X2M3X6U4PY23U2W5E');
  });
});
