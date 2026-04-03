import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { 
  faIdCard, faTimesCircle, faExclamationTriangle, 
  faQuestionCircle, faCalendarAlt, faTrophy, 
  faTachometerAlt, faUser, faTimes 
} from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-dashboard-rrhh',
  standalone: false,
  templateUrl: './dashboard-rrhh.component.html',
  styleUrls: ['./dashboard-rrhh.component.css']
})
export class DashboardRrhhComponent implements OnInit {
  // Iconos
  faIdCard = faIdCard;
  faTimesCircle = faTimesCircle;
  faExclamationTriangle = faExclamationTriangle;
  faQuestionCircle = faQuestionCircle;
  faCalendarAlt = faCalendarAlt;
  faTrophy = faTrophy;
  faTachometerAlt = faTachometerAlt;
  faUser = faUser;
  faTimes = faTimes;


  rutas: any[] = [];
 filtroRuta: string = '';
 fechaDesde: string = '';
 fechaHasta: string = '';

  currentDate: Date = new Date();
  nombreUsuario: string = '';
  isLoading: boolean = true;

  kpis: any = {
    operadores_activos: 0,
    licencias_vencidas: 0,
    licencias_por_vencer: 0,
    sin_licencia: 0
  };

  topMejores: any[] = [];
  topPeores: any[] = [];

  // Lógica de Modales detallados
  modalDetalleVisible: boolean = false;
  tituloModalDetalle: string = '';
  operadoresDetalle: any[] = [];
  tipoDetalleActivo: string = ''; // 'vencidas', 'por_vencer', 'sin_licencia'

  // Listas completas guardadas desde la carga inicial
  detalleData: any = {
    vencidas: [],
    por_vencer: [],
    sin_licencia: []
  };

  constructor(private http: HttpClient, public authService: AuthService) {
    const user = this.authService.getCurrentUser();
    this.nombreUsuario = user?.nombre || 'Administrador';
  }

  ngOnInit(): void {
    this.establecerUltimos7Dias();
    this.cargarRutas();
    this.cargarDashboard();
  }

  establecerUltimos7Dias() {
  const hoy = new Date();
  const hace7Dias = new Date();
  hace7Dias.setDate(hoy.getDate() - 7);
  
  this.fechaHasta = hoy.toISOString().split('T')[0];
  this.fechaDesde = hace7Dias.toISOString().split('T')[0];
}

cargarRutas() {
  this.http.get<any[]>(`${environment.apiUrl}/rutas/lista-simple`).subscribe(res => this.rutas = res);
}

cargarDashboard() {
  this.isLoading = true;
  let params = new HttpParams();
  if (this.fechaDesde) params = params.set('fecha_desde', this.fechaDesde);
  if (this.fechaHasta) params = params.set('fecha_hasta', this.fechaHasta);
  if (this.filtroRuta) params = params.set('id_ruta', this.filtroRuta);

  this.http.get<any>(`${environment.apiUrl}/dashboard-rrhh`, { params }).subscribe({
    next: (data) => {
      console.log("DATOS DEL BACKEND:", data);
      this.kpis = data.kpis;
      this.topMejores = data.topMejores;
      this.topPeores = data.topPeores;
      
      this.detalleData.vencidas = data.detalles?.vencidas || [];
      this.detalleData.por_vencer = data.detalles?.por_vencer || [];
      this.detalleData.sin_licencia = data.detalles?.sin_licencia || [];
      
      this.isLoading = false;
    },
    error: (err) => {
      console.error('Error cargando el dashboard:', err);
      this.isLoading = false;
    }
  });
}
  abrirDetalle(tipo: 'vencidas' | 'por_vencer' | 'sin_licencia') {
    this.tipoDetalleActivo = tipo;
    
    if (tipo === 'vencidas') {
      this.tituloModalDetalle = 'Operadores con Licencia Vencida';
      this.operadoresDetalle = this.detalleData.vencidas;
    } else if (tipo === 'por_vencer') {
      this.tituloModalDetalle = 'Licencias Próximas a Vencer (30 días)';
      this.operadoresDetalle = this.detalleData.por_vencer;
    } else {
      this.tituloModalDetalle = 'Operadores sin Licencia Registrada';
      this.operadoresDetalle = this.detalleData.sin_licencia;
    }

    this.modalDetalleVisible = true;
    document.body.style.overflow = 'hidden';
  }

  cerrarModal() {
    this.modalDetalleVisible = false;
    document.body.style.overflow = 'auto';
  }
}