import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChartConfiguration, ChartData } from 'chart.js';
import { environment } from '../../../../environments/environments';

interface DashboardStats {
  totalRefacciones: number;
  refaccionesStockBajo: number;
  valorTotalInventario: number;
  topStock: { nombre: string, stock_actual: number }[];
  lowStockItems: { nombre: string, stock_actual: number, stock_minimo: number }[];
  ultimasEntradas: { id_detalle_entrada: number, fecha_entrada: string, nombre_refaccion: string, cantidad_recibida: number }[];
  ultimasSalidas: { id_detalle_salida: number, fecha_salida: string, nombre_refaccion: string, cantidad_despachada: number }[];

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

  // --- Configuración Gráfica Top Stock ---
  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { color: '#e0e0e0' } },
      x: { ticks: { color: '#e0e0e0' } }
    }
  };
  public barChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Stock Actual',
        backgroundColor: 'rgba(68, 128, 211, 0.8)',
        borderColor: '#4480d3'
      }
    ]
  };

  public lowStockChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: true, labels: {
          color: '#e0e0e0'
        }
      }
    },
    scales: {
      x: { ticks: { color: '#e0e0e0' } },
      y: { ticks: { color: '#e0e0e0' } }
    }
  };
  public lowStockChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      { data: [], label: 'Stock Actual', backgroundColor: '#f0ad4e' },
      { data: [], label: 'Stock Mínimo', backgroundColor: '#d9534f' }
    ]
  };



  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.cargarEstadisticas();
  }

  cargarEstadisticas() {
    this.http.get<DashboardStats>(this.apiUrl).subscribe({
      next: (data) => {
        this.stats = data;

        console.log('Datos recibidos de la API del dashboard:', data);

        if (this.stats && this.stats.topStock) {
          this.barChartData.labels = this.stats.topStock.map(item => item.nombre);
          this.barChartData.datasets[0].data = this.stats.topStock.map(item => item.stock_actual);
        }

        if (this.stats && this.stats.lowStockItems) {
          this.lowStockChartData.labels = this.stats.lowStockItems.map(item => item.nombre);
          this.lowStockChartData.datasets[0].data = this.stats.lowStockItems.map(item => item.stock_actual);
          this.lowStockChartData.datasets[1].data = this.stats.lowStockItems.map(item => item.stock_minimo);
        }
      },
      error: (err) => console.error('Error al cargar estadísticas', err)
    });
  }
}