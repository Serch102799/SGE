import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { faIdCard, faTimesCircle, faExclamationTriangle, faQuestionCircle, faCalendarAlt, faTrophy, faTachometerAlt } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-dashboard-rrhh',
  standalone: false,
  templateUrl: './dashboard-rrhh.component.html',
  styleUrls: ['./dashboard-rrhh.component.css']
})
export class DashboardRrhhComponent implements OnInit {

   faIdCard = faIdCard;
    faTimesCircle = faTimesCircle;
    faExclamationTriangle = faExclamationTriangle;
    faQuestionCircle = faQuestionCircle;
    faCalendarAlt = faCalendarAlt;
    faTrophy = faTrophy;
    faTachometerAlt = faTachometerAlt;
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

  constructor(private http: HttpClient, public authService: AuthService) {
    // Tomamos el nombre del usuario logueado para el saludo
    const user = this.authService.getCurrentUser();
    this.nombreUsuario = user?.nombre || 'Administrador';
  }

  ngOnInit(): void {
    this.cargarDashboard();
  }

  cargarDashboard() {
    this.isLoading = true;
    this.http.get<any>(`${environment.apiUrl}/dashboard-rrhh`).subscribe({
      next: (data) => {
        this.kpis = data.kpis;
        this.topMejores = data.topMejores;
        this.topPeores = data.topPeores;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar dashboard', err);
        this.isLoading = false;
      }
    });
  }
}