import { Component, inject, signal, computed, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
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
  RadiusAccessPoint,
  VlanMapping,
  EnrolledDevice,
  MobilePolicyConfig,
  DirectoryGroup,
} from '../../models/dashboard.models';

@Component({
  selector: 'app-admin-directory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-directory.html',
  styleUrl: './admin-directory.css'
})
export class AdminDirectory implements OnInit {
  readonly dashboardService = inject(DashboardService);

  readonly isDirectoryLoading = this.dashboardService.isDirectoryLoading;

  ngOnInit(): void {
    this.dashboardService.loadDirectoryUsers();
  }

  refreshDirectoryUsers(): void {
    this.dashboardService.loadDirectoryUsers();
  }

  readonly activeTab = this.dashboardService.activeTab;
  readonly directoryDepartmentFilter = this.dashboardService.directoryDepartmentFilter;
  readonly availableDepartments = this.dashboardService.availableDepartments;
  readonly availableRoles = this.dashboardService.availableRoles;
  readonly directoryStatusFilter = this.dashboardService.directoryStatusFilter;
  readonly directoryUsers = this.dashboardService.directoryUsers;
  readonly filteredDirectoryUsers = this.dashboardService.filteredDirectoryUsers;
  readonly showInviteModal = this.dashboardService.showInviteModal;
  readonly inviteSuccess = this.dashboardService.inviteSuccess;
  readonly inviteError = this.dashboardService.inviteError;

  readonly directorySearch = this.dashboardService.directorySearch;
  readonly organizationName = this.dashboardService.organizationName;
  readonly inviteCreatedUser = this.dashboardService.inviteCreatedUser;
  readonly passwordCopied = this.dashboardService.passwordCopied;
  readonly inviteEmailStatus = this.dashboardService.inviteEmailStatus;
  readonly inviteEmailMessage = this.dashboardService.inviteEmailMessage;

  // SCRUM-25: User Groups & App Permission Matrix
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
  readonly appCatalogTemplates = this.dashboardService.appCatalogTemplates;

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

  // Group Form Getters & Setters
  get groupFormName() { return this.dashboardService.groupFormName; }
  set groupFormName(v: string) { this.dashboardService.groupFormName = v; }
  get groupFormDescription() { return this.dashboardService.groupFormDescription; }
  set groupFormDescription(v: string) { this.dashboardService.groupFormDescription = v; }
  get groupFormDepartment() { return this.dashboardService.groupFormDepartment; }
  set groupFormDepartment(v: string) { this.dashboardService.groupFormDepartment = v; }
  get groupFormEmail() { return this.dashboardService.groupFormEmail; }
  set groupFormEmail(v: string) { this.dashboardService.groupFormEmail = v; }

  get groupFormRequireMfa(): boolean { return this.dashboardService.groupFormRequireMfa(); }
  set groupFormRequireMfa(v: boolean) { this.dashboardService.groupFormRequireMfa.set(v); }

  get groupFormMfaType(): 'any' | 'hardware_totp' { return this.dashboardService.groupFormMfaType(); }
  set groupFormMfaType(v: 'any' | 'hardware_totp') { this.dashboardService.groupFormMfaType.set(v); }

  get groupFormSessionDuration(): number { return this.dashboardService.groupFormSessionDuration(); }
  set groupFormSessionDuration(v: number) { this.dashboardService.groupFormSessionDuration.set(Number(v)); }

  readonly existingPendingUser = this.dashboardService.existingPendingUser;

  // SCRUM-37: Custom Combobox state for Department and Role
  readonly deptDropdownOpen = signal<boolean>(false);
  readonly roleDropdownOpen = signal<boolean>(false);
  readonly groupDeptDropdownOpen = signal<boolean>(false);

  readonly filteredDeptSuggestions = computed(() => {
    const query = (this.inviteDepartment || '').trim().toLowerCase();
    const all = this.availableDepartments();
    if (!query) return all;
    return all.filter((d) => d.toLowerCase().includes(query));
  });

  readonly filteredRoleSuggestions = computed(() => {
    const query = (this.inviteRole || '').trim().toLowerCase();
    const all = this.availableRoles();
    if (!query) return all;
    return all.filter((r) => r.toLowerCase().includes(query));
  });

  readonly filteredGroupDeptSuggestions = computed(() => {
    const query = (this.groupFormDepartment || '').trim().toLowerCase();
    const all = this.availableDepartments();
    if (!query) return all;
    return all.filter((d) => d.toLowerCase().includes(query));
  });

  isStandardDept(dept: string): boolean {
    return this.dashboardService.defaultDepartments.some(
      (d) => d.toLowerCase() === dept.trim().toLowerCase()
    );
  }

  isStandardRole(role: string): boolean {
    return this.dashboardService.defaultRoles.some(
      (r) => r.toLowerCase() === role.trim().toLowerCase()
    );
  }

  selectDept(dept: string) {
    this.inviteDepartment = dept;
    this.deptDropdownOpen.set(false);
  }

  selectRole(role: string) {
    this.inviteRole = role;
    this.roleDropdownOpen.set(false);
  }

  selectGroupDept(dept: string) {
    this.groupFormDepartment = dept;
    this.groupDeptDropdownOpen.set(false);
  }

  toggleDeptDropdown(event?: Event) {
    if (event) event.stopPropagation();
    this.deptDropdownOpen.update((v) => !v);
    this.roleDropdownOpen.set(false);
  }

  toggleRoleDropdown(event?: Event) {
    if (event) event.stopPropagation();
    this.roleDropdownOpen.update((v) => !v);
    this.deptDropdownOpen.set(false);
  }

  toggleGroupDeptDropdown(event?: Event) {
    if (event) event.stopPropagation();
    this.groupDeptDropdownOpen.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (target && !target.closest('.custom-combobox')) {
      this.deptDropdownOpen.set(false);
      this.roleDropdownOpen.set(false);
      this.groupDeptDropdownOpen.set(false);
    }
  }

  setDirectoryDepartment(dept: string) { this.dashboardService.setDirectoryDepartment(dept); }
  setDirectoryStatus(status: string) { this.dashboardService.setDirectoryStatus(status); }
  suspendUser(user: DirectoryUser) { this.dashboardService.suspendUser(user); }
  reactivateUser(user: DirectoryUser) { this.dashboardService.reactivateUser(user); }
  changeUserRole(user: DirectoryUser, role: any) { this.dashboardService.changeUserRole(user, role); }
  forceUserPasswordReset(user: DirectoryUser) { this.dashboardService.forceUserPasswordReset(user); }
  adminRevokeUserSessions(user: DirectoryUser) { this.dashboardService.adminRevokeUserSessions(user); }
  openInviteModal() {
    this.deptDropdownOpen.set(false);
    this.roleDropdownOpen.set(false);
    this.dashboardService.openInviteModal();
  }
  closeInviteModal() {
    this.deptDropdownOpen.set(false);
    this.roleDropdownOpen.set(false);
    this.dashboardService.closeInviteModal();
  }
  submitInviteUser() { this.dashboardService.submitInviteUser(); }
  generateRandomPassword() { return this.dashboardService.generateRandomPassword(); }
  copyTemporaryPassword() { this.dashboardService.copyTemporaryPassword(); }
  retryInviteEmail() { this.dashboardService.retryInviteEmail(); }
  resendInvitation(user: DirectoryUser) { this.dashboardService.resendInvitation(user); }
  renewExistingPendingUser() { this.dashboardService.renewExistingPendingUser(); }
  getInviteExpiryText(user: DirectoryUser) { return this.dashboardService.getInviteExpiryText(user); }

  // Group Management Methods
  setDirectoryActiveSubTab(tab: 'users' | 'groups') { this.dashboardService.setDirectoryActiveSubTab(tab); }
  setGroupModalActiveTab(tab: 'details' | 'members' | 'apps' | 'policies') { this.dashboardService.setGroupModalActiveTab(tab); }
  openCreateGroupModal() { this.dashboardService.openCreateGroupModal(); }
  openEditGroupModal(group: DirectoryGroup) { this.dashboardService.openEditGroupModal(group); }
  closeGroupModal() { this.dashboardService.closeGroupModal(); }
  toggleGroupFormMember(userId: string) { this.dashboardService.toggleGroupFormMember(userId); }
  toggleGroupFormApp(appId: string) { this.dashboardService.toggleGroupFormApp(appId); }
  saveGroup() { this.dashboardService.saveGroup(); }
  deleteGroup(groupId: string) { this.dashboardService.deleteGroup(groupId); }
  getGroupMembers(group: DirectoryGroup): DirectoryUser[] { return this.dashboardService.getGroupMembers(group); }
  getUserGroups(user: DirectoryUser): DirectoryGroup[] { return this.dashboardService.getUserGroups(user); }
  getGroupApps(group: DirectoryGroup) { return this.dashboardService.getGroupApps(group); }

  // =========================================================================
  // SCRUM-171: Admin Employee Application Account Provisioning & Isolation
  // =========================================================================
  readonly showProvisionAppModal = signal<boolean>(false);
  readonly provisionTargetUser = signal<DirectoryUser | null>(null);
  readonly provisionAppName = signal<string>('Figma Enterprise');
  readonly provisionAppUrl = signal<string>('https://www.figma.com/login');
  readonly provisionRegisterUrl = signal<string>('https://www.figma.com/signup');
  readonly provisionAppCategory = signal<SaaSApp['category']>('collaboration');
  readonly provisionAppProtocol = signal<string>('Extension Autofill');
  readonly provisionAppIcon = signal<string>('🎨');
  readonly provisionUsername = signal<string>('');
  readonly provisionPassword = signal<string>('');
  readonly provisionDescription = signal<string>('');
  readonly provisionError = signal<string | null>(null);
  readonly provisionSuccess = signal<string | null>(null);

  openProvisionAppModal(user?: DirectoryUser): void {
    const target = user || this.directoryUsers()[0] || null;
    this.provisionTargetUser.set(target);
    this.provisionError.set(null);
    this.provisionSuccess.set(null);
    this.applyProvisionAppPreset('figma', target);
    this.generateProvisionPassword();
    this.showProvisionAppModal.set(true);
  }

  closeProvisionAppModal(): void {
    this.showProvisionAppModal.set(false);
    this.provisionError.set(null);
    this.provisionSuccess.set(null);
  }

  onSelectProvisionTargetUserId(userId: string): void {
    const match = this.directoryUsers().find((u) => u.id === userId) || null;
    this.provisionTargetUser.set(match);
    if (match && !this.provisionUsername()) {
      this.provisionUsername.set(match.email);
    }
  }

  applyProvisionAppPreset(
    preset: 'dummy-web' | 'figma' | 'facebook' | 'github' | 'aws' | 'custom',
    targetOverride?: DirectoryUser | null,
  ): void {
    const target = targetOverride !== undefined ? targetOverride : this.provisionTargetUser();
    const defaultEmail = target?.email || 'employee@company.com';
    this.provisionError.set(null);
    this.provisionSuccess.set(null);

    switch (preset) {
      case 'dummy-web':
        this.provisionAppName.set('Acme Dummy Web');
        this.provisionAppUrl.set('http://localhost:4201/login');
        this.provisionRegisterUrl.set('http://localhost:4201/signup');
        this.provisionAppCategory.set('cloud');
        this.provisionAppProtocol.set('OIDC');
        this.provisionAppIcon.set('🏢');
        this.provisionUsername.set(defaultEmail);
        this.provisionDescription.set('Internal employee portal account created by Administrator');
        break;
      case 'figma':
        this.provisionAppName.set('Figma Enterprise');
        this.provisionAppUrl.set('https://www.figma.com/login');
        this.provisionRegisterUrl.set('https://www.figma.com/signup');
        this.provisionAppCategory.set('collaboration');
        this.provisionAppProtocol.set('Extension Autofill');
        this.provisionAppIcon.set('🎨');
        this.provisionUsername.set(defaultEmail);
        this.provisionDescription.set('Company design system & prototyping account provisioned by Admin');
        break;
      case 'facebook':
        this.provisionAppName.set('Facebook / Meta Business');
        this.provisionAppUrl.set('https://www.facebook.com/login');
        this.provisionRegisterUrl.set('https://www.facebook.com/r.php');
        this.provisionAppCategory.set('collaboration');
        this.provisionAppProtocol.set('Extension Autofill');
        this.provisionAppIcon.set('📘');
        this.provisionUsername.set(defaultEmail);
        this.provisionDescription.set('Corporate social media & Meta Business Suite account');
        break;
      case 'github':
        this.provisionAppName.set('GitHub Enterprise');
        this.provisionAppUrl.set('https://github.com/login');
        this.provisionRegisterUrl.set('https://github.com/signup');
        this.provisionAppCategory.set('developer');
        this.provisionAppProtocol.set('Extension Autofill');
        this.provisionAppIcon.set('🐙');
        this.provisionUsername.set(defaultEmail);
        this.provisionDescription.set('Engineering repository & CI/CD account provisioned by Admin');
        break;
      case 'aws':
        this.provisionAppName.set('AWS Management Console');
        this.provisionAppUrl.set('https://signin.aws.amazon.com/console');
        this.provisionRegisterUrl.set('https://portal.aws.amazon.com/billing/signup');
        this.provisionAppCategory.set('cloud');
        this.provisionAppProtocol.set('Extension Autofill');
        this.provisionAppIcon.set('☁️');
        this.provisionUsername.set(defaultEmail);
        this.provisionDescription.set('Cloud infrastructure IAM account provisioned by Admin');
        break;
      case 'custom':
        this.provisionAppName.set('');
        this.provisionAppUrl.set('https://');
        this.provisionRegisterUrl.set('https://');
        this.provisionAppCategory.set('cloud');
        this.provisionAppProtocol.set('Extension Autofill');
        this.provisionAppIcon.set('🔑');
        this.provisionUsername.set(defaultEmail);
        this.provisionDescription.set('');
        break;
    }
  }

  generateProvisionPassword(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let pwd = 'Vg!';
    for (let i = 0; i < 11; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.provisionPassword.set(pwd);
  }

  openExternalRegisterPage(): void {
    const url = this.provisionRegisterUrl().trim() || this.provisionAppUrl().trim();
    if (url && typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  submitProvisionAppAccount(): void {
    this.provisionError.set(null);
    this.provisionSuccess.set(null);

    const target = this.provisionTargetUser();
    if (!target) {
      this.provisionError.set('Please select a target employee from the directory.');
      return;
    }
    if (!this.provisionAppName().trim()) {
      this.provisionError.set('Please enter the application name.');
      return;
    }
    if (!this.provisionAppUrl().trim()) {
      this.provisionError.set('Please enter the application login URL.');
      return;
    }
    if (!this.provisionUsername().trim() || !this.provisionPassword()) {
      this.provisionError.set('Please specify the employee account username and password created for this application.');
      return;
    }

    this.dashboardService.provisionEmployeeAppAccount({
      targetUserId: target.id,
      targetUserEmail: target.email,
      targetUserName: target.name,
      appName: this.provisionAppName().trim(),
      launchUrl: this.provisionAppUrl().trim(),
      category: this.provisionAppCategory(),
      protocol: this.provisionAppProtocol(),
      icon: this.provisionAppIcon() || '🔑',
      assignedUsername: this.provisionUsername().trim(),
      assignedPassword: this.provisionPassword(),
      description: this.provisionDescription().trim(),
    });

    this.provisionSuccess.set(
      `Assigned ${this.provisionAppName().trim()} (${this.provisionUsername().trim()}) exclusively to ${target.name}. Only ${target.name} can see and launch this account in their dashboard.`,
    );
  }

  getEmployeeProvisionedApps(user: DirectoryUser | null): SaaSApp[] {
    if (!user) return [];
    return this.dashboardService.getAppsProvisionedForEmployee(user.id, user.email);
  }

  revokeEmployeeApp(user: DirectoryUser, app: SaaSApp): void {
    this.dashboardService.revokeEmployeeProvisionedApp(user.id, user.email, app.id);
  }

}
