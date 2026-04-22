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
  // Ya no usamos el estático, pero lo dejamos en la interfaz por si tu backend antiguo aún lo manda
  topCostoAutobuses?: { economico: string, costo_total: number }[];
}

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  // --- FILTROS DE FECHA PARA EL TOP 5 (NUEVO) ---
  fechaInicioTopBus: string = '';
  fechaFinTopBus: string = '';

  nombreUsuario: string = '';
  faCalendarAlt = faCalendarAlt;
  currentDate: Date = new Date();
  stats: DashboardStats | null = null;
  serviciosPendientes: number = 0;

  private apiUrlStats = `${environment.apiUrl}/dashboard/stats`;
  private apiUrlKpis = `${environment.apiUrl}/reportes/dashboard-kpis`;

  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

  isLoading: boolean = true;
  isLoadingKpis: boolean = true;

  // --- FILTROS DE FECHA (Financieros) ---
  fechaInicioKPI: string = '';
  fechaFinKPI: string = '';

  // --- TOTALES FINANCIEROS ---
  granTotalCompras: number = 0;
  granTotalGastos: number = 0;

  // ==========================================
  // CONFIGURACIÓN DE GRÁFICAS DE BARRAS
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

  // Gráfica de Top 5 Autobuses
  public topCostoAutobusesOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { color: '#e0e0e0' } },
      x: { ticks: { color: '#e0e0e0' } }
    }
  };
  public topCostoAutobusesData: ChartData<'bar'> = {
    labels: [], datasets: [{ data: [], label: 'Costo Total', backgroundColor: 'rgba(239, 68, 68, 0.8)' }]
  };

  // ==========================================
  // CONFIGURACIÓN DE GRÁFICAS DE PASTEL (KPIs)
  // ==========================================
  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: '#e0e0e0', font: { size: 12 } } },
      tooltip: { callbacks: { label: (context) => { let value = context.raw as number; return ` $${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`; } } }
    }
  };

  public pieComprasData: ChartData<'pie'> = { labels: [], datasets: [] };
  public pieGastosData: ChartData<'pie'> = { labels: [], datasets: [] };

  constructor(private http: HttpClient, private authService: AuthService) {
    Chart.register(...registerables);
    const user = this.authService.getCurrentUser();
    this.nombreUsuario = user?.nombre || 'Administrador';
  }

  ngOnInit(): void {
    this.establecerMesActual();
    this.cargarEstadisticas();
    this.cargarKpisFinancieros();
    this.cargarKpiServicios();
    this.cargarTopAutobuses();
  }

  // ==========================================
  // INICIALIZACIÓN DE FECHAS
  // ==========================================
  establecerMesActual() {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    const primerDiaStr = primerDia.toISOString().split('T')[0];
    const ultimoDiaStr = ultimoDia.toISOString().split('T')[0];

    this.fechaInicioKPI = primerDiaStr;
    this.fechaFinKPI = ultimoDiaStr;

    this.fechaInicioTopBus = primerDiaStr;
    this.fechaFinTopBus = ultimoDiaStr;
  }

  cargarKpiServicios() {
    this.http.get<any>(`${environment.apiUrl}/servicios/kpi-pendientes`).subscribe({
      next: (res) => { this.serviciosPendientes = res.pendientes || 0; },
      error: (err) => console.error('Error al cargar KPI de servicios', err)
    });
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
        this.chart?.update();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar estadísticas base', err);
        this.isLoading = false;
      }
    });
  }

  cargarTopAutobuses() {
    if (!this.fechaInicioTopBus || !this.fechaFinTopBus) return;

    const params = { fechaInicio: this.fechaInicioTopBus, fechaFin: this.fechaFinTopBus };

    this.http.get<any[]>(`${environment.apiUrl}/dashboard/top-autobuses`, { params }).subscribe({
      next: (data) => {
        const labels = data.map(item => item.autobus || item.economico || 'Desconocido');
        const values = data.map(item => parseFloat(item.gasto_total || item.costo_total || 0));

        this.topCostoAutobusesData = {
          labels: labels,
          datasets: [{ data: values, label: 'Costo Total ($)', backgroundColor: 'rgba(239, 68, 68, 0.8)' }]
        };
      },
      error: (err) => console.error('Error al cargar el Top de Autobuses Dinámico', err)
    });
  }

  // ==========================================
  // CARGA DINÁMICA DE KPIs FINANCIEROS
  // ==========================================
  filtrarKpis() {
    if (this.fechaInicioKPI && this.fechaFinKPI) {
      this.cargarKpisFinancieros();
    }
  }

  // ==========================================
  // CARGA DINÁMICA DE KPIs FINANCIEROS
  // ==========================================
  cargarKpisFinancieros() {
    this.isLoadingKpis = true;
    const params = { fechaInicio: this.fechaInicioKPI, fechaFin: this.fechaFinKPI };

    this.http.get<any>(this.apiUrlKpis, { params }).subscribe({
      next: (data) => {

        const comprasLabels = data.compras.map((c: any) => c.razon_social);
        const comprasValues = data.compras.map((c: any) => parseFloat(c.total));
        this.granTotalCompras = comprasValues.reduce((acc: number, val: number) => acc + val, 0);

        const coloresDinCompras = comprasLabels.map((etiqueta: string) => {

          if (etiqueta === 'Devolución de Préstamos') return '#06b6d4';
          if (etiqueta === 'TRESA') return '#ef4444';
          if (etiqueta === 'A8M') return '#3b82f6';
          if (etiqueta === 'MARTRESS') return '#eab308';
          if (etiqueta === 'GIALJU') return '#8b5cf6';
          if (etiqueta === 'Flota Administrativa') return '#10b981';
          if (etiqueta === 'Sin Razón Social') return '#f97316';

          return '#64748b';
        });

        this.pieComprasData = {
          labels: comprasLabels,
          datasets: [{ data: comprasValues, backgroundColor: coloresDinCompras, hoverOffset: 20 }]
        };

        const gastosLabels = data.gastos.map((g: any) => g.razon_social);
        const gastosValues = data.gastos.map((g: any) => parseFloat(g.total));
        this.granTotalGastos = gastosValues.reduce((acc: number, val: number) => acc + val, 0);

        const coloresDinGastos = gastosLabels.map((etiqueta: string) => {
          if (etiqueta === 'Préstamos' || etiqueta === 'Material en Préstamo') return '#ec4899';
          if (etiqueta === 'TRESA') return '#ef4444';
          if (etiqueta === 'A8M') return '#3b82f6';
          if (etiqueta === 'MARTRESS') return '#eab308';
          if (etiqueta === 'GIALJU') return '#8b5cf6';
          if (etiqueta === 'Flota Administrativa') return '#10b981';
          if (etiqueta === 'Sin Razón Social') return '#f97316';

          return '#64748b';
        });

        this.pieGastosData = {
          labels: gastosLabels,
          datasets: [{ data: gastosValues, backgroundColor: coloresDinGastos, hoverOffset: 20 }]
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