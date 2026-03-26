import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChartConfiguration, ChartData, Chart, registerables } from 'chart.js';
import { environment } from '../../../../environments/environments';
import { BaseChartDirective } from 'ng2-charts';
import { AuthService } from '../../../services/auth.service';
import { faCalendarAlt } from '@fortawesome/free-solid-svg-icons';

interface DashboardStats {
  totalRefacciones: number;
  totalInsumos: number;
  totalPiezasRefacciones: number;
  refaccionesStockBajo: number;
  insumosStockBajo: number;
  valorTotalInventario: number;
  topStockRefacciones: { nombre: string, stock_actual: number }[];
  topStockInsumos: { nombre: string, stock_actual: number }[];
  ultimasEntradas: any[];
  ultimasSalidas: any[];
  topCostoAutobuses: { economico: string, costo_total: number }[];
}

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  nombreUsuario: string = '';
  faCalendarAlt = faCalendarAlt; 
  currentDate: Date = new Date(); 
  stats: DashboardStats | null = null;
  
  private apiUrlStats = `${environment.apiUrl}/dashboard/stats`;
  private apiUrlKpis = `${environment.apiUrl}/reportes/dashboard-kpis`; // Nuestro nuevo endpoint

  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

  isLoading: boolean = true;
  isLoadingKpis: boolean = true;

  // --- FILTROS DE FECHA (Por defecto: Mes en curso) ---
  fechaInicioKPI: string = '';
  fechaFinKPI: string = '';

  // --- TOTALES FINANCIEROS ---
  granTotalCompras: number = 0;
  granTotalGastos: number = 0;

  // ==========================================
  // CONFIGURACIÓN DE GRÁFICAS DE BARRAS (Existentes)
  // ==========================================
  public topStockRefaccionesOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { color: '#e0e0e0' } }, x: { ticks: { color: '#e0e0e0' } } }
  };
  public topStockRefaccionesData: ChartData<'bar'> = {
    labels: [], datasets: [{ data: [], label: 'Stock Actual', backgroundColor: 'rgba(68, 128, 211, 0.8)' }]
  };

  public topStockInsumosOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { color: '#e0e0e0' } }, x: { ticks: { color: '#e0e0e0' } } }
  };
  public topStockInsumosData: ChartData<'bar'> = {
    labels: [], datasets: [{ data: [], label: 'Stock Actual', backgroundColor: 'rgba(77, 182, 172, 0.8)' }] 
  };

  public topCostoAutobusesOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } },
    scales: { y: { ticks: { color: '#e0e0e0' } }, x: { ticks: { color: '#e0e0e0' } } }
  };
  public topCostoAutobusesData: ChartData<'bar'> = {
    labels: [], datasets: [{ data: [], label: 'Costo Total', backgroundColor: 'rgba(211, 75, 68, 0.8)' }]
  };

  // ==========================================
  // CONFIGURACIÓN DE NUEVAS GRÁFICAS DE PASTEL (KPIs)
  // ==========================================
  
  // Opciones para darle animaciones fluidas y dinámicas
  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right', // Leyendas a la derecha para que no tapen el pastel
        labels: { color: '#e0e0e0', font: { size: 12 } }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            let value = context.raw as number;
            return ` $${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
          }
        }
      }
    }
  };

  public pieComprasData: ChartData<'pie'> = { labels: [], datasets: [] };
  public pieGastosData: ChartData<'pie'> = { labels: [], datasets: [] };

  // Paletas de colores modernos
  private coloresCompras = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'];
  private coloresGastos = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e'];

  constructor(private http: HttpClient, private authService: AuthService) {
    Chart.register(...registerables);
    const user = this.authService.getCurrentUser();
    this.nombreUsuario = user?.nombre || 'Administrador';
  }

  ngOnInit(): void {
    this.establecerMesActual();
    this.cargarEstadisticas();
    this.cargarKpisFinancieros();
  }

  // Define el día 1 y el último día del mes en curso por defecto
  establecerMesActual() {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    // Formato YYYY-MM-DD para el input type="date"
    this.fechaInicioKPI = primerDia.toISOString().split('T')[0];
    this.fechaFinKPI = ultimoDia.toISOString().split('T')[0];
  }

  cargarEstadisticas() {
    this.isLoading = true; 
    this.http.get<DashboardStats>(this.apiUrlStats).subscribe({
      next: (data) => {
        this.stats = data;
        if (data.topStockRefacciones) {
          this.topStockRefaccionesData.labels = data.topStockRefacciones.map(item => item.nombre);
          this.topStockRefaccionesData.datasets[0].data = data.topStockRefacciones.map(item => item.stock_actual);
        }
        if (data.topStockInsumos) {
          this.topStockInsumosData.labels = data.topStockInsumos.map(item => item.nombre);
          this.topStockInsumosData.datasets[0].data = data.topStockInsumos.map(item => item.stock_actual);
        }
        if (data.topCostoAutobuses) {
            this.topCostoAutobusesData.labels = data.topCostoAutobuses.map(item => item.economico);
            this.topCostoAutobusesData.datasets[0].data = data.topCostoAutobuses.map(item => item.costo_total);
        }
        this.chart?.update();
        this.isLoading = false; 
      },
      error: (err) => {
        console.error('Error al cargar estadísticas base', err);
        this.isLoading = false;
      }
    });
  }

  // ==========================================
  // CARGA DINÁMICA DE KPIs FINANCIEROS
  // ==========================================
  
  filtrarKpis() {
    // Se ejecuta desde el HTML cuando el usuario cambia una fecha
    if (this.fechaInicioKPI && this.fechaFinKPI) {
      this.cargarKpisFinancieros();
    }
  }

  cargarKpisFinancieros() {
    this.isLoadingKpis = true;
    const params = {
      fechaInicio: this.fechaInicioKPI,
      fechaFin: this.fechaFinKPI
    };

    this.http.get<any>(this.apiUrlKpis, { params }).subscribe({
      next: (data) => {
        // 1. Procesar Compras
        const comprasLabels = data.compras.map((c: any) => c.razon_social);
        const comprasValues = data.compras.map((c: any) => parseFloat(c.total));
        this.granTotalCompras = comprasValues.reduce((acc: number, val: number) => acc + val, 0);

        // Reasignamos el objeto completo para forzar la animación en la vista
        this.pieComprasData = {
          labels: comprasLabels,
          datasets: [{
            data: comprasValues,
            backgroundColor: this.coloresCompras,
            hoverOffset: 20 // Hace que la rebanada resalte al pasar el mouse
          }]
        };

        // 2. Procesar Gastos
        const gastosLabels = data.gastos.map((g: any) => g.razon_social);
        const gastosValues = data.gastos.map((g: any) => parseFloat(g.total));
        this.granTotalGastos = gastosValues.reduce((acc: number, val: number) => acc + val, 0);

        this.pieGastosData = {
          labels: gastosLabels,
          datasets: [{
            data: gastosValues,
            backgroundColor: this.coloresGastos,
            hoverOffset: 20
          }]
        };

        this.isLoadingKpis = false;
      },
      error: (err) => {
        console.error('Error al cargar KPIs Financieros', err);
        this.isLoadingKpis = false;
      }
    });
  }
}