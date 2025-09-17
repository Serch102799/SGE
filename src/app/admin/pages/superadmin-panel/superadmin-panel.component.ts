import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';

// Se usa la misma interfaz que en el componente de entradas
interface Entrada {
  id_entrada: number;
  fecha_operacion: string;
  nombre_proveedor: string;
  factura_proveedor: string;
  vale_interno: string;
  nombre_empleado: string;
}

@Component({
  selector: 'app-superadmin-panel',
  standalone: false,
  templateUrl: './superadmin-panel.component.html',
  styleUrls: ['./superadmin-panel.component.css']
})
export class SuperadminPanelComponent implements OnInit, OnDestroy {

  private apiUrl = environment.apiUrl;
  
  vistaActual: 'entradas' | 'salidas' = 'entradas';

  // --- Estado de la Tabla ---
  registros: any[] = [];
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;

  // --- Filtros ---
  terminoBusqueda: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';
  private searchSubject: Subject<void> = new Subject<void>();
  private searchSubscription?: Subscription;

  // --- Modal de Edición ---
  mostrarModalEditar = false;
  registroAEditar: { tipo: 'entrada' | 'salida', id: number, fecha_actual: string } | null = null;
  nuevosDatos = {
    fecha_operacion: '',
    motivo: ''
  };
  isSaving = false;

  // --- Notificaciones ---
  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };

  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject.pipe(
      startWith(undefined), 
      debounceTime(400)
    ).subscribe(() => {
      this.currentPage = 1;
      this.cargarDatos();
    });
}

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  cambiarVista(vista: 'entradas' | 'salidas'): void {
    this.vistaActual = vista;
    this.registros = [];
    this.totalItems = 0;
    this.terminoBusqueda = '';
    this.fechaInicio = '';
    this.fechaFin = '';
    this.searchSubject.next();
  }

  cargarDatos(): void {
    const endpoint = this.vistaActual === 'entradas' ? '/entradas' : '/salidas';
    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('limit', this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim());

    if (this.fechaInicio) params = params.set('fechaInicio', this.fechaInicio);
    if (this.fechaFin) params = params.set('fechaFin', this.fechaFin);

    this.http.get<{ total: number, data: any[] }>(`${this.apiUrl}${endpoint}`, { params }).subscribe({
      next: (response) => {
        this.registros = response.data || [];
        this.totalItems = response.total || 0;
      },
      error: (err) => {
        this.mostrarNotificacion('Error', `No se pudo cargar la lista de ${this.vistaActual}.`, 'error');
        this.registros = [];
        this.totalItems = 0;
      }
    });
  }

  onFiltroChange(): void {
    this.searchSubject.next();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.cargarDatos();
  }

  abrirModalEditar(registro: any): void {
    const fechaActualISO = new Date(registro.fecha_operacion).toISOString().slice(0, 16);
    this.registroAEditar = {
      tipo: this.vistaActual === 'entradas' ? 'entrada' : 'salida',
      id: this.vistaActual === 'entradas' ? registro.id_entrada : registro.id_salida,
      fecha_actual: fechaActualISO
    };
    this.nuevosDatos.fecha_operacion = fechaActualISO;
    this.nuevosDatos.motivo = '';
    this.mostrarModalEditar = true;
  }

  cerrarModalEditar(): void {
    this.mostrarModalEditar = false;
  }

  guardarCambiosFecha(): void {
    if (!this.registroAEditar || !this.nuevosDatos.fecha_operacion || !this.nuevosDatos.motivo.trim()) {
      this.mostrarNotificacion('Datos Incompletos', 'Debes seleccionar una nueva fecha y escribir un motivo.');
      return;
    }
    
    this.isSaving = true;
    const endpoint = this.vistaActual === 'entradas' ? 'entradas' : 'salidas';
    const url = `${this.apiUrl}/superadmin/${endpoint}/${this.registroAEditar.id}`;
    
    const payload = {
      fecha_operacion: this.nuevosDatos.fecha_operacion,
      motivo: this.nuevosDatos.motivo
    };

    this.http.put(url, payload).subscribe({
      next: (response: any) => {
        this.mostrarNotificacion('Éxito', response.message, 'exito');
        this.isSaving = false;
        this.cerrarModalEditar();
        this.cargarDatos(); // Vuelve a cargar los datos para reflejar el cambio
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'No se pudo actualizar el registro.', 'error');
        this.isSaving = false;
      }
    });
  }
   mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') { this.notificacion = { titulo, mensaje, tipo }; this.mostrarModalNotificacion = true; }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}