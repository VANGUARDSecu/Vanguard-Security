const ALLOWED_MOBILE_SCHEMES = new Set([
  'mobilevanguard:',
  'vanguard-auth:',
  'vanguard-enroll:',
  'exp:',
]);

export const DEFAULT_MOBILE_OAUTH_REDIRECT = 'mobilevanguard://login';

/**
 * Validates that a mobile OAuth deep-link target uses an explicitly allowlisted
 * Vanguard mobile scheme (rejecting web origins, javascript:, data:, etc.).
 */
export function isAllowedMobileRedirectUri(rawUri: string | null | undefined): boolean {
  if (!rawUri || typeof rawUri !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(rawUri.trim());
    return ALLOWED_MOBILE_SCHEMES.has(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Builds the mobile deep-link callback URL from the current browser query/hash,
 * preserving OAuth tokens in the hash and safe OAuth query params (`code`, `state`, `error`).
 */
export function buildMobileOAuthDeepLink(options: {
  search?: string;
  hash?: string;
  defaultRedirect?: string;
}): string {
  const defaultRedirect = options.defaultRedirect || DEFAULT_MOBILE_OAUTH_REDIRECT;
  const searchParams = new URLSearchParams(options.search || '');
  const candidateRedirect = searchParams.get('mobile_redirect');
  const targetBase = isAllowedMobileRedirectUri(candidateRedirect)
    ? candidateRedirect!.trim()
    : defaultRedirect;

  const forwardedParams = new URLSearchParams();
  for (const key of ['code', 'state', 'error', 'error_description']) {
    const val = searchParams.get(key);
    if (val) {
      forwardedParams.set(key, val);
    }
  }

  const queryString = forwardedParams.toString();
  const rawHash = options.hash || '';
  const normalizedHash = rawHash && !rawHash.startsWith('#') ? `#${rawHash}` : rawHash;
  const separator = queryString ? (targetBase.includes('?') ? '&' : '?') : '';

  return `${targetBase}${separator}${queryString}${normalizedHash}`;
}
