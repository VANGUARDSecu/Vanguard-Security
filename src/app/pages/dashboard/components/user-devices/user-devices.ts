import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { EnrolledDevice } from '../../models/dashboard.models';

@Component({
  selector: 'app-user-devices',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-devices.html',
  styleUrl: './user-devices.css'
})
export class UserDevices implements OnInit {
  readonly dashboardService = inject(DashboardService);

  readonly activeTab = this.dashboardService.activeTab;
  readonly userDevices = this.dashboardService.userDevices;
  readonly clientInfo = this.dashboardService.clientInfo;
  readonly showPairDeviceModal = this.dashboardService.showPairDeviceModal;
  readonly newPairingToken = this.dashboardService.newPairingToken;
  readonly newPairingKey = this.dashboardService.newPairingKey;
  readonly newPairingQrData = this.dashboardService.newPairingQrData;
  readonly pairDeviceSuccess = this.dashboardService.pairDeviceSuccess;
  readonly pairingStatusMessage = this.dashboardService.pairingStatusMessage;
  readonly isPairingModalLoading = this.dashboardService.isPairingModalLoading;
  readonly activeDevicePushTest = this.dashboardService.activeDevicePushTest;
  readonly isSendingPushTest = this.dashboardService.isSendingPushTest;

  ngOnInit(): void {
    void this.dashboardService.loadUserDevices();
  }

  encodeUri(val: string): string {
    return encodeURIComponent(val || '');
  }

  sendRealTestPush(device?: EnrolledDevice) { this.dashboardService.sendRealTestPush(device); }
  cancelDevicePushTest() { this.dashboardService.cancelDevicePushTest(); }
  openPairDeviceModal() { this.dashboardService.openPairDeviceModal(); }
  closePairDeviceModal() { this.dashboardService.closePairDeviceModal(); }
  confirmPairDevice() { this.dashboardService.confirmPairDevice(); }
  openWipeDeviceModal(dev: EnrolledDevice) { this.dashboardService.openWipeDeviceModal(dev); }
  revokeAllSessions() { this.dashboardService.revokeAllSessions(); }

}
