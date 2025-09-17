import {
  AfterViewInit,
  NgZone,
  Component,
  OnInit,
  HostListener,
  ViewEncapsulation, ElementRef
} from '@angular/core';
import { AuthService } from '../services/auth.service';
import { faBars, faTachometerAlt, faArrowCircleDown, faArrowCircleUp, faCogs, 
  faTint, faUsersCog, faBus, faTruck, faChartPie, 
  faDolly, faHistory, faUserCircle, faSignOutAlt  } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
  encapsulation: ViewEncapsulation.None
})
export class AdminComponent implements OnInit, AfterViewInit {

  isCollapsed = false;
  faBars = faBars;

  faDashboard = faTachometerAlt;
  faEntradas = faArrowCircleDown;
  faSalidas = faArrowCircleUp;
  faRefacciones = faCogs;
  faInsumos = faTint;
  faUsuarios = faUsersCog;
  faAutobuses = faBus;
  faProveedores = faTruck;
  faReportes = faChartPie;
  faCargaInicial = faDolly;
  faEdicionHistorica = faHistory;
  faMiPerfil = faUserCircle;
  faCerrarSesion = faSignOutAlt;

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
  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }
  
  logout(): void {
    this.authService.logout();

  }
  ngAfterViewInit() {

  }

}