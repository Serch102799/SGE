import {
  AfterViewInit,
  NgZone,
  Component,
  OnInit,
  HostListener,
  ViewEncapsulation, ElementRef, Inject, PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../services/auth.service';
import {
  faChartPie, faUsers, faOilCan, faChartLine, faScrewdriverWrench, faHeadset,
  faBoxOpen, faHandshake, faSliders, faHammer, faCubes, faTruckFast,
  faHandHoldingHand, faGears, faDroplet, faUserShield, faBus, faCar,
  faBuilding, faFileLines, faWarehouse, faRecycle, faCodeMerge, faMapLocationDot,
  faGaugeHigh, faIdCard, faServer, faGasPump, faCircleUser, faRightFromBracket, faBars,
  faSun, faMoon
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
  encapsulation: ViewEncapsulation.None
})
export class AdminComponent implements OnInit, AfterViewInit {

  isCollapsed = false;
  
  // Iconos asignados acorde al contexto
  faDashboard = faChartPie;
  faDashboardRrhh = faUsers;
  faTanques = faOilCan;
  faBars = faBars;
  faRutas = faMapLocationDot;
  faOperadores = faIdCard;
  faCargaCombustible = faGasPump;
  faDashConsumo = faChartLine;
  faEntradas = faBoxOpen;
  faSalidas = faTruckFast;
  faRefacciones = faGears;
  faInsumos = faDroplet;
  faUsuarios = faUserShield;
  faAutobuses = faBus;
  faParticulares = faCar;
  faProveedores = faBuilding;
  faReportes = faFileLines;
  faCargaInicial = faWarehouse;
  faMiPerfil = faCircleUser;
  faCerrarSesion = faRightFromBracket;
  faAjustesInv = faSliders;
  faArmado = faHammer;
  faServicios = faScrewdriverWrench;
  faRendimientos = faGaugeHigh;
  faPrestamos = faHandHoldingHand; 
  faArtArmados = faCubes;
  faTickets = faHeadset;
  faServiciosExternos = faHandshake;
  faRecuperados = faRecycle;
  faHerramientaFusion = faCodeMerge;
  faAdminPanel = faServer;
  faSun = faSun;
  faMoon = faMoon;
  isLightMode = false;

  currentUser: any;
  constructor(
    public authService: AuthService,
    private el: ElementRef,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
  }
  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isLightMode = localStorage.getItem('theme') === 'light';
    }
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }
  
  toggleTheme(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isLightMode = !this.isLightMode;
    const theme = this.isLightMode ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
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