import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  // Ensure AuthService is instantiated immediately on all landing/callback routes
  private readonly auth = inject(AuthService);
  protected readonly title = signal('frontend-vanguard');
}
