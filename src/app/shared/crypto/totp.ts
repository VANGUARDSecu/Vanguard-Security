/**
 * Real RFC 6238 TOTP (SCRUM-116) — shared with the browser extension's
 * totp-engine. Standards-compliant HMAC-SHA1 over the time counter using Web
 * Crypto, replacing the web app's prior non-standard hash so generated codes
 * actually match real services.
 */

export function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = (input || '').toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
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
  timestampMs?: number;
}

export async function generateTotp(base32Secret: string, opts: TotpOptions = {}): Promise<string> {
  const digits = opts.digits ?? 6;
  const period = opts.period ?? 30;
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
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const hmac = new Uint8Array(await subtle.sign('HMAC', key, counterBytes as unknown as BufferSource));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

export function secondsRemaining(period = 30, nowMs = Date.now()): number {
  return period - (Math.floor(nowMs / 1000) % period);
}
