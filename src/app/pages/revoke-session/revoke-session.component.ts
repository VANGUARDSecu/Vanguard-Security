import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';

export interface AlertRevocationPreviewData {
  valid: boolean;
  emailMasked: string;
  applicationName: string;
  ipAddress: string;
  device: string;
  timestamp: string;
  expiresAt: string;
}

export interface AlertRevocationResultData {
  success: boolean;
  emailMasked?: string;
  refreshRevoked: boolean;
  oidcGrantsRevoked: number;
  maxResidualAccessSeconds: number;
  notCovered?: string[];
  resetPasswordPath?: string;
  message: string;
}

@Component({
  selector: 'app-revoke-session',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './revoke-session.component.html',
  styleUrl: './revoke-session.component.css',
})
export class RevokeSessionComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  private querySub: Subscription | null = null;
  private activeToken = '';

  readonly state = signal<'loading' | 'ready' | 'revoking' | 'revoked' | 'error'>('loading');
  readonly preview = signal<AlertRevocationPreviewData | null>(null);
  readonly result = signal<AlertRevocationResultData | null>(null);
  readonly errorMessage = signal<string>('');

  ngOnInit(): void {
    const initialToken = this.route.snapshot?.queryParamMap?.get('token')?.trim() || '';
    if (this.route.queryParamMap) {
      this.querySub = this.route.queryParamMap.subscribe((params) => {
        const token = params.get('token')?.trim() || '';
        this.loadPreview(token);
      });
    } else {
      this.loadPreview(initialToken);
    }
  }

  ngOnDestroy(): void {
    this.querySub?.unsubscribe();
  }

  private loadPreview(token: string): void {
    if (!token) {
      this.activeToken = '';
      this.state.set('error');
      this.errorMessage.set(
        'Missing or incomplete security revocation token. Open the link directly from your Vanguard Security Alert email or revoke sessions from Account Security.'
      );
      return;
    }

    if (token === this.activeToken && (this.state() === 'ready' || this.state() === 'revoked')) {
      return;
    }

    this.activeToken = token;
    this.state.set('loading');
    this.errorMessage.set('');

    this.authService.previewAlertRevocation(token).subscribe({
      next: (data) => {
        this.preview.set(data);
        this.state.set('ready');
      },
      error: (err: Error) => {
        this.state.set('error');
        this.errorMessage.set(
          err?.message || 'This security revocation link is invalid, expired, or already used.'
        );
      },
    });
  }

  confirmRevoke(): void {
    if (!this.activeToken || this.state() === 'revoking' || this.state() === 'revoked') {
      return;
    }

    this.state.set('revoking');
    this.errorMessage.set('');

    this.authService.confirmAlertRevocation(this.activeToken).subscribe({
      next: (res) => {
        this.result.set(res);
        // Immediately purge any local portal/extension session without leaving the confirmation view
        if (this.authService.isLoggedIn()) {
          this.authService.logout(false, false);
        }
        this.state.set('revoked');
      },
      error: (err: Error) => {
        this.state.set('error');
        this.errorMessage.set(
          err?.message || 'Unable to execute emergency session revocation.'
        );
      },
    });
  }
}
