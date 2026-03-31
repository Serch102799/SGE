import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormControl } from '@angular/forms'; 
import { Observable } from 'rxjs'; 
import { startWith, map, debounceTime, distinctUntilChanged } from 'rxjs/operators'; 
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete'; 
import { ChartConfiguration, ChartData, Chart, registerables } from 'chart.js';
import { environment } from '../../../../environments/environments';
import { BaseChartDirective } from 'ng2-charts';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-dash-consumo',
  standalone: false,
  templateUrl: './dash-consumo.component.html',
  styleUrls: ['./dash-consumo.component.css']
})
export class DashConsumoComponent implements OnInit {
  @ViewChild(BaseChartDirective) chartTendencia: BaseChartDirective | undefined;
  
  private apiUrl = `${environment.apiUrl}/cargas-combustible`;
  
  isLoading: boolean = false;

  // Filtros
  fechaDesde: string = '';
  fechaHasta: string = '';
  terminoBusqueda: string = ''; 

  // ==========================================
  // LÓGICA DE AUTOCOMPLETADO (Corregida)
  // ==========================================
  buscadorControl = new FormControl('');
  opcionesSugeridas: string[] = []; // Aquí guardaremos todas las coincidencias
  opcionesFiltradas$!: Observable<string[]>;

  // KPIs
  totalLitros: number = 0;
  totalKm: number = 0;
  rendimientoGlobal: number = 0;

  // ==========================================
  // GRÁFICA 1: TENDENCIA POR DÍA
  // ==========================================
  public chartTendenciaOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, labels: { color: '#e0e0e0' } }, tooltip: { mode: 'index', intersect: false } },
    scales: {
      x: { ticks: { color: '#a7b7d2' }, grid: { color: 'rgba(255,255,255,0.05)' } },
      y: { ticks: { color: '#a7b7d2' }, grid: { color: 'rgba(255,255,255,0.05)' } }
    }
  };
  public chartTendenciaData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [], label: 'Litros Consumidos', backgroundColor: 'rgba(56, 189, 248, 0.7)', borderColor: '#38bdf8', borderWidth: 1, borderRadius: 4 }]
  };

  // ==========================================
  // GRÁFICA 2: TOP AUTOBUSES CONSUMIDORES
  // ==========================================
  public chartTopBusesOptions: ChartConfiguration['options'] = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'right', labels: { color: '#e0e0e0' } } }
  };
  public chartTopBusesData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#64748b'] }]
  };

  constructor(private http: HttpClient, public authService: AuthService) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.establecerSemanaActual();
    this.cargarCatalogosParaSugerencias(); 
    this.cargarDatos();

    // 1. Filtrado del menú desplegable del Autocomplete
    this.opcionesFiltradas$ = this.buscadorControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filtrarSugerencias(value || ''))
    );

    // 2. Búsqueda en vivo (Live Search)
    this.buscadorControl.valueChanges.pipe(
      debounceTime(500), 
      distinctUntilChanged()
    ).subscribe(val => {
      this.terminoBusqueda = val || '';
      this.cargarDatos(); 
    });
  }

  establecerSemanaActual() {
    const hoy = new Date();
    const diaSemana = hoy.getDay() || 7; 
    const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - diaSemana + 1);
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    this.fechaDesde = lunes.toISOString().split('T')[0];
    this.fechaHasta = domingo.toISOString().split('T')[0];
  }

  // ==========================================
  // CARGAR DICCIONARIO DE SUGERENCIAS (Corregido)
  // ==========================================
  cargarCatalogosParaSugerencias() {
    // 1. Traer Rutas (Mismo endpoint que tu Registro de Cargas)
    this.http.get<any>(`${environment.apiUrl}/rutas`).subscribe({
      next: (res) => {
        const data = res.data || res; // Extraemos por si viene envuelto en "data"
        const nombresRutas = data.map((r: any) => r.nombre_ruta).filter(Boolean);
        this.opcionesSugeridas = [...this.opcionesSugeridas, ...nombresRutas];
      }
    });

    // 2. Traer Autobuses
    this.http.get<any>(`${environment.apiUrl}/autobuses`).subscribe({
      next: (res) => {
        const data = res.data || res;
        const economicosBuses = data.map((b: any) => b.economico).filter(Boolean);
        this.opcionesSugeridas = [...this.opcionesSugeridas, ...economicosBuses];
      }
    });

    // 3. Traer Operadores (Buscamos por nombre_completo como en tu componente)
    this.http.get<any>(`${environment.apiUrl}/operadores`).subscribe({
      next: (res) => {
        const data = res.data || res;
        const nombresOperadores = data.map((o: any) => o.nombre_completo).filter(Boolean);
        this.opcionesSugeridas = [...this.opcionesSugeridas, ...nombresOperadores];
      },
      error: () => {
        // Fallback por si tu endpoint de operadores está en otra ruta
        this.http.get<any>(`${environment.apiUrl}/empleados/operadores`).subscribe(res => {
          const data = res.data || res;
          const nombresOperadores = data.map((o: any) => o.nombre_completo || o.nombre).filter(Boolean);
          this.opcionesSugeridas = [...this.opcionesSugeridas, ...nombresOperadores];
        });
      }
    });
  }

  private _filtrarSugerencias(value: string): string[] {
    const filterValue = value.toLowerCase();
    // Limita a 10 resultados para no tapar toda la pantalla
    return this.opcionesSugeridas
      .filter(opcion => opcion.toLowerCase().includes(filterValue))
      .slice(0, 10); 
  }

  onOpcionSeleccionada(event: MatAutocompleteSelectedEvent) {
    this.terminoBusqueda = event.option.value;
    this.cargarDatos();
  }

  cargarDatos() {
    this.isLoading = true;

    // Reutilizamos el endpoint general pero pidiendo todos los datos del periodo
    let params = new HttpParams()
      .set('page', '1')
      .set('limit', '10000') 
      .set('fecha_desde', this.fechaDesde)
      .set('fecha_hasta', this.fechaHasta);

    if (this.terminoBusqueda.trim()) {
      params = params.set('search', this.terminoBusqueda.trim());
    }

    this.http.get<{ total: number, data: any[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        const cargas = response.data || [];
        this.procesarDatosGraficas(cargas);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando dashboard de consumo', err);
        this.isLoading = false;
      }
    });
  }

  procesarDatosGraficas(cargas: any[]) {
    this.totalLitros = 0; this.totalKm = 0;
    const agrupadoPorDia: { [key: string]: number } = {};
    const agrupadoPorBus: { [key: string]: number } = {};

    cargas.forEach(carga => {
      const litros = parseFloat(carga.litros_cargados) || 0;
      const km = parseFloat(carga.km_recorridos) || 0;
      this.totalLitros += litros; this.totalKm += km;

      if (carga.fecha_operacion) {
        const fecha = new Date(carga.fecha_operacion);
        fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset()); 
        const diaStr = fecha.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' });
        if (!agrupadoPorDia[diaStr]) agrupadoPorDia[diaStr] = 0;
        agrupadoPorDia[diaStr] += litros;
      }

      const busStr = `Bus ${carga.economico || 'S/D'}`;
      if (!agrupadoPorBus[busStr]) agrupadoPorBus[busStr] = 0;
      agrupadoPorBus[busStr] += litros;
    });

    this.rendimientoGlobal = this.totalLitros > 0 ? (this.totalKm / this.totalLitros) : 0;

    this.chartTendenciaData.labels = Object.keys(agrupadoPorDia);
    this.chartTendenciaData.datasets[0].data = Object.values(agrupadoPorDia);

    const busesOrdenados = Object.entries(agrupadoPorBus)
      .map(([bus, litros]) => ({ bus, litros })).sort((a, b) => b.litros - a.litros).slice(0, 6);

    this.chartTopBusesData.labels = busesOrdenados.map(b => b.bus);
    this.chartTopBusesData.datasets[0].data = busesOrdenados.map(b => b.litros);

    this.chartTendencia?.update();
  }

  limpiarFiltros() {
    this.buscadorControl.setValue('', { emitEvent: false }); 
    this.terminoBusqueda = '';
    this.establecerSemanaActual();
    this.cargarDatos();
  }
}