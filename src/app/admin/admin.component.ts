import {
  AfterViewInit,
  NgZone,
  Component,
  OnInit,
  HostListener,
  ViewEncapsulation, ElementRef
} from '@angular/core';
import { AuthService } from '../services/auth.service';
import {faOilCan,faRoute, faCar, faBars, faTachometerAlt, faArrowCircleDown, faArrowCircleUp, faCogs, 
  faTint, faUsersCog, faBus,  faTruck, faChartPie, 
  faDolly, faHistory, faUserCircle, faCubes, faSignOutAlt, faGasPump, faScrewdriverWrench, faProjectDiagram, faTools, faGauge   } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
  encapsulation: ViewEncapsulation.None
})
export class AdminComponent implements OnInit, AfterViewInit {

  isCollapsed = false;
  faEdicionHistorica = faHistory; 
  faEdicionDetalles = faScrewdriverWrench; 
  faTanques = faOilCan;
  faBars = faBars;
  faRutas = faRoute;
  faOperadores = faCar;
  faCargaCombustible = faGasPump;
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
  faMiPerfil = faUserCircle;
  faCerrarSesion = faSignOutAlt;
  faTachometerAlt = faTachometerAlt;
  faRecetas = faProjectDiagram;
  faArmado = faTools;
  faRendimientos = faGauge;
  faPrestamos = faTools; 
  faCogs = faCogs;
  faArtArmados = faCubes;

  currentUser: any;
  constructor(
    public authService: AuthService,
    private el: ElementRef,
    private ngZone: NgZone,
  ) {
  }
  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
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