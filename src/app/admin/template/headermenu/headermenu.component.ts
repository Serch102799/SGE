import {Component, HostListener, OnInit, Inject, PLATFORM_ID} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-headermenu',
  standalone: false,
  templateUrl: './headermenu.component.html',
  styleUrl: './headermenu.component.css'
})
export class HeadermenuComponent implements OnInit {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const isLight = localStorage.getItem('theme') === 'light';
      const icon = document.getElementById('themeIcon');
      if (icon) {
        icon.className = isLight ? 'fas fa-moon' : 'fas fa-sun';
      }
    }
  }
  @HostListener('click', ['$event'])
  onClick(event: Event): void {
    if (!isPlatformBrowser(this.platformId)) return;
    event.preventDefault();
    const targetElement = event.target as HTMLElement;
    if (targetElement.id === 'sidebarToggle' || targetElement.closest('#sidebarToggle')) {
      document.body.classList.toggle('sb-sidenav-toggled');
      localStorage.setItem('sb|sidebar-toggle', JSON.stringify(document.body.classList.contains('sb-sidenav-toggled')));
    }
    if (targetElement.id === 'navbarDropdown' || targetElement.closest('#navbarDropdown')) {
      const dropdownMenu = document.querySelector('ul[aria-labelledby="navbarDropdown"]');
      if (dropdownMenu) {
        dropdownMenu.classList.toggle('show');
      }
    }
    if (targetElement.id === 'themeToggle' || targetElement.closest('#themeToggle')) {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
      localStorage.setItem('theme', isLight ? 'dark' : 'light');
      const icon = document.getElementById('themeIcon');
      if (icon) {
        icon.className = isLight ? 'fas fa-moon' : 'fas fa-sun';
      }
    }
  }
}
