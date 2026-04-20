import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environments';
import { AuthService } from '../../../services/auth.service';
import { FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

export interface ViajeTurismo {
  id_viaje: number;
  folio_manual: string;
  fecha_salida: string;
  hora_salida: string;
  fecha_regreso?: string;
  hora_regreso?: string;
  nombre_cliente: string;
  telefono_cliente: string;
  lugar_salida: string;
  destino: string;
  costo_total: number;
  total_abonado: number;
  km_estimados: number;
  rendimiento?: number;
  km_reales?: number;
  estatus: 'RESERVADO' | 'EN RUTA' | 'LIQUIDADO' | 'CANCELADO';
  autobus?: string;
  chofer?: string;
}

@Component({
  selector: 'app-viajes-turismo',
  standalone: false,
  templateUrl: './viajes-turismo.component.html',
  styleUrls: ['./viajes-turismo.component.css']
})
export class ViajesTurismoComponent implements OnInit {
  
  vistaActual: 'kanban' | 'tabla' = 'kanban';
  private apiUrl = `${environment.apiUrl}/viajes-turismo`;

  todosLosViajes: ViajeTurismo[] = [];
  viajesReservados: ViajeTurismo[] = [];
  viajesEnRuta: ViajeTurismo[] = [];
  viajesLiquidados: ViajeTurismo[] = [];
  autobusesDisponibles: any[] = [];
  
  autobusControl = new FormControl(); 
  choferControl = new FormControl();
  filteredAutobuses$: Observable<any[]>; 
  filteredChoferes$: Observable<any[]>;

  terminoBusqueda: string = ''; 
  paginaActual: number = 1; 
  itemsPorPagina: number = 10; 
  loading = false;

  mostrarModalReserva = false; 
  mostrarModalDespacho = false; 
  mostrarModalLiquidacion = false; 
  mostrarModalNotificacion = false;

  nuevaReserva = { 
    folio_manual: '', fecha_salida: '', hora_salida: '', fecha_regreso: '', hora_regreso: '', 
    nombre_cliente: '', telefono_cliente: '', lugar_salida: '', destino: '', 
    costo_total: null as number | null, abono_inicial: null as number | null, observaciones: '',
    km_estimados: null as number | null
  };
  
  datosDespacho = { id_viaje: 0, id_autobus: null as number | null, id_chofer: null as number | null };
  
  datosLiquidacion = { 
    id_viaje: 0, km_inicial: 0, km_final: null as number | null, efectivo_entregado: null as number | null, 
    gasto_casetas: null as number | null, gasto_sueldo_chofer: null as number | null, otros_gastos: null as number | null, 
    observaciones_gastos: '', costo_total: 0, total_abonado: 0, km_estimados: 0,
    litros_diesel: null as number | null, motivo_desviacion_km: ''
  };
  
  notificacion = { titulo: '', mensaje: '', tipo: 'exito' as 'exito' | 'error' | 'advertencia' };

  constructor(private http: HttpClient, public authService: AuthService) {
    this.filteredAutobuses$ = this.autobusControl.valueChanges.pipe(
      startWith(''), debounceTime(300), distinctUntilChanged(), 
      switchMap(value => this._buscarApi('autobuses', value || ''))
    );
    this.filteredChoferes$ = this.choferControl.valueChanges.pipe(
      startWith(''), debounceTime(300), distinctUntilChanged(), 
      switchMap(value => this._buscarApi('operadores', value || ''))
    );
  }

  ngOnInit(): void {
    this.cargarViajes();
    // Extraemos la data de forma segura para evitar el error del .find()
    this.http.get<any>(`${environment.apiUrl}/autobuses`).subscribe(res => {
      this.autobusesDisponibles = res.data || res; 
    });
  }

  private _buscarApi(tipo: 'autobuses' | 'operadores', term: any): Observable<any[]> {
    const searchTerm = typeof term === 'string' ? term : (term.economico || term.nombre_completo || term.nombre);
    if (!searchTerm) return of([]);
    return this.http.get<any[]>(`${environment.apiUrl}/${tipo}/buscar`, { params: { term: searchTerm } });
  }

  displayFnAutobus(item: any): string { return item ? `Bus ${item.economico}` : ''; }
  displayFnChofer(item: any): string { return item ? (item.nombre_completo || item.nombre) : ''; }

  onAutobusSelected(event: MatAutocompleteSelectedEvent): void { 
    this.datosDespacho.id_autobus = event.option.value.id_autobus; 
  }
  
  onChoferSelected(event: MatAutocompleteSelectedEvent): void { 
    const val = event.option.value;
    this.datosDespacho.id_chofer = val.id_operador || val.id_empleado || val.id; 
  }

  cambiarVista(vista: 'kanban' | 'tabla') { this.vistaActual = vista; }

  cargarViajes() {
    this.loading = true;
    this.http.get<ViajeTurismo[]>(this.apiUrl).subscribe({
      next: (data) => { 
        this.todosLosViajes = data; 
        this.distribuirKanban(data); 
        this.loading = false; 
      },
      error: () => { 
        this.mostrarNotificacion('Error', 'No se pudieron cargar los viajes.', 'error'); 
        this.loading = false; 
      }
    });
  }

  distribuirKanban(viajes: ViajeTurismo[]) {
    this.viajesReservados = viajes.filter(v => v.estatus === 'RESERVADO');
    this.viajesEnRuta = viajes.filter(v => v.estatus === 'EN RUTA');
    this.viajesLiquidados = viajes.filter(v => v.estatus === 'LIQUIDADO').slice(0, 15);
  }

  get getViajesTabla() {
    if (!this.terminoBusqueda) return this.todosLosViajes;
    const term = this.terminoBusqueda.toLowerCase();
    return this.todosLosViajes.filter(v => 
      v.nombre_cliente.toLowerCase().includes(term) || 
      v.destino.toLowerCase().includes(term) || 
      (v.folio_manual && v.folio_manual.toLowerCase().includes(term))
    );
  }

  abrirModalReserva() {
    this.nuevaReserva = { 
      folio_manual: '', fecha_salida: '', hora_salida: '', fecha_regreso: '', hora_regreso: '', 
      nombre_cliente: '', telefono_cliente: '', lugar_salida: '', destino: '', 
      costo_total: null, abono_inicial: null, observaciones: '', km_estimados: null 
    };
    this.mostrarModalReserva = true;
  }

  guardarReserva() {
    if (!this.nuevaReserva.nombre_cliente || !this.nuevaReserva.destino || !this.nuevaReserva.costo_total || !this.nuevaReserva.fecha_salida) { 
      this.mostrarNotificacion('Incompleto', 'Llena los campos obligatorios (*).', 'advertencia'); return; 
    }
    this.http.post(`${this.apiUrl}/reserva`, this.nuevaReserva).subscribe({
      next: () => { this.mostrarNotificacion('Éxito', 'Reserva guardada.', 'exito'); this.mostrarModalReserva = false; this.cargarViajes(); },
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'Error al guardar.', 'error')
    });
  }

  abrirModalDespacho(viaje: ViajeTurismo) {
    this.datosDespacho = { id_viaje: viaje.id_viaje, id_autobus: null, id_chofer: null };
    this.autobusControl.setValue(''); this.choferControl.setValue('');
    this.mostrarModalDespacho = true;
  }

  guardarDespacho() {
    if (!this.datosDespacho.id_autobus || !this.datosDespacho.id_chofer) { 
      this.mostrarNotificacion('Atención', 'Busca y selecciona autobús y operador de la lista.', 'advertencia'); return; 
    }
    this.http.put(`${this.apiUrl}/despacho/${this.datosDespacho.id_viaje}`, this.datosDespacho).subscribe({
      next: () => { this.mostrarNotificacion('En Ruta', 'Unidad despachada.', 'exito'); this.mostrarModalDespacho = false; this.cargarViajes(); },
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo asignar.', 'error')
    });
  }

  abrirModalLiquidacion(viaje: ViajeTurismo) {
    this.datosLiquidacion = { 
      id_viaje: viaje.id_viaje, km_inicial: 0, km_final: null, efectivo_entregado: null, 
      gasto_casetas: null, gasto_sueldo_chofer: null, otros_gastos: null, observaciones_gastos: '', 
      costo_total: viaje.costo_total, total_abonado: viaje.total_abonado, 
      km_estimados: viaje.km_estimados, litros_diesel: null, motivo_desviacion_km: '' 
    };
    
    if (Array.isArray(this.autobusesDisponibles)) {
      const bus = this.autobusesDisponibles.find(b => String(b.economico) === String(viaje.autobus));
      if (bus) this.datosLiquidacion.km_inicial = bus.kilometraje_actual || 0;
    }
    this.mostrarModalLiquidacion = true;
  }

  // --- TELEMETRÍA DINÁMICA ---
  get kmRecorridos() {
    if (!this.datosLiquidacion.km_final || !this.datosLiquidacion.km_inicial) return 0;
    return this.datosLiquidacion.km_final - this.datosLiquidacion.km_inicial;
  }

  get desviacionKm() { return Math.abs(this.kmRecorridos - (this.datosLiquidacion.km_estimados || 0)); }
  get requiereJustificacionKm() { return this.desviacionKm > 10 && this.datosLiquidacion.km_final !== null; }

  get rendimientoDiesel() {
    if (!this.datosLiquidacion.litros_diesel || this.datosLiquidacion.litros_diesel <= 0 || this.kmRecorridos <= 0) return 0;
    return this.kmRecorridos / this.datosLiquidacion.litros_diesel;
  }

  calcularUtilidadNeta() { 
    return this.datosLiquidacion.costo_total - ((this.datosLiquidacion.gasto_casetas || 0) + (this.datosLiquidacion.gasto_sueldo_chofer || 0) + (this.datosLiquidacion.otros_gastos || 0)); 
  }

  guardarLiquidacion() {
    if (!this.datosLiquidacion.km_final || this.datosLiquidacion.km_final <= this.datosLiquidacion.km_inicial) { 
      this.mostrarNotificacion('Error', 'El KM Final debe ser mayor al Inicial.', 'error'); return; 
    }

    if (this.requiereJustificacionKm && !this.datosLiquidacion.motivo_desviacion_km) {
      this.mostrarNotificacion('Alerta Logística', 'La desviación de kilómetros es alta. Debes escribir una justificación.', 'advertencia'); return;
    }

    const payload = { ...this.datosLiquidacion, rendimiento: this.rendimientoDiesel };

    this.http.post(`${this.apiUrl}/liquidacion`, payload).subscribe({
      next: () => { this.mostrarNotificacion('Liquidado', 'Viaje cerrado y estadísticas actualizadas.', 'exito'); this.mostrarModalLiquidacion = false; this.cargarViajes(); },
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo liquidar.', 'error')
    });
  }

  revertirEstatus(viaje: ViajeTurismo, nuevoEstatus: string) {
    if(confirm(`¿Estás seguro de revertir este viaje a "${nuevoEstatus}"?`)) {
      this.http.put(`${this.apiUrl}/revertir/${viaje.id_viaje}`, { estatus: nuevoEstatus }).subscribe({
        next: () => { this.mostrarNotificacion('Éxito', `Viaje regresado a ${nuevoEstatus}.`, 'exito'); this.cargarViajes(); },
        error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'Error al revertir.', 'error')
      });
    }
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia') { 
    this.notificacion = { titulo, mensaje, tipo }; 
    this.mostrarModalNotificacion = true; 
  }
  cerrarNotificacion() { this.mostrarModalNotificacion = false; }
}