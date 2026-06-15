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
  serviciosUrgentes: number = 0;
  serviciosProximos: number = 0;

  proyeccion: any = {
    servicios_proyectados: 0,
    gasto_estimado: 0,
    compras_sugeridas: []
  };
  isLoadingProyeccion = true;

  private apiUrlStats = `${environment.apiUrl}/dashboard/stats`;
  private apiUrlKpis = `${environment.apiUrl}/reportes/dashboard-kpis`;

  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

  isLoading: boolean = true;
  isLoadingKpis: boolean = true;

  // --- FILTROS DE FECHA (Financieros) ---
  fechaInicioKPI: string = '';
  fechaFinKPI: string = '';
  razonSocialKPI: string = 'Todas';

  // --- FILTROS TENDENCIA HISTÓRICA ---
  filtroRazonSocialTendencia: string = 'Todas';

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

  // ==========================================
  // CONFIGURACIÓN DE GRÁFICA DE TENDENCIA (LÍNEAS)
  // ==========================================
  public tendenciaHistoricaOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false,
    elements: { line: { tension: 0.4 }, point: { radius: 4 } },
    plugins: {
      legend: { position: 'top', labels: { color: '#e0e0e0', font: { size: 12 } } },
      tooltip: { 
        mode: 'index', 
        intersect: false,
        callbacks: {
          label: (context) => {
            let value = context.raw as number;
            return ` $${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
          }
        }
      }
    },
    scales: {
      y: { 
        ticks: { 
          color: '#e0e0e0',
          callback: function(value) { return '$' + value; }
        }, 
        grid: { color: 'rgba(255,255,255,0.05)' } 
      },
      x: { ticks: { color: '#e0e0e0' }, grid: { color: 'rgba(255,255,255,0.05)' } }
    }
  };
  public tendenciaHistoricaData: ChartData<'line'> = {
    labels: [],
    datasets: [
      { data: [], label: 'Total Entradas ($)', borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', fill: true },
      { data: [], label: 'Total Salidas ($)', borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.2)', fill: true }
    ]
  };

  listaRazonesSociales: string[] = ['Todas', 'TRESA', 'A8M', 'MARTRESS', 'GIALJU', 'Flota Administrativa', 'Sin Razón Social'];

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
    this.cargarProyeccion();
    this.cargarTendenciaHistorica();
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
      next: (res) => {
        this.serviciosUrgentes = res.urgentes || 0;
        this.serviciosProximos = res.proximos || 0;
      },
      error: (err) => console.error('Error al cargar KPI de servicios', err)
    });
  }
  cargarProyeccion() {
    this.http.get<any>(`${environment.apiUrl}/dashboard/proyeccion-compras`).subscribe({
      next: (res) => {
        this.proyeccion = res;
        this.isLoadingProyeccion = false;
      },
      error: (err) => {
        console.error('Error cargando proyecciones', err);
        this.isLoadingProyeccion = false;
      }
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
  // CARGA DINÁMICA DE KPIs FINANCIEROS Y TENDENCIA
  // ==========================================
  filtrarKpis() {
    if (this.fechaInicioKPI && this.fechaFinKPI) {
      this.cargarKpisFinancieros();
      this.cargarTendenciaHistorica();
    }
  }

  cargarTendenciaHistorica() {
    if (!this.fechaInicioKPI || !this.fechaFinKPI) return;

    const params = {
      fechaInicio: this.fechaInicioKPI,
      fechaFin: this.fechaFinKPI,
      razon_social_filtro: this.filtroRazonSocialTendencia
    };

    this.http.get<any[]>(`${environment.apiUrl}/reportes/tendencia-historica`, { params }).subscribe({
      next: (data) => {
        // Mapear meses: "2026-01" -> "Ene 2026"
        const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        
        const labels = data.map(item => {
          const [year, month] = item.mes.split('-');
          return `${mesesNombres[parseInt(month) - 1]} ${year}`;
        });
        
        const entradas = data.map(item => parseFloat(item.total_entradas || 0));
        const salidas = data.map(item => parseFloat(item.total_salidas || 0));

        this.tendenciaHistoricaData = {
          labels: labels,
          datasets: [
            { data: entradas, label: 'Total Entradas ($)', borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.2)', fill: true },
            { data: salidas, label: 'Total Salidas ($)', borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.2)', fill: true }
          ]
        };
        this.chart?.update();
      },
      error: (err) => console.error('Error al cargar la tendencia histórica', err)
    });
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

          if (etiqueta === 'Devolución de Gastos de Taller') return '#06b6d4';
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
          if (etiqueta === 'Gastos de Taller' || etiqueta === 'Material en Gasto de Taller') return '#ec4899';
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