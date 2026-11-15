import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import {
  DEFAULT_MOBILE_OAUTH_REDIRECT,
  buildMobileOAuthDeepLink,
} from '../../utils/mobile-oauth-relay.util';

@Component({
  selector: 'app-mobile-oauth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relay-page">
      <div class="relay-card">
        <div class="relay-badge">VANGUARD MOBILE</div>
        <h1>Returning to Vanguard App…</h1>
        <p>
          Your Google sign-in callback is ready. If the Vanguard mobile app does not
          reopen automatically, tap the button below.
        </p>
        <a class="relay-button" [href]="safeDeepLink">Open Vanguard Mobile</a>
      </div>
    </div>
  `,
  styles: [
    `
      .relay-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: #0a0e17;
        color: #f8fafc;
        font-family: Inter, system-ui, -apple-system, sans-serif;
      }
      .relay-card {
        width: 100%;
        max-width: 420px;
        padding: 28px;
        border-radius: 16px;
        background: #0f172a;
        border: 1px solid rgba(0, 229, 255, 0.3);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        text-align: center;
      }
      .relay-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(0, 229, 255, 0.12);
        color: #00e5ff;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        margin-bottom: 14px;
      }
      h1 {
        font-size: 20px;
        margin: 0 0 10px;
      }
      p {
        color: #94a3b8;
        font-size: 14px;
        line-height: 1.5;
        margin: 0 0 22px;
      }
      .relay-button {
        display: inline-block;
        width: 100%;
        padding: 12px 16px;
        border-radius: 10px;
        background: #00e5ff;
        color: #020617;
        font-weight: 700;
        text-decoration: none;
        box-sizing: border-box;
      }
    `,
  ],
})
export class MobileOAuthCallbackComponent implements OnInit {
  private readonly sanitizer = inject(DomSanitizer);

  rawDeepLink = DEFAULT_MOBILE_OAUTH_REDIRECT;
  safeDeepLink: SafeUrl = this.sanitizer.bypassSecurityTrustUrl(
    DEFAULT_MOBILE_OAUTH_REDIRECT
  );

  ngOnInit(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.rawDeepLink = buildMobileOAuthDeepLink({
      search: window.location.search,
      hash: window.location.hash,
    });
    this.safeDeepLink = this.sanitizer.bypassSecurityTrustUrl(this.rawDeepLink);

    try {
      window.location.replace(this.rawDeepLink);
    } catch {
      // Fallback button remains rendered for manual tap
    }
  }
}
