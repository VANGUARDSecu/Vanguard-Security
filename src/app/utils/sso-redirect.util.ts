const ALLOWED_CUSTOM_MOBILE_SSO_SCHEMES = new Set([
  'vanguard-dummy:',
  'exp:',
  'mobilevanguard:',
  'vanguard-auth:',
  'vanguard-enroll:',
]);

const ALLOWED_SSO_CALLBACK_SCHEMES = new Set([
  'http:',
  'https:',
  ...ALLOWED_CUSTOM_MOBILE_SSO_SCHEMES,
]);

/**
 * Checks whether a URL uses an allowlisted non-HTTP(S) mobile custom scheme
 * (such as `vanguard-dummy://` for standalone APKs or `exp://` for Expo Go).
 */
export function isCustomMobileSchemeUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(rawUrl.trim());
    return ALLOWED_CUSTOM_MOBILE_SSO_SCHEMES.has(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Validates that an OIDC SSO callback target uses HTTP(S) or an explicitly
 * allowlisted custom mobile app scheme, rejecting `javascript:` or `data:`.
 */
export function isSafeSsoCallbackUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(rawUrl.trim());
    return ALLOWED_SSO_CALLBACK_SCHEMES.has(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Resolves and validates the OIDC authorization callback URL from either the
 * backend-provided `redirectUrl` or the client's `redirectUri` + `code` (+ `state`).
 */
export function buildSsoCallbackUrl(options: {
  redirectUrl?: string | null;
  redirectUri?: string | null;
  code?: string | null;
  state?: string | null;
}): string | null {
  const directUrl = options.redirectUrl?.trim();
  if (directUrl && isSafeSsoCallbackUrl(directUrl)) {
    return directUrl;
  }

  const baseUri = options.redirectUri?.trim();
  const code = options.code?.trim();
  if (!baseUri || !code || !isSafeSsoCallbackUrl(baseUri)) {
    return null;
  }

  const params = new URLSearchParams({ code });
  if (options.state) {
    params.set('state', options.state);
  }
  const separator = baseUri.includes('?') ? '&' : '?';
  return `${baseUri}${separator}${params.toString()}`;
}
