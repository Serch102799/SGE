import {Component, HostListener} from '@angular/core';
@Component({
  selector: 'app-headermenu',
  standalone: false,
  templateUrl: './headermenu.component.html',
  styleUrl: './headermenu.component.css'
})
export class HeadermenuComponent {
  constructor() {
  }
  @HostListener('click', ['$event'])
  onClick(event: Event): void {
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
  }
}
