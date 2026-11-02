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

}
