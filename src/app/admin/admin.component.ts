import {
  AfterViewInit,
  NgZone,
  Component,
  OnInit,
  HostListener,
  ViewEncapsulation, ElementRef
} from '@angular/core';
import { AuthService } from '../services/auth.service';
import {
  faChartPie, faUsers, faOilCan, faChartLine, faScrewdriverWrench, faHeadset,
  faBoxOpen, faHandshake, faSliders, faHammer, faCubes, faTruckFast,
  faHandHoldingHand, faGears, faDroplet, faUserShield, faBus, faCar,
  faBuilding, faFileLines, faWarehouse, faRecycle, faCodeMerge, faMapLocationDot,
  faGaugeHigh, faIdCard, faServer, faGasPump, faCircleUser, faRightFromBracket, faBars
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