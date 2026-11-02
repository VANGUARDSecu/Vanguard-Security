import { Component, inject } from '@angular/core';
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
  AppAccessRequest,
} from '../../models/dashboard.models';

@Component({
  selector: 'app-admin-saml-oidc',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-saml-oidc.html',
  styleUrl: './admin-saml-oidc.css'
})
export class AdminSamlOidc {
  readonly dashboardService = inject(DashboardService);

  readonly activeTab = this.dashboardService.activeTab;
  readonly directoryUsers = this.dashboardService.directoryUsers;

  get sandboxSelectedAppId() { return this.dashboardService.sandboxSelectedAppId; }
  set sandboxSelectedAppId(v: string) { this.dashboardService.sandboxSelectedAppId = v; }
  get sandboxSelectedUserId() { return this.dashboardService.sandboxSelectedUserId; }
  set sandboxSelectedUserId(v: string) { this.dashboardService.sandboxSelectedUserId = v; }
  get sandboxInspectorMode() { return this.dashboardService.sandboxInspectorMode; }
  set sandboxInspectorMode(v: 'saml' | 'oidc') { this.dashboardService.sandboxInspectorMode = v; }
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
  readonly simulatedSamlXml = this.dashboardService.simulatedSamlXml;
  readonly simulatedOidcJwtHeader = this.dashboardService.simulatedOidcJwtHeader;
  readonly simulatedOidcJwtPayload = this.dashboardService.simulatedOidcJwtPayload;

  // SCRUM-22 Wizard Signals
  readonly wizardStep = this.dashboardService.wizardStep;
  readonly wizardSelectedTemplate = this.dashboardService.wizardSelectedTemplate;
  readonly wizardCatalogFilter = this.dashboardService.wizardCatalogFilter;
  readonly filteredCatalogTemplates = this.dashboardService.filteredCatalogTemplates;
  readonly appCatalogTemplates = this.dashboardService.appCatalogTemplates;

  get wizardCatalogSearch() { return this.dashboardService.wizardCatalogSearch; }
  set wizardCatalogSearch(v: string) { this.dashboardService.wizardCatalogSearch = v; }

  // SAML 2.0 Configuration Form
  readonly wizardSloUrl = this.dashboardService.wizardSloUrl;
  readonly wizardNameIdFormat = this.dashboardService.wizardNameIdFormat;
  readonly wizardSignResponse = this.dashboardService.wizardSignResponse;
  readonly wizardSignAssertion = this.dashboardService.wizardSignAssertion;
  readonly wizardAttributeStatements = this.dashboardService.wizardAttributeStatements;

  // OIDC Configuration Form
  readonly wizardClientId = this.dashboardService.wizardClientId;
  readonly wizardClientSecret = this.dashboardService.wizardClientSecret;
  readonly wizardSecretRevealed = this.dashboardService.wizardSecretRevealed;
  readonly wizardRedirectUris = this.dashboardService.wizardRedirectUris;
  get wizardNewRedirectUriInput() { return this.dashboardService.wizardNewRedirectUriInput; }
  set wizardNewRedirectUriInput(v: string) { this.dashboardService.wizardNewRedirectUriInput = v; }
  readonly wizardGrantTypes = this.dashboardService.wizardGrantTypes;
  readonly wizardScopes = this.dashboardService.wizardScopes;
  readonly wizardCopiedSecret = this.dashboardService.wizardCopiedSecret;
  readonly wizardCopiedClientId = this.dashboardService.wizardCopiedClientId;
  readonly wizardCopiedCert = this.dashboardService.wizardCopiedCert;

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

  setSamlSubTab(tab: 'apps' | 'idp-metadata' | 'oidc-clients' | 'sso-sandbox') {
    this.dashboardService.setSamlSubTab(tab);
  }

  downloadIdpMetadataXml() { this.dashboardService.downloadIdpMetadataXml(); }
  downloadX509Cert() { this.dashboardService.downloadX509Cert(); }
  copyCertFingerprint() { this.dashboardService.copyCertFingerprint(); }
  openRotateCertModal() { this.dashboardService.openRotateCertModal(); }
  closeRotateCertModal() { this.dashboardService.closeRotateCertModal(); }
  executeRotateCert() { this.dashboardService.executeRotateCert(); }

  // Wizard Methods
  openAddAppModal() { this.dashboardService.openAddAppModal(); }
  closeAddAppModal() { this.dashboardService.closeAddAppModal(); }
  setWizardStep(step: 1 | 2 | 3) { this.dashboardService.setWizardStep(step); }
  selectCatalogTemplate(tpl: any) { this.dashboardService.selectCatalogTemplate(tpl); }
  setCatalogFilter(f: 'all' | 'SAML 2.0' | 'OIDC') { this.dashboardService.wizardCatalogFilter.set(f); }
  addRedirectUriChip() { this.dashboardService.addRedirectUriChip(); }
  removeRedirectUriChip(index: number) { this.dashboardService.removeRedirectUriChip(index); }
  toggleWizardGrantType(grant: 'authorization_code' | 'client_credentials' | 'refresh_token') {
    this.dashboardService.toggleWizardGrantType(grant);
  }
  toggleWizardScope(scope: string) { this.dashboardService.toggleWizardScope(scope); }
  addAttributeRow() { this.dashboardService.addAttributeStatementRow(); }
  removeAttributeRow(index: number) { this.dashboardService.removeAttributeStatementRow(index); }
  updateAttribute(index: number, field: 'userAttribute' | 'samlClaim', val: string) {
    this.dashboardService.updateAttributeStatement(index, field, val);
  }
  generateNewOidcCredentials() { this.dashboardService.generateNewOidcCredentials(); }
  toggleWizardSecretRevealed() { this.dashboardService.toggleWizardSecretRevealed(); }
  copyWizardClientSecret() { this.dashboardService.copyWizardClientSecret(); }
  copyWizardClientId() { this.dashboardService.copyWizardClientId(); }
  copyX509CertToClipboard() { this.dashboardService.copyX509CertToClipboard(); }

  // Reactive Actions
  addApp(appData: any) { this.dashboardService.addApp(appData); }
  updateApp(id: string, updates: any) { this.dashboardService.updateApp(id, updates); }
  deleteApp(id: string) { this.dashboardService.deleteApp(id); }
  submitAddAppConnector() { this.dashboardService.submitAddAppConnector(); }
  deleteAppConnector(conn: string | SamlConnector) { const id = typeof conn === 'string' ? conn : conn.id; this.dashboardService.deleteAppConnector(id); }
  toggleAppConnectorStatus(conn: SamlConnector) { this.dashboardService.toggleAppConnectorStatus(conn); }
  toggleRevealClientSecret(client: OidcClient) { this.dashboardService.toggleRevealClientSecret(client); }
  regenerateClientSecret(client: OidcClient) { this.dashboardService.regenerateClientSecret(client); }
  copySimulatedAssertion() { this.dashboardService.copySimulatedAssertion(); }

}
