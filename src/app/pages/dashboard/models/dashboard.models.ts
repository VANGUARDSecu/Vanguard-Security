export interface ProtocolStatus {
  name: string;
  type: string;
  port: string;
  status: 'online' | 'standby' | 'healthy' | 'offline';
  description: string;
  badge: string;
  certExpiry?: string;
}

export interface SaaSApp {
  id: string;
  name: string;
  category: 'cloud' | 'developer' | 'collaboration' | 'custom';
  description: string;
  icon: string;
  protocol: 'SAML 2.0' | 'OIDC' | 'OAuth 2.0' | 'Web Auth' | 'Extension Autofill' | string;
  launchUrl: string;
  assigned: boolean;
  inheritedViaGroup?: string;
  status?: string;
  isIntegrated?: boolean;
  connectedUrl?: string;
  connectionStatus?: string;
  targetDomain?: string;
  requestedUsername?: string;
}

export interface UserConnectedApp {
  id: string;
  clientId: string;
  clientName: string;
  userEmail?: string;
  protocol: string;
  scopes: string[];
  redirectUri: string;
  originUrl: string;
  status: 'Connected' | 'Active' | 'Disconnected';
  connectedAt: string;
  lastActiveAt?: string;
  icon?: string;
  description?: string;
}

export type AccessRequestStatus = 'Pending Approval' | 'Approved' | 'Rejected';

export interface AppAccessRequest {
  id: string;
  tenantId?: string;
  userId: string;
  userName: string;
  userEmail: string;
  department: string;
  role: string;
  appName: string;
  protocol: 'SAML 2.0' | 'OIDC' | 'OAuth 2.0' | 'Web Auth' | 'Extension Autofill' | string;
  category: 'cloud' | 'developer' | 'collaboration' | 'custom';
  icon?: string;
  launchUrl?: string;
  targetDomain?: string;
  requestedUsername?: string;
  urgency?: 'Low' | 'Standard' | 'Critical';
  duration?: 'Permanent' | '30 Days' | '90 Days' | 'Temporary' | string;
  zeroKnowledgeProtected?: boolean;
  justification: string;
  status: AccessRequestStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNotes?: string;
}

export interface SignInEvent {
  id: string;
  timestamp: string;
  application: string;
  protocol: string;
  device: string;
  ip: string;
  location: string;
  status: 'success' | 'mfa_required' | 'blocked';
}

export interface UserSecurityAlertPreferences {
  secondaryEmail?: string;
  alertThreshold: 'all' | 'new_device';
  emailAlertsEnabled: boolean;
  updatedAt?: string;
}

export interface SSHKey {
  id: string;
  label: string;
  fingerprint: string;
  keyType: string;
  addedAt: string;
}

export interface GroupPolicy {
  requireMfa: boolean;
  mfaType?: 'any' | 'hardware_totp';
  sessionDurationHours: number;
}

export interface DirectoryGroup {
  id: string;
  name: string;
  description: string;
  department: string;
  email: string;
  memberIds: string[];
  appIds: string[];
  policy: GroupPolicy;
  createdAt: string;
  updatedAt?: string;
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
  mfaStatus: 'Enrolled (TOTP)' | 'Email OTP Only';
  accountStatus: 'Active' | 'Suspended' | 'Pending' | 'Expired';
  lastLogin: string;
  initials: string;
  temporaryPassword?: string;
  invitedAt?: string;
  expiresAt?: string;
  groups?: string[];
}

export type AuditEventType =
  | 'SSO_LOGIN'
  | 'RADIUS_AUTH'
  | 'LDAP_BIND'
  | 'USER_PROVISIONED'
  | 'PASSWORD_RESET'
  | 'POLICY_CHANGE'
  | 'SESSION_REVOKED'
  | 'MFA_CHALLENGE'
  | 'VAULT_ACCESS'
  | (string & {});

export type AuditSeverity = 'INFO' | 'WARN' | 'SECURITY_ALERT';

export interface AuditThreatIndicator {
  anomalyType: 'FAILED_LOGIN_BURST' | 'UNKNOWN_IP_RANGE' | 'ADMIN_ELEVATION' | 'UNUSUAL_GEO' | 'BRUTE_FORCE_THROTTLED' | (string & {});
  description: string;
  alertLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface TenantAuditEvent {
  id: string;
  action?: string;
  timestamp: string;
  actor: string;
  target: string;
  protocol: 'SAML 2.0' | 'OIDC' | 'LDAPS (636)' | 'RADIUS (1812)' | 'Web Portal' | (string & {});
  clientIp: string;
  location: string;
  device: string;
  status: 'success' | 'challenge' | 'blocked';
  riskScore: 'Low' | 'Medium' | 'High';
  eventType: AuditEventType;
  severity: AuditSeverity;
  userAgent?: string;
  tlsCipher?: string;
  requestId: string;
  threatIndicator?: AuditThreatIndicator;
  isoTimestamp?: string;
  rawPayload?: Record<string, any>;
  /**
   * SCRUM-133: provenance of this record. 'client-ui' events are generated in
   * the browser for immediate UX feedback and are NOT authoritative evidence;
   * authoritative records come from the server ('server'). The UI must label
   * client-ui events as local/unconfirmed.
   */
  source?: 'client-ui' | 'server';
  authoritative?: boolean;
}


export interface AttributeStatementMapping {
  userAttribute: string;
  samlClaim: string;
}

export interface AppCatalogTemplate {
  id: string;
  name: string;
  icon: string;
  protocol: 'SAML 2.0' | 'OIDC';
  category: 'cloud' | 'developer' | 'collaboration' | 'custom';
  description: string;
  defaultEntityId?: string;
  defaultAcsUrl?: string;
  defaultSloUrl?: string;
  defaultNameIdFormat?: string;
  defaultAttributeStatements?: AttributeStatementMapping[];
  defaultRedirectUris?: string[];
  defaultGrantTypes?: ('authorization_code' | 'client_credentials' | 'refresh_token')[];
  defaultScopes?: string[];
}

export interface SamlConnector {
  id: string;
  name: string;
  icon: string;
  protocol: 'SAML 2.0' | 'OIDC';
  entityId: string;
  acsUrl: string;
  sloUrl?: string;
  nameIdFormat: string;
  signResponse: boolean;
  signAssertion: boolean;
  attributeStatements?: AttributeStatementMapping[];
  catalogTemplateId?: string;
  status: 'Active' | 'Draft' | 'Inactive';
  assignedGroups: string[];
  lastSsoEvent?: string;
}

export interface OidcClient {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  revealed?: boolean;
  redirectUris: string[];
  grantTypes: ('authorization_code' | 'client_credentials' | 'refresh_token')[];
  allowedScopes: string[];
  assignedGroups?: string[];
  description?: string;
  status?: 'Active' | 'Draft' | 'Inactive';
  createdAt: string;
}

export interface IdpCertMetadata {
  subject: string;
  issuer: string;
  serialNumber: string;
  algorithm: string;
  validFrom: string;
  validUntil: string;
  daysRemaining: number;
  sha256Fingerprint: string;
  keySize: string;
}

export interface LdapHost {
  id: string;
  name: string;
  type: 'NAS Storage' | 'Linux Server Cluster' | 'Legacy Application';
  ipAddress: string;
  protocol: 'LDAPS (636)' | 'StartTLS (389)';
  status: 'Connected' | 'Offline';
  dailyBinds: number;
  bindUser: string;
  lastActive: string;
}

export interface LdapServiceAccount {
  id: string;
  name: string;
  bindDn: string;
  bindPassword: string;
  passwordRevealed?: boolean;
  applianceType: 'Synology NAS' | 'QNAP Storage' | 'Linux SSSD/PAM' | 'GitLab / Jira' | 'Legacy Application' | string;
  ipRestriction?: string;
  status: 'Active' | 'Revoked';
  createdAt: string;
  lastBind?: string;
}

export interface LdapTestResult {
  resultCode: number;
  resultName: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  latencyMs: number;
  tlsVersion: string;
  cipher: string;
  entriesFound: number;
  matchedDn?: string;
}

export interface RadiusAccessPoint {
  id: string;
  name: string;
  type:
    | 'Ubiquiti UniFi AP'
    | 'Cisco Meraki MR'
    | 'Aruba WPA3 Enterprise'
    | 'Cisco Catalyst 9100'
    | 'Palo Alto GlobalProtect'
    | 'pfSense VPN Gateway'
    | 'WireGuard Gateway'
    | 'Generic 802.1X NAS'
    | string;
  ipAddress: string;
  sharedSecret: string;
  status: 'Active' | 'Standby';
  lastAuthEvent: string;
  description?: string;
  authProtocol?: 'PAP' | 'MS-CHAPv2' | 'PEAP-MSCHAPv2' | 'EAP-TLS';
  secretRevealed?: boolean;
  cidrSubnet?: string;
}

export interface RadiusAuthActivityEvent {
  id: string;
  timestamp: string;
  clientMac: string;
  username: string;
  nasClientName: string;
  nasIp: string;
  protocol: 'PEAP-MSCHAPv2' | 'EAP-TLS' | 'PAP' | 'MS-CHAPv2';
  status: 'Access-Accept' | 'Access-Reject' | 'Access-Challenge';
  vlanId?: number;
  reason?: string;
}

export interface VlanMapping {
  department: string;
  vlanId: number;
  subnetCidr: string;
  description: string;
  isolated: boolean;
}

export interface EnrolledDevice {
  id: string;
  name: string;
  model: string;
  type: 'Mobile iOS' | 'Mobile Android' | 'macOS Workstation' | 'Windows Workstation';
  osVersion: string;
  ownerName: string;
  ownerEmail: string;
  department: string;
  biometricType: 'Face ID' | 'Touch ID' | 'Windows Hello' | 'Fingerprint' | 'None';
  diskEncrypted: boolean;
  jailbroken: boolean;
  edrActive: boolean;
  complianceStatus: 'Compliant' | 'Warning' | 'Revoked';
  enrolledAt: string;
  lastSync: string;
  ssoRevokedAt?: string;
  isCompromised?: boolean;
}

export interface MobilePolicyConfig {
  enforceNumberMatching: boolean;
  enforceBiometrics: boolean;
  blockJailbroken: boolean;
  inactivityLockoutMinutes: number;
  requireDiskEncryption?: boolean;
  enforceMinimumOs?: boolean;
}

export type EndpointCompliancePolicyConfig = MobilePolicyConfig;

export type WebhookEventType =
  | 'user.created'
  | 'user.deleted'
  | 'auth.success'
  | 'auth.failed'
  | 'mfa.denied'
  | 'policy.violated'
  | (string & {});

export interface WebhookEndpoint {
  id: string;
  url: string;
  description?: string;
  events: WebhookEventType[];
  signingSecret: string;
  secret?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  lastDeliveryStatus?: 'Delivered 200' | 'Failed 500' | 'Timeout' | 'Pending' | string;
  lastDeliveryAt?: string;
  lastStatusCode?: number;
  successCount: number;
  failureCount: number;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  url: string;
  event: WebhookEventType;
  timestamp: string;
  isoTimestamp?: string;
  status: 'success' | 'failed' | 'timeout' | string;
  statusCode: number;
  statusText?: string;
  latencyMs: number;
  attempts: number;
  requestHeaders?: Record<string, string>;
  requestPayload: Record<string, any>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  signature: string;
  isTest?: boolean;
  retryCount?: number;
}

export interface TenantOrganization {
  id: string;
  name: string;
  slug: string;
  tier: 'Enterprise' | 'Business' | 'Starter' | 'Trial' | 'Personal';
  domain?: string;
  logoUrl?: string;
  primaryContactEmail?: string;
  createdAt: string;
  memberCount: number;
  isCustomDomainVerified?: boolean;
}

export interface TenantBranding {
  organizationId: string;
  companyName: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryAccentColor: string;
  ssoCustomDomain: string;
  ssoDomainVerified: boolean;
  emailCustomGreeting?: string;
  emailButtonText?: string;
  supportEmail?: string;
}

export interface PersonalVaultItem {
  id: string;
  userId?: string;
  title: string;
  category: 'Login' | 'Card' | 'Identity' | 'Secure Note';
  username: string;
  password?: string;
  totpSecret?: string;
  url?: string;
  notes?: string;
  favorite?: boolean;
  updatedAt: string;
}

export interface TotpAccount {
  id: string;
  issuer: string;
  accountName: string;
  secret: string;
  digits?: 6 | 8;
  period?: 30 | 60;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
  icon?: string;
  currentCode?: string;
  remainingSeconds?: number;
}

