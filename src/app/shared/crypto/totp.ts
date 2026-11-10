/**
 * Real RFC 6238 TOTP (SCRUM-116) — shared with the browser extension's
 * totp-engine. Standards-compliant HMAC-SHA1 over the time counter using Web
 * Crypto, replacing the web app's prior non-standard hash so generated codes
 * actually match real services.
 */

export function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = (input || '').toUpperCase().replace(/=+$/g, '').replace(/[\s\-:_]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) throw new Error('Invalid Base32 character in TOTP secret.');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export interface TotpOptions {
  digits?: number;
  period?: number;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
  timestampMs?: number;
}

export interface ParsedOtpAuthUri {
  issuer: string;
  accountName: string;
  secret: string;
  digits: 6 | 8;
  period: 30 | 60;
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
}

/**
 * Parse a standard Google Authenticator / RFC 6238 otpauth://totp/ URI
 * from 3rd-party applications (Google, GitHub, Facebook, Figma, AWS, Discord, etc.)
 * or raw Base32 secret keys.
 */
export function parseOtpAuthUri(rawUri: string): ParsedOtpAuthUri {
  const trimmed = (rawUri || '').trim();
  if (!trimmed) {
    throw new Error('URI or secret key is required.');
  }

  // Gracefully support pasting raw Base32 secret keys directly
  if (!trimmed.toLowerCase().startsWith('otpauth:')) {
    const cleanSecret = trimmed.toUpperCase().replace(/=+$/g, '').replace(/[\s\-:_]/g, '');
    try {
      base32Decode(cleanSecret);
      return {
        issuer: 'External Service',
        accountName: 'Primary Account',
        secret: cleanSecret,
        digits: 6,
        period: 30,
        algorithm: 'SHA1',
      };
    } catch {
      throw new Error('Invalid URI or secret key format. Must be an otpauth://totp/... URI or Base32 secret key.');
    }
  }

  // Normalize URI to ensure standard otpauth://totp/ prefix
  const normalizedUri = trimmed
    .replace(/^otpauth:\/+(totp\/)?/i, 'otpauth://totp/')
    .replace(/^otpauth:totp\//i, 'otpauth://totp/');

  let parsed: URL;
  try {
    parsed = new URL(normalizedUri);
  } catch {
    throw new Error('Malformed otpauth:// URI.');
  }

  const secretParam = (parsed.searchParams.get('secret') || '').replace(/[\s\-:_]/g, '').toUpperCase();
  if (!secretParam) {
    throw new Error('otpauth:// URI is missing the required secret parameter.');
  }
  // Validate Base32 secret
  base32Decode(secretParam);

  const rawLabel = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').replace(/^totp\/+/i, ''));
  let issuerFromLabel = '';
  let accountName = rawLabel;
  if (rawLabel.includes(':')) {
    const [iss, ...rest] = rawLabel.split(':');
    issuerFromLabel = iss.trim();
    accountName = rest.join(':').trim();
  }

  let issuer = (parsed.searchParams.get('issuer') || issuerFromLabel).trim();
  if (!issuer) {
    if (accountName.includes('@')) {
      const domain = accountName.split('@')[1];
      const match = domain.split('.')[0];
      issuer = match ? match.charAt(0).toUpperCase() + match.slice(1) : 'External Service';
    } else {
      issuer = 'External Service';
    }
  }

  const digitsRaw = Number(parsed.searchParams.get('digits') || '6');
  const digits: 6 | 8 = digitsRaw === 8 ? 8 : 6;
  const periodRaw = Number(parsed.searchParams.get('period') || '30');
  const period: 30 | 60 = periodRaw === 60 ? 60 : 30;
  const algRaw = (parsed.searchParams.get('algorithm') || 'SHA1').toUpperCase().replace('-', '');
  const algorithm: 'SHA1' | 'SHA256' | 'SHA512' =
    algRaw === 'SHA256' ? 'SHA256' : algRaw === 'SHA512' ? 'SHA512' : 'SHA1';

  return {
    issuer,
    accountName: accountName || 'Primary Account',
    secret: secretParam,
    digits,
    period,
    algorithm,
  };
}

export function buildOtpAuthUri(acc: {
  issuer: string;
  accountName: string;
  secret: string;
  digits?: number;
  period?: number;
  algorithm?: string;
}): string {
  const iss = encodeURIComponent(acc.issuer.trim());
  const acct = encodeURIComponent((acc.accountName || 'Primary Account').trim());
  const sec = encodeURIComponent(acc.secret.replace(/\s+/g, '').toUpperCase());
  const digits = acc.digits || 6;
  const period = acc.period || 30;
  const algorithm = acc.algorithm || 'SHA1';
  return `otpauth://totp/${iss}:${acct}?secret=${sec}&issuer=${iss}&algorithm=${algorithm}&digits=${digits}&period=${period}`;
}

export async function generateTotp(base32Secret: string, opts: TotpOptions = {}): Promise<string> {
  const digits = opts.digits ?? 6;
  const period = opts.period ?? 30;
  const alg = opts.algorithm ?? 'SHA1';
  const webCryptoHash = alg === 'SHA256' ? 'SHA-256' : alg === 'SHA512' ? 'SHA-512' : 'SHA-1';
  const nowMs = opts.timestampMs ?? Date.now();
  const counter = Math.floor(nowMs / 1000 / period);

  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const keyBytes = base32Decode(base32Secret);
  const subtle = (globalThis.crypto as Crypto).subtle;
  const key = await subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'HMAC', hash: webCryptoHash },
    false,
    ['sign'],
  );
  const hmac = new Uint8Array(await subtle.sign('HMAC', key, counterBytes as unknown as BufferSource));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    (((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)) >>> 0;
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

export function secondsRemaining(period = 30, nowMs = Date.now()): number {
  return period - (Math.floor(nowMs / 1000) % period);
}
