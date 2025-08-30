import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChartConfiguration, ChartData, Chart, registerables } from 'chart.js';
import { environment } from '../../../../environments/environments';
import { BaseChartDirective } from 'ng2-charts';

// CAMBIO: La interfaz ahora refleja la nueva y completa respuesta de la API
interface DashboardStats {
  totalRefacciones: number;
  totalInsumos: number;
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

  stats: DashboardStats | null = null;
  private apiUrl = `${environment.apiUrl}/dashboard/stats`;
  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

  // --- Gráfica Top Stock REFACCIONES ---
  public topStockRefaccionesOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { color: '#e0e0e0' } }, x: { ticks: { color: '#e0e0e0' } } }
  };
  public topStockRefaccionesData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], label: 'Stock Actual', backgroundColor: 'rgba(68, 128, 211, 0.8)' }]
  };

  // --- Gráfica Top Stock INSUMOS ---
  public topStockInsumosOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { color: '#e0e0e0' } }, x: { ticks: { color: '#e0e0e0' } } }
  };
  public topStockInsumosData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], label: 'Stock Actual', backgroundColor: 'rgba(77, 182, 172, 0.8)' }] // Color diferente para insumos
  };

  // --- Gráfica Costo por Autobús ---
  public topCostoAutobusesOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } },
    scales: { y: { ticks: { color: '#e0e0e0' } }, x: { ticks: { color: '#e0e0e0' } } }
  };
  public topCostoAutobusesData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], label: 'Costo Total', backgroundColor: 'rgba(211, 75, 68, 0.8)' }]
  };
  isLoading: boolean = true;


  constructor(private http: HttpClient) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.cargarEstadisticas();
  }

  cargarEstadisticas() {
    this.isLoading = true; 
    this.http.get<DashboardStats>(this.apiUrl).subscribe({
      next: (data) => {
        this.stats = data;
        console.log('Datos recibidos del dashboard:', data);

        // Poblar gráfica de Top 5 Refacciones
        if (data.topStockRefacciones) {
          this.topStockRefaccionesData.labels = data.topStockRefacciones.map(item => item.nombre);
          this.topStockRefaccionesData.datasets[0].data = data.topStockRefacciones.map(item => item.stock_actual);
        }
        
        // Poblar gráfica de Top 5 Insumos
        if (data.topStockInsumos) {
          this.topStockInsumosData.labels = data.topStockInsumos.map(item => item.nombre);
          this.topStockInsumosData.datasets[0].data = data.topStockInsumos.map(item => item.stock_actual);
        }
        
        // Poblar gráfica de Costo por Autobús
        if (data.topCostoAutobuses) {
            this.topCostoAutobusesData.labels = data.topCostoAutobuses.map(item => item.economico);
            this.topCostoAutobusesData.datasets[0].data = data.topCostoAutobuses.map(item => item.costo_total);
        }

        // Actualiza las gráficas para que se redibujen con los nuevos datos
        this.chart?.update();
        this.isLoading = false; 
      },
      error: (err) => {console.error('Error al cargar estadísticas', err);
        this.isLoading = false;}
    });
  }
}