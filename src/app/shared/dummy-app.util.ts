/**
 * Applications permitted to be self-approved by a corporate tenant member
 * using their own Vanguard account (SCRUM-167).
 *
 * Restricted corporate SaaS apps (AWS, GitHub, Figma, Dummy Mobile Gateway, etc.)
 * still require Super Administrator approval (SCRUM-160).
 */
const SELF_APPROVABLE_DUMMY_IDENTIFIERS = [
  'vanguard-dummy-portal',
  'vg_client_b3121c514e83037d',
  'acme dummy portal',
  'acme dummy web',
  'dummy portal',
  'dummy web',
];

/** Returns true when the given clientId or application name identifies Acme Dummy Web. */
export function isSelfApprovableDummyApp(nameOrClientId?: string | null): boolean {
  const normalized = (nameOrClientId || '').trim().toLowerCase();
  if (!normalized) return false;
  return SELF_APPROVABLE_DUMMY_IDENTIFIERS.some(
    (id) => normalized === id || normalized.includes(id),
  );
}
