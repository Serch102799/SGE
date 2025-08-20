import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Router } from '@angular/router';

// --- Interfaces ---
export interface Autobus {
  id_autobus: number;
  economico: string;
  marca: string;
  modelo: string;
  anio: number;
  kilometraje_actual: number;
  vin: string;
  razon_social: string;
  chasis: string;
  motor: string;
  tarjeta_circulacion: string;
  placa: string;
  sistema: string;
  hp: number;
  carroceria: string;
  sistema_electrico: string;
  medida_llanta: string;
}

@Component({
  selector: 'app-autobuses',
  standalone: false,
  templateUrl: './autobuses.component.html',
  styleUrls: ['./autobuses.component.css']
})
export class AutobusesComponent implements OnInit, OnDestroy {

  autobuses: Autobus[] = [];
  private apiUrl = `${environment.apiUrl}/autobuses`;
  private historialApiUrl = `${environment.apiUrl}/historial`;

  // --- Listas para Dropdowns ---
  razonesSociales: string[] = ['MARTRESS', 'A8M', 'TRESA', 'GIALJU'];
  sistemasEmisiones: string[] = ['UREA', 'EGR', 'OTRO'];

  // --- Estado de la Tabla ---
  sortField: string = 'economico';
  sortDirection: 'asc' | 'desc' = 'asc';
  currentPage: number = 1;
  itemsPerPage: number = 10; 
  totalItems: number = 0;

  // --- Búsqueda ---
  terminoBusqueda: string = '';
  private searchSubject: Subject<string> = new Subject<string>();
  private searchSubscription?: Subscription;

  // --- Estado de los Modales ---
  mostrarModal = false;
  modoEdicion = false;
  autobusSeleccionado: Partial<Autobus> = {};
  
  mostrarModalBorrar = false;
  autobusABorrar: Autobus | null = null;

  mostrarModalDetalles = false;
  autobusParaDetalles: Autobus | null = null;
  
  mostrarModalHistorial = false;
  historialCompleto: any[] = [];
  historialFiltrado: any[] = [];
  autobusSeleccionadoEconomico: string | null = null;
  costoTotalHistorial: number = 0;
  
  filtroHistorialItem: string = '';
  filtroHistorialFechaInicio: string = '';
  filtroHistorialFechaFin: string = '';
  
  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient, public authService: AuthService, private router: Router) { }

  ngOnInit(): void {
    this.obtenerAutobuses();
    
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerAutobuses();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }
  
  obtenerAutobuses(): void {
    const params = {
      page: this.currentPage.toString(),
      limit: this.itemsPerPage.toString(),
      search: this.terminoBusqueda.trim(),
      sortBy: this.sortField,
      sortOrder: this.sortDirection
    };

    this.http.get<{ total: number, data: Autobus[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.autobuses = response.data || [];
        this.totalItems = response.total || 0;
      },
      error: (err) => {
        console.error('Error al obtener autobuses', err);
        this.mostrarNotificacion('Error', 'No se pudo cargar la lista de autobuses.', 'error');
        this.autobuses = [];
        this.totalItems = 0;
      }
    });
  }
  
  onSort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.obtenerAutobuses();
  }

  onSearchChange(): void {
    this.searchSubject.next(this.terminoBusqueda);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerAutobuses();
  }

  abrirModal(modo: 'agregar' | 'editar', autobus?: Autobus): void {
    this.modoEdicion = (modo === 'editar');
    if (modo === 'editar' && autobus) {
      this.autobusSeleccionado = { ...autobus };
    } else {
      // Se inicializan TODOS los campos para un nuevo autobús
      this.autobusSeleccionado = {
        economico: '', vin: '', razon_social: '', placa: '', chasis: '',
        motor: '', tarjeta_circulacion: '', sistema: '', hp: undefined,
        carroceria: '', sistema_electrico: '', medida_llanta: ''
      };
    }
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }

  guardarAutobus(): void {
    if (!this.autobusSeleccionado.economico || !this.autobusSeleccionado.vin || !this.autobusSeleccionado.razon_social || !this.autobusSeleccionado.placa) {
      this.mostrarNotificacion('Campos Requeridos', 'Económico, VIN, Razón Social y Placa son obligatorios.');
      return;
    }

    // Se construye el payload con TODOS los campos, incluyendo los nuevos
    const payload = {
      Economico: this.autobusSeleccionado.economico,
      Marca: this.autobusSeleccionado.marca,
      Modelo: this.autobusSeleccionado.modelo,
      Anio: this.autobusSeleccionado.anio,
      Kilometraje_Actual: this.autobusSeleccionado.kilometraje_actual,
      VIN: this.autobusSeleccionado.vin,
      Razon_Social: this.autobusSeleccionado.razon_social,
      Chasis: this.autobusSeleccionado.chasis,
      Motor: this.autobusSeleccionado.motor,
      Tarjeta_Circulacion: this.autobusSeleccionado.tarjeta_circulacion,
      Placa: this.autobusSeleccionado.placa,
      Sistema: this.autobusSeleccionado.sistema,
      HP: this.autobusSeleccionado.hp,
      Carroceria: this.autobusSeleccionado.carroceria,
      Sistema_Electrico: this.autobusSeleccionado.sistema_electrico,
      Medida_Llanta: this.autobusSeleccionado.medida_llanta
    };

    const request = this.modoEdicion
      ? this.http.put(`${this.apiUrl}/${this.autobusSeleccionado.id_autobus}`, payload)
      : this.http.post(this.apiUrl, payload);

    request.subscribe({
      next: () => this.postGuardado(`Autobús ${this.modoEdicion ? 'actualizado' : 'creado'} exitosamente.`),
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || `No se pudo ${this.modoEdicion ? 'actualizar' : 'crear'}.`, 'error')
    });
  }

  abrirModalBorrar(autobus: Autobus): void {
    this.autobusABorrar = autobus;
    this.mostrarModalBorrar = true;
  }

  cerrarModalBorrar(): void {
    this.mostrarModalBorrar = false;
    this.autobusABorrar = null;
  }

  confirmarEliminacion(): void {
    if (!this.autobusABorrar) return;
    const url = `${this.apiUrl}/${this.autobusABorrar.id_autobus}`;
    this.http.delete(url).subscribe({
      next: () => this.postGuardado('Autobús eliminado exitosamente.'),
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo eliminar.', 'error')
    });
  }

  private postGuardado(mensaje: string): void {
    this.mostrarNotificacion('Éxito', mensaje, 'exito');
    this.obtenerAutobuses(); 
    this.cerrarModal();
    this.cerrarModalBorrar();
  }

  abrirModalDetalles(autobus: Autobus): void {
    this.autobusParaDetalles = autobus;
    this.mostrarModalDetalles = true;
  }

  cerrarModalDetalles(): void {
    this.mostrarModalDetalles = false;
    this.autobusParaDetalles = null;
  }

  editarDesdeDetalles(): void {
    if (this.autobusParaDetalles) {
      this.abrirModal('editar', this.autobusParaDetalles as Autobus);
      this.cerrarModalDetalles();
    }
  }

  verHistorialDesdeDetalles(): void {
    if (this.autobusParaDetalles) {
      this.verHistorial(this.autobusParaDetalles as Autobus);
      this.cerrarModalDetalles();
    }
  }

  verHistorial(autobus: Autobus): void {
    this.autobusSeleccionadoEconomico = autobus.economico;
    
    this.http.get<{ historial: any[], costoTotal: number }>(`${this.historialApiUrl}/${autobus.id_autobus}`).subscribe({
      next: (respuesta) => {
        this.historialCompleto = respuesta.historial;
        this.costoTotalHistorial = respuesta.costoTotal;
        this.aplicarFiltroHistorial(); 
        this.mostrarModalHistorial = true;
      },
      error: (err) => this.mostrarNotificacion('Error', 'No se pudo cargar el historial.', 'error')
    });
  }

  cerrarModalHistorial(): void {
    this.mostrarModalHistorial = false;
    this.historialCompleto = [];
    this.historialFiltrado = [];
    this.filtroHistorialItem = '';
    this.filtroHistorialFechaInicio = '';
    this.filtroHistorialFechaFin = '';
  }
  
  aplicarFiltroHistorial(): void {
    let historialTemp = [...this.historialCompleto];
    const busqueda = this.filtroHistorialItem.toLowerCase();

    if (busqueda) {
      historialTemp = historialTemp.filter(item => 
        (item.nombre_refaccion && item.nombre_refaccion.toLowerCase().includes(busqueda))||
        (item.nombre && item.nombre.toLowerCase().includes(busqueda)) ||
        (item.marca && item.marca.toLowerCase().includes(busqueda)) ||
        (item.tipo_item && item.tipo_item.toLowerCase().includes(busqueda))
      );
    }
    if (this.filtroHistorialFechaInicio) {
      const fechaDesde = new Date(this.filtroHistorialFechaInicio);
      historialTemp = historialTemp.filter(item => new Date(item.fecha_salida) >= fechaDesde);
    }
    if (this.filtroHistorialFechaFin) {
      const fechaHasta = new Date(this.filtroHistorialFechaFin);
      fechaHasta.setDate(fechaHasta.getDate() + 1);
      historialTemp = historialTemp.filter(item => new Date(item.fecha_salida) < fechaHasta);
    }

    this.historialFiltrado = historialTemp;
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}