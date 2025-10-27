import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';

// --- INTERFAZ MODIFICADA ---
export interface Operador {
  id_operador: number;
  nombre_completo: string;
  numero_licencia: string;
  tipo_licencia: string;
  licencia_vencimiento: string;
  numero_empleado: string;
  // estatus: string; // <-- Campo obsoleto, reemplazado por esta_activo
  nss: string;
  estatus_nss: string;
  fecha_nacimiento: string;
  fecha_ingreso: string;
  edad: number; // Campo calculado
  antiguedad_anios: number; // Campo calculado

  // --- NUEVOS CAMPOS ---
  esta_activo: boolean;
  fecha_baja: string | null;
  motivo_baja: string | null;
}

@Component({
  selector: 'app-operadores',
  standalone: false,
  templateUrl: './operadores.component.html',
  styleUrls: ['./operadores.component.css']
})
export class OperadoresComponent implements OnInit, OnDestroy {

  private apiUrl = `${environment.apiUrl}/operadores`;
  operadores: Operador[] = [];

  // --- Paginación y Búsqueda ---
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;
  terminoBusqueda: string = '';

  // --- MODIFICADO: Ahora es 'filtroEstado' y usa los nuevos valores ---
  filtroEstado: 'activos' | 'inactivos' | 'todos' = 'activos';

  private searchSubject: Subject<void> = new Subject<void>();
  private searchSubscription?: Subscription;

  // --- Modales y Notificaciones ---
  mostrarModal = false;
  modoEdicion = false;
  operadorSeleccionado: Partial<Operador> = {};
  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };
  mostrarModalReactivar = false;
  operadorParaReactivar: Operador | null = null;


  // --- NUEVO: Estado para el modal de "Dar de Baja" ---
  mostrarModalBaja = false;
  operadorParaBaja: Operador | null = null;
  datosBaja = {
    fecha_baja: new Date().toISOString().split('T')[0], // Autocompletar con fecha de hoy
    motivo_baja: ''
  };

  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject.pipe(
      startWith(undefined),
      debounceTime(400)
    ).subscribe(() => {
      this.currentPage = 1; // Reiniciar a página 1 en cada búsqueda o filtro
      this.obtenerOperadores();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  // --- MODIFICADO: Usa 'estado' en lugar de 'estatus' ---
  obtenerOperadores(): void {
    const params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('limit', this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim())
      .set('estado', this.filtroEstado); // <-- CAMBIO AQUÍ

    this.http.get<{ total: number, data: Operador[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.operadores = response.data;
        this.totalItems = response.total;
      },
      error: (err) => {
        this.mostrarNotificacion('Error', 'No se pudo cargar la lista de operadores.', 'error');
      }
    });
  }

  onSearchChange(): void {
    this.searchSubject.next();
  }

  // --- NUEVO: Método para disparar la actualización al cambiar el filtro ---
  // Debes conectar esto a tu <select> o grupo de botones en el HTML
  // ej: (change)="onFiltroChange()"
  onFiltroChange(): void {
    this.searchSubject.next();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerOperadores();
  }

  // --- MODIFICADO: Se quita el 'estatus' al crear uno nuevo ---
  abrirModal(modo: 'agregar' | 'editar', operador?: Operador): void {
    this.modoEdicion = modo === 'editar';
    if (modo === 'editar' && operador) {
      // Formatear las fechas para el input type="date"
      this.operadorSeleccionado = {
        ...operador,
        licencia_vencimiento: operador.licencia_vencimiento ? new Date(operador.licencia_vencimiento).toISOString().split('T')[0] : '',
        fecha_nacimiento: operador.fecha_nacimiento ? new Date(operador.fecha_nacimiento).toISOString().split('T')[0] : '',
        fecha_ingreso: operador.fecha_ingreso ? new Date(operador.fecha_ingreso).toISOString().split('T')[0] : ''
      };
    } else {
      // Ya no se incluye 'estatus', la API se encarga con 'esta_activo'
      this.operadorSeleccionado = { estatus_nss: 'Activo' };
    }
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }

  // --- SIN CAMBIOS ---
  // Esta lógica sigue siendo válida. El backend (PUT/POST)
  // ignorará los campos que no necesita (como 'esta_activo', 'edad', etc.)
  guardarOperador(): void {
    if (!this.operadorSeleccionado.nombre_completo) {
      this.mostrarNotificacion('Campo Requerido', 'El nombre completo es obligatorio.');
      return;
    }

    const request$ = this.modoEdicion
      ? this.http.put(`${this.apiUrl}/${this.operadorSeleccionado.id_operador}`, this.operadorSeleccionado)
      : this.http.post(this.apiUrl, this.operadorSeleccionado);

    request$.subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', `Operador ${this.modoEdicion ? 'actualizado' : 'creado'} exitosamente.`, 'exito');
        this.obtenerOperadores();
        this.cerrarModal();
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'Ocurrió un error al guardar.', 'error');
      }
    });
  }

  // --- REEMPLAZADO: Lógica de desactivación movida a un modal ---

  // 1. Abrir el modal de baja
  abrirModalBaja(operador: Operador): void {
    this.operadorParaBaja = operador;
    this.datosBaja = {
      fecha_baja: new Date().toISOString().split('T')[0], // Resetea a la fecha de hoy
      motivo_baja: '' // Limpia el motivo anterior
    };
    this.mostrarModalBaja = true;
  }

  // 2. Cerrar el modal de baja
  cerrarModalBaja(): void {
    this.mostrarModalBaja = false;
    this.operadorParaBaja = null;
    this.datosBaja.motivo_baja = '';
  }

  // 3. Confirmar la baja (envía el PATCH)
  confirmarBaja(): void {
    if (!this.operadorParaBaja) return;

    if (!this.datosBaja.motivo_baja || !this.datosBaja.fecha_baja) {
      this.mostrarNotificacion('Campos Requeridos', 'Debe proporcionar una fecha y un motivo para la baja.');
      return;
    }

    const url = `${this.apiUrl}/${this.operadorParaBaja.id_operador}/desactivar`;

    // Usamos PATCH y enviamos los datos de la baja en el body
    this.http.patch(url, this.datosBaja).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Operador desactivado exitosamente.', 'exito');
        this.obtenerOperadores(); // Recarga la lista
        this.cerrarModalBaja(); // Cierra el modal
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'No se pudo desactivar al operador.', 'error');
      }
    });
  }

  reactivarOperador(operador: Operador): void {
    this.operadorParaReactivar = operador;
    this.mostrarModalReactivar = true;
  }

  // --- NUEVO: Método para Cerrar el modal de reactivar ---
  cerrarModalReactivar(): void {
    this.mostrarModalReactivar = false;
    this.operadorParaReactivar = null;
  }
  confirmarReactivacion(): void {
    if (!this.operadorParaReactivar) return;

    const url = `${this.apiUrl}/${this.operadorParaReactivar.id_operador}/reactivar`;

    this.http.patch(url, {}).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Operador reactivado exitosamente.', 'exito');
        this.obtenerOperadores(); // Recarga la lista
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'No se pudo reactivar al operador.', 'error');
      },
      complete: () => {
        this.cerrarModalReactivar(); // Cierra el modal al terminar
      }
    });
  }

  // --- Métodos de Notificación (Sin Cambios) ---
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}