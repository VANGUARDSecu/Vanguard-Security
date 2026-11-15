import { Component, OnInit, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NewUserGuideService } from '../../../../shared/new-user-guide/new-user-guide.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css']
})
export class Navbar implements OnInit {
  private readonly guideService = inject(NewUserGuideService);
  isScrolled = false;
  activeSection = 'home';

  navLinks = [
    { label: 'Home',     href: '#home'     },
    { label: 'Services', href: '#services' },
    { label: 'About',    href: '#about'    },
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {}

  @HostListener('window:scroll', [])
  onScroll(): void {
    this.isScrolled = window.scrollY > 20;
    this.updateActiveSection();
  }

  private updateActiveSection(): void {
    const sections = ['home', 'services', 'about'];
    for (const id of sections.reverse()) {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 120) {
        this.activeSection = id;
        break;
      }
    }
  }

  scrollTo(sectionId: string, event: Event): void {
    event.preventDefault();
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  openQuickGuide(): void {
    this.guideService.openFromLanding('company-admin');
  }
}
