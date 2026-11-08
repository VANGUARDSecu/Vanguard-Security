import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Navbar } from './landing/components/navbar/navbar';
import { Hero } from './landing/components/hero/hero';
import { Services } from './landing/components/services/services';
import { About } from './landing/components/about/about';
import { Footer } from './landing/components/footer/footer';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, Navbar, Hero, Services, About, Footer],
  styleUrl: './landing.css',
  templateUrl: './landing.html',
})
export class Landing implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    // If arriving at the root with OIDC / SSO parameters, automatically forward to /login preserving context
    this.route.queryParams.subscribe((params) => {
      if (params['client_id'] && params['redirect_uri']) {
        this.router.navigate(['/login'], { queryParams: params });
      }
    });
  }
}
