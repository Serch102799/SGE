import {
  AfterViewInit,
  NgZone,
  Component,
  OnInit,
  HostListener,
  ViewEncapsulation, ElementRef
} from '@angular/core';
import { AuthService } from '../services/auth.service';
@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
  encapsulation: ViewEncapsulation.None
})
export class AdminComponent implements OnInit, AfterViewInit {

  
  
  currentUser: any;
  constructor(
    public authService: AuthService,
    private el: ElementRef,
    private ngZone: NgZone,
  ) {
  }
  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
  }

  
  logout(): void {
    this.authService.logout();

  }
  ngAfterViewInit() {

  }

}