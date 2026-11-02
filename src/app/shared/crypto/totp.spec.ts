import { describe, it, expect } from 'vitest';
import { generateTotp, base32Decode } from './totp';

const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('frontend totp (SCRUM-116 real RFC 6238)', () => {
  it('base32Decode decodes "Hello"', () => {
    expect(Array.from(base32Decode('JBSWY3DP'))).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
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
});
