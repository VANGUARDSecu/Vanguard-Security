import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from './services/dashboard.service';
import { DashboardHeader } from './components/header/header';
import { DashboardSidebar } from './components/sidebar/sidebar';
import { AdminOverview } from './components/admin-overview/admin-overview';
import { AdminDirectory } from './components/admin-directory/admin-directory';
import { AdminSamlOidc } from './components/admin-saml-oidc/admin-saml-oidc';
import { AdminCloudLdap } from './components/admin-cloud-ldap/admin-cloud-ldap';
import { AdminCloudRadius } from './components/admin-cloud-radius/admin-cloud-radius';
import { AdminAuditLogs } from './components/admin-audit-logs/admin-audit-logs';
import { AdminWebhooks } from './components/admin-webhooks/admin-webhooks';
import { AdminDeviceFleet } from './components/admin-device-fleet/admin-device-fleet';
import { AdminSettings } from './components/admin-settings/admin-settings';
import { UserMyApps } from './components/user-my-apps/user-my-apps';
import { UserSecurity } from './components/user-security/user-security';
import { UserNetwork } from './components/user-network/user-network';
import { UserSsh } from './components/user-ssh/user-ssh';
import { UserActivity } from './components/user-activity/user-activity';
import { UserDevices } from './components/user-devices/user-devices';
import { UserPersonalVault } from './components/user-personal-vault/user-personal-vault';
import { UserAuthenticator } from './components/user-authenticator/user-authenticator';
import {
  ProtocolStatus,
  SaaSApp,
  SignInEvent,
  SSHKey,
  DirectoryUser,
  TenantAuditEvent,
  SamlConnector,
  OidcClient,
  IdpCertMetadata,
  LdapHost,
  LdapServiceAccount,
  LdapTestResult,
  RadiusAccessPoint,
  VlanMapping,
  EnrolledDevice,
  MobilePolicyConfig,
  AppAccessRequest,
  AccessRequestStatus,
} from './models/dashboard.models';

export type {
  ProtocolStatus,
  SaaSApp,
  SignInEvent,
  SSHKey,
  DirectoryUser,
  TenantAuditEvent,
  SamlConnector,
  OidcClient,
  IdpCertMetadata,
  LdapHost,
  LdapServiceAccount,
  LdapTestResult,
  RadiusAccessPoint,
  VlanMapping,
  EnrolledDevice,
  MobilePolicyConfig,
  AppAccessRequest,
  AccessRequestStatus,
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DashboardHeader,
    DashboardSidebar,
    AdminOverview,
    AdminDirectory,
    AdminSamlOidc,
    AdminCloudLdap,
    AdminCloudRadius,
    AdminAuditLogs,
    AdminWebhooks,
    AdminDeviceFleet,
    AdminSettings,
    UserMyApps,
    UserSecurity,
    UserNetwork,
    UserSsh,
    UserActivity,
    UserDevices,
    UserPersonalVault,
    UserAuthenticator,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  readonly dashboardService = inject(DashboardService);

  ngOnInit(): void {
    this.dashboardService.initDashboardForCurrentUser();
    // SCRUM-94: source company apps from the backend for company accounts.
    this.dashboardService.loadCompanyApps();
  }

  // Authentication & Session
  readonly user = this.dashboardService.user;
  readonly userRole = this.dashboardService.userRole;
  readonly isAdmin = this.dashboardService.isAdmin;
  readonly isIndividual = this.dashboardService.isIndividual;
  readonly isPersonalWorkspace = this.dashboardService.isPersonalWorkspace;
  readonly viewMode = this.dashboardService.viewMode;
  readonly activeTab = this.dashboardService.activeTab;
  readonly copiedUserId = this.dashboardService.copiedUserId;
  readonly sessionRevoked = this.dashboardService.sessionRevoked;
  readonly adminActionNotice = this.dashboardService.adminActionNotice;

  get searchQuery() { return this.dashboardService.searchQuery; }
  set searchQuery(v: string) { this.dashboardService.searchQuery = v; }

  // Directory Management (Phase 3)
  readonly directoryDepartmentFilter = this.dashboardService.directoryDepartmentFilter;
  readonly availableDepartments = this.dashboardService.availableDepartments;
  readonly availableRoles = this.dashboardService.availableRoles;
  readonly directoryStatusFilter = this.dashboardService.directoryStatusFilter;
  readonly directorySearch = this.dashboardService.directorySearch;
  readonly directoryUsers = this.dashboardService.directoryUsers;
  readonly filteredDirectoryUsers = this.dashboardService.filteredDirectoryUsers;
  readonly showInviteModal = this.dashboardService.showInviteModal;
  readonly inviteSuccess = this.dashboardService.inviteSuccess;
  readonly inviteError = this.dashboardService.inviteError;
  readonly inviteCreatedUser = this.dashboardService.inviteCreatedUser;
  readonly existingPendingUser = this.dashboardService.existingPendingUser;
  readonly passwordCopied = this.dashboardService.passwordCopied;

  get inviteFirstName() { return this.dashboardService.inviteFirstName; }
  set inviteFirstName(v: string) { this.dashboardService.inviteFirstName = v; }
  get inviteLastName() { return this.dashboardService.inviteLastName; }
  set inviteLastName(v: string) { this.dashboardService.inviteLastName = v; }
  get inviteEmail() { return this.dashboardService.inviteEmail; }
  set inviteEmail(v: string) { this.dashboardService.inviteEmail = v; }
  get invitePassword() { return this.dashboardService.invitePassword; }
  set invitePassword(v: string) { this.dashboardService.invitePassword = v; }
  get inviteDepartment(): string { return this.dashboardService.inviteDepartment; }
  set inviteDepartment(v: string) { this.dashboardService.inviteDepartment = v; }
  get inviteRole(): string { return this.dashboardService.inviteRole; }
  set inviteRole(v: string) { this.dashboardService.inviteRole = v; }

  // User Groups & App Matrix (SCRUM-25)
  readonly directoryActiveSubTab = this.dashboardService.directoryActiveSubTab;
  readonly directoryGroups = this.dashboardService.directoryGroups;
  readonly directoryGroupSearch = this.dashboardService.directoryGroupSearch;
  readonly filteredDirectoryGroups = this.dashboardService.filteredDirectoryGroups;
  readonly showGroupModal = this.dashboardService.showGroupModal;
  readonly editingGroup = this.dashboardService.editingGroup;
  readonly groupModalActiveTab = this.dashboardService.groupModalActiveTab;
  readonly groupFormMemberIds = this.dashboardService.groupFormMemberIds;
  readonly groupFormAppIds = this.dashboardService.groupFormAppIds;
  readonly groupFormSuccess = this.dashboardService.groupFormSuccess;
  readonly groupFormError = this.dashboardService.groupFormError;
  get groupFormName() { return this.dashboardService.groupFormName; }
  set groupFormName(v: string) { this.dashboardService.groupFormName = v; }
  get groupFormDescription() { return this.dashboardService.groupFormDescription; }
  set groupFormDescription(v: string) { this.dashboardService.groupFormDescription = v; }
  get groupFormDepartment() { return this.dashboardService.groupFormDepartment; }
  set groupFormDepartment(v: string) { this.dashboardService.groupFormDepartment = v; }
  get groupFormEmail() { return this.dashboardService.groupFormEmail; }
  set groupFormEmail(v: string) { this.dashboardService.groupFormEmail = v; }

  // Audit Logs (Phase 3 & SCRUM-26)
  readonly auditStatusFilter = this.dashboardService.auditStatusFilter;
  readonly auditProtocolFilter = this.dashboardService.auditProtocolFilter;
  readonly auditEventTypeFilter = this.dashboardService.auditEventTypeFilter;
  readonly auditSeverityFilter = this.dashboardService.auditSeverityFilter;
  readonly auditDateRangeFilter = this.dashboardService.auditDateRangeFilter;
  readonly auditThreatsOnlyFilter = this.dashboardService.auditThreatsOnlyFilter;
  readonly auditSearchQuery = this.dashboardService.auditSearchQuery;
  readonly tenantAuditEvents = this.dashboardService.tenantAuditEvents;
  readonly filteredAuditEvents = this.dashboardService.filteredAuditEvents;
  readonly paginatedAuditEvents = this.dashboardService.paginatedAuditEvents;
  readonly auditCurrentPage = this.dashboardService.auditCurrentPage;
  readonly auditPageSize = this.dashboardService.auditPageSize;
  readonly auditTotalPages = this.dashboardService.auditTotalPages;
  readonly selectedAuditEvent = this.dashboardService.selectedAuditEvent;
  readonly showAuditInspector = this.dashboardService.showAuditInspector;

  // Vault Policies & Killswitch (Phase 3)
  readonly enforceMfaAll = this.dashboardService.enforceMfaAll;
  readonly blockHighRiskIps = this.dashboardService.blockHighRiskIps;
  readonly sessionTimeoutMinutes = this.dashboardService.sessionTimeoutMinutes;
  readonly showGlobalKillswitchModal = this.dashboardService.showGlobalKillswitchModal;
  readonly globalKillswitchSuccess = this.dashboardService.globalKillswitchSuccess;

  // SAML 2.0 & OIDC Web Federation (Phase 4)
  readonly samlSubTab = this.dashboardService.samlSubTab;
  readonly idpCert = this.dashboardService.idpCert;
  readonly federatedSamlConnectors = this.dashboardService.federatedSamlConnectors;
  readonly oidcClients = this.dashboardService.oidcClients;
  readonly showAddAppModal = this.dashboardService.showAddAppModal;
  readonly addAppSuccess = this.dashboardService.addAppSuccess;
  readonly addAppError = this.dashboardService.addAppError;
  readonly showRotateCertModal = this.dashboardService.showRotateCertModal;
  readonly rotateCertSuccess = this.dashboardService.rotateCertSuccess;
  readonly sandboxAssertionGenerated = this.dashboardService.sandboxAssertionGenerated;
  readonly copiedAssertion = this.dashboardService.copiedAssertion;

  get newAppName() { return this.dashboardService.newAppName; }
  set newAppName(v: string) { this.dashboardService.newAppName = v; }
  get newAppProtocol() { return this.dashboardService.newAppProtocol; }
  set newAppProtocol(v: 'SAML 2.0' | 'OIDC') { this.dashboardService.newAppProtocol = v; }
  get newAppEntityId() { return this.dashboardService.newAppEntityId; }
  set newAppEntityId(v: string) { this.dashboardService.newAppEntityId = v; }
  get newAppAcsUrl() { return this.dashboardService.newAppAcsUrl; }
  set newAppAcsUrl(v: string) { this.dashboardService.newAppAcsUrl = v; }
  get newAppDepartment() { return this.dashboardService.newAppDepartment; }
  set newAppDepartment(v: string) { this.dashboardService.newAppDepartment = v; }
  get sandboxSelectedUserId() { return this.dashboardService.sandboxSelectedUserId; }
  set sandboxSelectedUserId(v: string) { this.dashboardService.sandboxSelectedUserId = v; }
  get sandboxSelectedAppId() { return this.dashboardService.sandboxSelectedAppId; }
  set sandboxSelectedAppId(v: string) { this.dashboardService.sandboxSelectedAppId = v; }
  get sandboxInspectorMode() { return this.dashboardService.sandboxInspectorMode; }
  set sandboxInspectorMode(v: 'saml' | 'oidc') { this.dashboardService.sandboxInspectorMode = v; }

  // SCRUM-42: Access Requests Signals & Actions
  readonly appAccessRequests = this.dashboardService.appAccessRequests;
  readonly filteredAccessRequests = this.dashboardService.filteredAccessRequests;
  readonly pendingAccessRequests = this.dashboardService.pendingAccessRequests;
  readonly pendingAccessRequestsCount = this.dashboardService.pendingAccessRequestsCount;
  readonly accessRequestStatusFilter = this.dashboardService.accessRequestStatusFilter;
  readonly myAccessRequests = this.dashboardService.myAccessRequests;

  get accessRequestSearch() { return this.dashboardService.accessRequestSearch(); }
  set accessRequestSearch(v: string) { this.dashboardService.accessRequestSearch.set(v); }

  openAccessRequestsQueue() { this.dashboardService.openAccessRequestsQueue(); }
  setAccessRequestStatusFilter(f: 'all' | 'Pending Approval' | 'Approved' | 'Rejected') {
    this.dashboardService.setAccessRequestStatusFilter(f);
  }
  approveAccessRequest(id: string, notes?: string) {
    this.dashboardService.approveAccessRequest(id, notes);
  }
  rejectAccessRequest(id: string, notes?: string) {
    this.dashboardService.rejectAccessRequest(id, notes);
  }

  // Cloud LDAP Directory (Phase 5)
  readonly ldapAdminPassword = this.dashboardService.ldapAdminPassword;
  readonly ldapAdminPwRevealed = this.dashboardService.ldapAdminPwRevealed;
  readonly ldapReadonlyPassword = this.dashboardService.ldapReadonlyPassword;
  readonly ldapReadonlyPwRevealed = this.dashboardService.ldapReadonlyPwRevealed;
  readonly ldapHosts = this.dashboardService.ldapHosts;
  readonly showAddLdapHostModal = this.dashboardService.showAddLdapHostModal;
  readonly addLdapHostSuccess = this.dashboardService.addLdapHostSuccess;
  readonly addLdapHostError = this.dashboardService.addLdapHostError;
  readonly ldapDiagRunning = this.dashboardService.ldapDiagRunning;
  readonly ldapDiagExecuted = this.dashboardService.ldapDiagExecuted;
  readonly copiedLdapLog = this.dashboardService.copiedLdapLog;

  get newLdapHostName() { return this.dashboardService.newLdapHostName; }
  set newLdapHostName(v: string) { this.dashboardService.newLdapHostName = v; }
  get newLdapHostType() { return this.dashboardService.newLdapHostType; }
  set newLdapHostType(v: any) { this.dashboardService.newLdapHostType = v; }
  get newLdapHostIp() { return this.dashboardService.newLdapHostIp; }
  set newLdapHostIp(v: string) { this.dashboardService.newLdapHostIp = v; }
  get newLdapHostProtocol() { return this.dashboardService.newLdapHostProtocol; }
  set newLdapHostProtocol(v: any) { this.dashboardService.newLdapHostProtocol = v; }

  // Connection Configuration & Service Accounts (SCRUM-24)
  readonly ldapServerHost = this.dashboardService.ldapServerHost;
  readonly ldapPortLdaps = this.dashboardService.ldapPortLdaps;
  readonly ldapPortStartTls = this.dashboardService.ldapPortStartTls;
  readonly ldapBaseDn = this.dashboardService.ldapBaseDn;
  readonly ldapOrgDn = this.dashboardService.ldapOrgDn;
  readonly ldapUsersOu = this.dashboardService.ldapUsersOu;
  readonly ldapGroupsOu = this.dashboardService.ldapGroupsOu;
  readonly ldapServicesOu = this.dashboardService.ldapServicesOu;
  readonly copiedLdapParamNotice = this.dashboardService.copiedLdapParamNotice;
  readonly ldapCaCertPem = this.dashboardService.ldapCaCertPem;

  readonly ldapServiceAccounts = this.dashboardService.ldapServiceAccounts;
  readonly showAddServiceAccountModal = this.dashboardService.showAddServiceAccountModal;
  readonly newSvcAcctPassword = this.dashboardService.newSvcAcctPassword;
  readonly newSvcAcctPwRevealed = this.dashboardService.newSvcAcctPwRevealed;
  readonly addServiceAccountSuccess = this.dashboardService.addServiceAccountSuccess;
  readonly addServiceAccountError = this.dashboardService.addServiceAccountError;

  get newSvcAcctName() { return this.dashboardService.newSvcAcctName; }
  set newSvcAcctName(v: string) { this.dashboardService.newSvcAcctName = v; }
  get newSvcAcctUid() { return this.dashboardService.newSvcAcctUid; }
  set newSvcAcctUid(v: string) { this.dashboardService.newSvcAcctUid = v; }
  get newSvcAcctType() { return this.dashboardService.newSvcAcctType; }
  set newSvcAcctType(v: any) { this.dashboardService.newSvcAcctType = v; }
  get newSvcAcctIpRestriction() { return this.dashboardService.newSvcAcctIpRestriction; }
  set newSvcAcctIpRestriction(v: string) { this.dashboardService.newSvcAcctIpRestriction = v; }

  get ldapDiagEndpoint() { return this.dashboardService.ldapDiagEndpoint; }
  set ldapDiagEndpoint(v: string) { this.dashboardService.ldapDiagEndpoint = v; }
  get ldapDiagBindDn() { return this.dashboardService.ldapDiagBindDn; }
  set ldapDiagBindDn(v: string) { this.dashboardService.ldapDiagBindDn = v; }
  get ldapDiagBindPassword() { return this.dashboardService.ldapDiagBindPassword; }
  set ldapDiagBindPassword(v: string) { this.dashboardService.ldapDiagBindPassword = v; }
  get ldapDiagSearchBase() { return this.dashboardService.ldapDiagSearchBase; }
  set ldapDiagSearchBase(v: string) { this.dashboardService.ldapDiagSearchBase = v; }
  get ldapDiagFilter() { return this.dashboardService.ldapDiagFilter; }
  set ldapDiagFilter(v: string) { this.dashboardService.ldapDiagFilter = v; }
  readonly ldapTestResult = this.dashboardService.ldapTestResult;

  // Cloud RADIUS Gateway (Phase 5)
  readonly radiusSharedSecret = this.dashboardService.radiusSharedSecret;
  readonly radiusSecretRevealed = this.dashboardService.radiusSecretRevealed;
  readonly radiusSecretDaysRemaining = this.dashboardService.radiusSecretDaysRemaining;
  readonly radiusAccessPoints = this.dashboardService.radiusAccessPoints;
  readonly vlanMappings = this.dashboardService.vlanMappings;
  readonly showAddRadiusApModal = this.dashboardService.showAddRadiusApModal;
  readonly addRadiusApSuccess = this.dashboardService.addRadiusApSuccess;
  readonly addRadiusApError = this.dashboardService.addRadiusApError;
  readonly showRotateRadiusSecretModal = this.dashboardService.showRotateRadiusSecretModal;
  readonly rotateRadiusSecretSuccess = this.dashboardService.rotateRadiusSecretSuccess;
  readonly radiusDiagRunning = this.dashboardService.radiusDiagRunning;
  readonly radiusDiagExecuted = this.dashboardService.radiusDiagExecuted;
  readonly copiedRadiusLog = this.dashboardService.copiedRadiusLog;

  get newRadiusApName() { return this.dashboardService.newRadiusApName; }
  set newRadiusApName(v: string) { this.dashboardService.newRadiusApName = v; }
  get newRadiusApType() { return this.dashboardService.newRadiusApType; }
  set newRadiusApType(v: any) { this.dashboardService.newRadiusApType = v; }
  get newRadiusApIp() { return this.dashboardService.newRadiusApIp; }
  set newRadiusApIp(v: string) { this.dashboardService.newRadiusApIp = v; }
  get newRadiusApDesc() { return this.dashboardService.newRadiusApDesc; }
  set newRadiusApDesc(v: string) { this.dashboardService.newRadiusApDesc = v; }
  get newRadiusApProtocol() { return this.dashboardService.newRadiusApProtocol; }
  set newRadiusApProtocol(v: any) { this.dashboardService.newRadiusApProtocol = v; }
  readonly newRadiusApSecret = this.dashboardService.newRadiusApSecret;
  readonly newRadiusApSecretRevealed = this.dashboardService.newRadiusApSecretRevealed;
  readonly copiedRadiusSecretNotice = this.dashboardService.copiedRadiusSecretNotice;
  readonly radiusAuthActivity = this.dashboardService.radiusAuthActivity;
  readonly radiusActivityFilter = this.dashboardService.radiusActivityFilter;
  readonly filteredRadiusActivity = this.dashboardService.filteredRadiusActivity;
  get editingRadiusApId() { return this.dashboardService.editingRadiusApId; }

  // Mobile Companion & Fleet MDM (Phase 6)
  readonly userDevices = this.dashboardService.userDevices;
  readonly fleetDevices = this.dashboardService.fleetDevices;
  readonly mobilePolicy = this.dashboardService.mobilePolicy;
  readonly showPairDeviceModal = this.dashboardService.showPairDeviceModal;
  readonly newPairingToken = this.dashboardService.newPairingToken;
  readonly newPairingKey = this.dashboardService.newPairingKey;
  readonly pairDeviceSuccess = this.dashboardService.pairDeviceSuccess;
  readonly showPushSimulatorModal = this.dashboardService.showPushSimulatorModal;
  readonly simulatedPushStep = this.dashboardService.simulatedPushStep;
  readonly simulatedChallengeNumber = this.dashboardService.simulatedChallengeNumber;
  readonly simulatedCandidateNumbers = this.dashboardService.simulatedCandidateNumbers;
  readonly simulatedSelectedNumber = this.dashboardService.simulatedSelectedNumber;
  readonly simulatedBiometricScanning = this.dashboardService.simulatedBiometricScanning;
  readonly showWipeDeviceModal = this.dashboardService.showWipeDeviceModal;
  readonly selectedDeviceForWipe = this.dashboardService.selectedDeviceForWipe;
  readonly wipeDeviceSuccess = this.dashboardService.wipeDeviceSuccess;

  // User Portal & Phase 2 Apps
  readonly selectedCategory = this.dashboardService.selectedCategory;
  readonly ssoLaunchingNotice = this.dashboardService.ssoLaunchingNotice;
  readonly showRequestAppModal = this.dashboardService.showRequestAppModal;
  readonly requestAppSuccess = this.dashboardService.requestAppSuccess;

  get requestedAppName() { return this.dashboardService.requestedAppName; }
  set requestedAppName(v: string) { this.dashboardService.requestedAppName = v; }
  get requestAppJustification() { return this.dashboardService.requestAppJustification; }
  set requestAppJustification(v: string) { this.dashboardService.requestAppJustification = v; }

  readonly apps = this.dashboardService.apps;
  readonly filteredApps = this.dashboardService.filteredApps;

  // TOTP & Recovery
  readonly hasTotpEnrolled = this.dashboardService.hasTotpEnrolled;
  readonly showEnrollTotpModal = this.dashboardService.showEnrollTotpModal;
  readonly totpQrUrl = this.dashboardService.totpQrUrl;
  readonly totpSecret = this.dashboardService.totpSecret;

  get totpVerifyCode() { return this.dashboardService.totpVerifyCode; }
  set totpVerifyCode(v: string) { this.dashboardService.totpVerifyCode = v; }

  readonly totpEnrollError = this.dashboardService.totpEnrollError;
  readonly totpEnrollSuccess = this.dashboardService.totpEnrollSuccess;
  readonly recoveryCodes = this.dashboardService.recoveryCodes;
  readonly copiedCodes = this.dashboardService.copiedCodes;
  readonly showPasswordModal = this.dashboardService.showPasswordModal;
  readonly passwordUpdateError = this.dashboardService.passwordUpdateError;
  readonly passwordUpdateSuccess = this.dashboardService.passwordUpdateSuccess;
  readonly isSubmittingPassword = this.dashboardService.isSubmittingPassword;

  // SSH Keys & Sign-In History
  readonly ldapBindDn = this.dashboardService.ldapBindDn;
  readonly sshKeys = this.dashboardService.sshKeys;
  readonly sshKeyError = this.dashboardService.sshKeyError;
  readonly sshKeySuccess = this.dashboardService.sshKeySuccess;

  get newKeyLabel() { return this.dashboardService.newKeyLabel; }
  set newKeyLabel(v: string) { this.dashboardService.newKeyLabel = v; }
  get newKeyContent() { return this.dashboardService.newKeyContent; }
  set newKeyContent(v: string) { this.dashboardService.newKeyContent = v; }

  readonly signInHistory = this.dashboardService.signInHistory;
  readonly protocols = this.dashboardService.protocols;

  // Computed Properties
  readonly displayName = this.dashboardService.displayName;
  readonly userInitials = this.dashboardService.userInitials;
  readonly organizationName = this.dashboardService.organizationName;
  readonly userRoleLabel = this.dashboardService.userRoleLabel;
  readonly userPhone = this.dashboardService.userPhone;
  readonly clientInfo = this.dashboardService.clientInfo;
  readonly simulatedSamlXml = this.dashboardService.simulatedSamlXml;
  readonly simulatedOidcJwtHeader = this.dashboardService.simulatedOidcJwtHeader;
  readonly simulatedOidcJwtPayload = this.dashboardService.simulatedOidcJwtPayload;
  readonly ldapDiagLog = this.dashboardService.ldapDiagLog;
  readonly radiusDiagLog = this.dashboardService.radiusDiagLog;

  // Methods
  toggleViewMode(mode?: 'admin' | 'user') { const target = mode ?? (this.viewMode() === 'admin' ? 'user' : 'admin'); return this.dashboardService.toggleViewMode(target); }
  setActiveTab(tab: string) { return this.dashboardService.setActiveTab(tab); }
  setCategory(category: 'all' | 'cloud' | 'developer' | 'collaboration') { return this.dashboardService.setCategory(category); }
  setDirectoryDepartment(department: string) { return this.dashboardService.setDirectoryDepartment(department); }
  setDirectoryStatus(status: string) { return this.dashboardService.setDirectoryStatus(status); }
  suspendUser(user: DirectoryUser) { return this.dashboardService.suspendUser(user); }
  reactivateUser(user: DirectoryUser) { return this.dashboardService.reactivateUser(user); }
  changeUserRole(user: DirectoryUser, role: 'Super Administrator' | 'Security Officer' | 'Directory Member') { return this.dashboardService.changeUserRole(user, role); }
  forceUserPasswordReset(user: DirectoryUser) { return this.dashboardService.forceUserPasswordReset(user); }
  adminRevokeUserSessions(user: DirectoryUser) { return this.dashboardService.adminRevokeUserSessions(user); }
  openInviteModal() { return this.dashboardService.openInviteModal(); }
  closeInviteModal() { return this.dashboardService.closeInviteModal(); }
  submitInviteUser() { return this.dashboardService.submitInviteUser(); }
  resendInvitation(user: DirectoryUser) { return this.dashboardService.resendInvitation(user); }
  renewExistingPendingUser() { return this.dashboardService.renewExistingPendingUser(); }
  getInviteExpiryText(user: DirectoryUser) { return this.dashboardService.getInviteExpiryText(user); }
  generateRandomPassword() { return this.dashboardService.generateRandomPassword(); }
  copyTemporaryPassword() { return this.dashboardService.copyTemporaryPassword(); }
  setDirectoryActiveSubTab(tab: 'users' | 'groups') { return this.dashboardService.setDirectoryActiveSubTab(tab); }
  setGroupModalActiveTab(tab: 'details' | 'members' | 'apps' | 'policies') { return this.dashboardService.setGroupModalActiveTab(tab); }
  openCreateGroupModal() { return this.dashboardService.openCreateGroupModal(); }
  openEditGroupModal(group: any) { return this.dashboardService.openEditGroupModal(group); }
  closeGroupModal() { return this.dashboardService.closeGroupModal(); }
  toggleGroupFormMember(userId: string) { return this.dashboardService.toggleGroupFormMember(userId); }
  toggleGroupFormApp(appId: string) { return this.dashboardService.toggleGroupFormApp(appId); }
  saveGroup() { return this.dashboardService.saveGroup(); }
  deleteGroup(groupId: string) { return this.dashboardService.deleteGroup(groupId); }
  setAuditStatus(status: string) { return this.dashboardService.setAuditStatus(status); }
  setAuditProtocol(protocol: string) { return this.dashboardService.setAuditProtocol(protocol); }
  setAuditEventType(type: string) { return this.dashboardService.setAuditEventType(type); }
  setAuditSeverity(sev: string) { return this.dashboardService.setAuditSeverity(sev); }
  setAuditDateRange(range: string) { return this.dashboardService.setAuditDateRange(range); }
  toggleAuditThreatsOnly() { return this.dashboardService.toggleAuditThreatsOnly(); }
  resetAuditFilters() { return this.dashboardService.resetAuditFilters(); }
  setAuditPage(p: number) { return this.dashboardService.setAuditPage(p); }
  setAuditPageSize(size: number) { return this.dashboardService.setAuditPageSize(size); }
  openAuditInspector(evt: TenantAuditEvent) { return this.dashboardService.openAuditInspector(evt); }
  closeAuditInspector() { return this.dashboardService.closeAuditInspector(); }
  exportAuditLogs() { return this.dashboardService.exportAuditLogs(); }
  toggleEnforceMfa() { return this.dashboardService.toggleEnforceMfa(); }
  toggleBlockHighRiskIps() { return this.dashboardService.toggleBlockHighRiskIps(); }
  openGlobalKillswitchModal() { return this.dashboardService.openGlobalKillswitchModal(); }
  closeGlobalKillswitchModal() { return this.dashboardService.closeGlobalKillswitchModal(); }
  executeGlobalKillswitch() { return this.dashboardService.executeGlobalKillswitch(); }
  setSamlSubTab(tab: 'apps' | 'idp-metadata' | 'oidc-clients' | 'sso-sandbox') { return this.dashboardService.setSamlSubTab(tab); }
  downloadIdpMetadataXml() { return this.dashboardService.downloadIdpMetadataXml(); }
  downloadX509Cert() { return this.dashboardService.downloadX509Cert(); }
  copyCertFingerprint() { return this.dashboardService.copyCertFingerprint(); }
  openRotateCertModal() { return this.dashboardService.openRotateCertModal(); }
  closeRotateCertModal() { return this.dashboardService.closeRotateCertModal(); }
  executeRotateCert() { return this.dashboardService.executeRotateCert(); }
  openAddAppModal() { return this.dashboardService.openAddAppModal(); }
  closeAddAppModal() { return this.dashboardService.closeAddAppModal(); }
  submitAddAppConnector() { return this.dashboardService.submitAddAppConnector(); }
  deleteAppConnector(conn: string | SamlConnector) { const id = typeof conn === 'string' ? conn : conn.id; return this.dashboardService.deleteAppConnector(id); }
  toggleAppConnectorStatus(conn: SamlConnector) { return this.dashboardService.toggleAppConnectorStatus(conn); }
  toggleRevealClientSecret(client: OidcClient) { return this.dashboardService.toggleRevealClientSecret(client); }
  regenerateClientSecret(client: OidcClient) { return this.dashboardService.regenerateClientSecret(client); }
  copySimulatedAssertion() { return this.dashboardService.copySimulatedAssertion(); }
  runLdapBindTest() { return this.dashboardService.runLdapBindTest(); }
  copyLdapDiagLog() { return this.dashboardService.copyLdapDiagLog(); }
  toggleLdapAdminPwRevealed() { return this.dashboardService.toggleLdapAdminPwRevealed(); }
  toggleLdapReadonlyPwRevealed() { return this.dashboardService.toggleLdapReadonlyPwRevealed(); }
  regenerateLdapPasswords() { return this.dashboardService.regenerateLdapPasswords(); }
  openAddLdapHostModal() { return this.dashboardService.openAddLdapHostModal(); }
  closeAddLdapHostModal() { return this.dashboardService.closeAddLdapHostModal(); }
  submitAddLdapHost() { return this.dashboardService.submitAddLdapHost(); }
  deleteLdapHost(host: string | LdapHost) { const id = typeof host === 'string' ? host : host.id; return this.dashboardService.deleteLdapHost(id); }
  toggleLdapHostStatus(host: LdapHost) { return this.dashboardService.toggleLdapHostStatus(host); }
  downloadLdapCaCert() { return this.dashboardService.downloadLdapCaCert(); }
  copyLdapParam(value: string, label: string) { return this.dashboardService.copyLdapParam(value, label); }
  openAddServiceAccountModal() { return this.dashboardService.openAddServiceAccountModal(); }
  closeAddServiceAccountModal() { return this.dashboardService.closeAddServiceAccountModal(); }
  generateSvcAcctPassword() { return this.dashboardService.generateSvcAcctPassword(); }
  toggleNewSvcAcctPwRevealed() { return this.dashboardService.toggleNewSvcAcctPwRevealed(); }
  submitAddServiceAccount() { return this.dashboardService.submitAddServiceAccount(); }
  toggleSvcAcctPwRevealed(id: string) { return this.dashboardService.toggleSvcAcctPwRevealed(id); }
  toggleServiceAccountStatus(account: LdapServiceAccount) { return this.dashboardService.toggleServiceAccountStatus(account); }
  deleteServiceAccount(id: string) { return this.dashboardService.deleteServiceAccount(id); }
  copySvcAcctPassword(password: string) { return this.dashboardService.copySvcAcctPassword(password); }
  copySvcAcctDn(dn: string) { return this.dashboardService.copySvcAcctDn(dn); }
  loadLdapDiagPreset(type: 'service-account' | 'user' | 'admin' | 'invalid') { return this.dashboardService.loadLdapDiagPreset(type); }
  runRadiusAuthTest() { return this.dashboardService.runRadiusAuthTest(); }
  copyRadiusDiagLog() { return this.dashboardService.copyRadiusDiagLog(); }
  toggleRadiusSecretRevealed() { return this.dashboardService.toggleRadiusSecretRevealed(); }
  openRotateRadiusSecretModal() { return this.dashboardService.openRotateRadiusSecretModal(); }
  closeRotateRadiusSecretModal() { return this.dashboardService.closeRotateRadiusSecretModal(); }
  executeRotateRadiusSecret() { return this.dashboardService.executeRotateRadiusSecret(); }
  openAddRadiusApModal() { return this.dashboardService.openAddRadiusApModal(); }
  closeAddRadiusApModal() { return this.dashboardService.closeAddRadiusApModal(); }
  submitAddRadiusAp() { return this.dashboardService.submitAddRadiusAp(); }
  deleteRadiusAp(ap: string | RadiusAccessPoint) { const id = typeof ap === 'string' ? ap : ap.id; return this.dashboardService.deleteRadiusAp(id); }
  toggleRadiusApStatus(ap: RadiusAccessPoint) { return this.dashboardService.toggleRadiusApStatus(ap); }
  openEditRadiusApModal(ap: RadiusAccessPoint) { return this.dashboardService.openEditRadiusApModal(ap); }
  regenerateNewRadiusClientSecret() { return this.dashboardService.regenerateNewRadiusClientSecret(); }
  toggleNewRadiusSecretRevealed() { return this.dashboardService.toggleNewRadiusSecretRevealed(); }
  copyNewRadiusSecret() { return this.dashboardService.copyNewRadiusSecret(); }
  rotateRadiusClientSecret(id: string) { return this.dashboardService.rotateRadiusClientSecret(id); }
  toggleRadiusClientSecretRevealed(id: string) { return this.dashboardService.toggleRadiusClientSecretRevealed(id); }
  copyRadiusClientSecret(secret: string) { return this.dashboardService.copyRadiusClientSecret(secret); }
  setRadiusActivityFilter(filter: 'all' | 'Access-Accept' | 'Access-Reject') { return this.dashboardService.setRadiusActivityFilter(filter); }
  simulateRadiusAuth(success?: boolean) { return this.dashboardService.simulateRadiusAuth(success); }
  openPairDeviceModal() { return this.dashboardService.openPairDeviceModal(); }
  closePairDeviceModal() { return this.dashboardService.closePairDeviceModal(); }
  confirmPairDevice() { return this.dashboardService.confirmPairDevice(); }
  startPushSimulation() { return this.dashboardService.startPushSimulation(); }
  closePushSimulator() { return this.dashboardService.closePushSimulator(); }
  openNotificationChallenge() { return this.dashboardService.openNotificationChallenge(); }
  selectSimulatedNumberMatch(selectedNumber: number) { return this.dashboardService.selectSimulatedNumberMatch(selectedNumber); }
  denySimulatedPush() { return this.dashboardService.denySimulatedPush(); }
  retryPushSimulation() { return this.dashboardService.retryPushSimulation(); }
  openWipeDeviceModal(device: EnrolledDevice) { return this.dashboardService.openWipeDeviceModal(device); }
  closeWipeDeviceModal() { return this.dashboardService.closeWipeDeviceModal(); }
  executeWipeDevice() { return this.dashboardService.executeWipeDevice(); }
  toggleFleetDeviceCompliance(device: EnrolledDevice) { return this.dashboardService.toggleFleetDeviceCompliance(device); }
  updateMobilePolicy(key: keyof MobilePolicyConfig, value: any) { return this.dashboardService.updateMobilePolicy(key, value); }
  launchApp(app: SaaSApp) { return this.dashboardService.launchApp(app); }
  openRequestAppModal() { return this.dashboardService.openRequestAppModal(); }
  closeRequestAppModal() { return this.dashboardService.closeRequestAppModal(); }
  submitAppRequest() { return this.dashboardService.submitAppRequest(); }
  startEnrollTotp() { return this.dashboardService.startEnrollTotp(); }
  closeEnrollTotpModal() { return this.dashboardService.closeEnrollTotpModal(); }
  confirmEnrollTotp() { return this.dashboardService.confirmEnrollTotp(); }
  copyRecoveryCodes() { return this.dashboardService.copyRecoveryCodes(); }
  downloadRecoveryCodes() { return this.dashboardService.downloadRecoveryCodes(); }
  generateRecoveryCodes() { return this.dashboardService.generateRecoveryCodes(); }
  useRecoveryCode(code: string) { return this.dashboardService.useRecoveryCode(code); }
  disableTotp() { return this.dashboardService.disableTotp(); }
  openChangePasswordModal() { return this.dashboardService.openChangePasswordModal(); }
  closeChangePasswordModal() { return this.dashboardService.closeChangePasswordModal(); }
  updatePasswordSelfService(currentPassword: string, newPassword: string) {
    return this.dashboardService.updatePasswordSelfService(currentPassword, newPassword);
  }
  submitPasswordChange(currentPassword: string, newPassword: string) {
    return this.dashboardService.submitPasswordChange(currentPassword, newPassword);
  }
  addSshKey() { return this.dashboardService.addSshKey(); }
  removeSshKey(id: string) { return this.dashboardService.removeSshKey(id); }
  copyUserId() { return this.dashboardService.copyUserId(); }
  revokeAllSessions() { return this.dashboardService.revokeAllSessions(); }
  onLogout() { return this.dashboardService.onLogout(); }
}
