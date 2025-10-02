import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';

export interface Operador {
  id_operador: number;
  nombre_completo: string;
  numero_licencia: string;
  tipo_licencia: string;
  licencia_vencimiento: string;
  numero_empleado: string;
  estatus: string;
  nss: string;
  estatus_nss: string;
  fecha_nacimiento: string;
  fecha_ingreso: string;
  edad: number; // Campo calculado
  antiguedad_anios: number; // Campo calculado
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
  filtroEstatus: string = 'Activo';
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
  
  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject.pipe(
      startWith(undefined),
      debounceTime(400)
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerOperadores();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  obtenerOperadores(): void {
    const params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('limit', this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim())
      .set('estatus', this.filtroEstatus);

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

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerOperadores();
  }
  
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
        this.operadorSeleccionado = { estatus: 'Activo', estatus_nss: 'Activo' };
    }
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }

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

  desactivarOperador(operador: Operador): void {
    if (confirm(`¿Estás seguro de que deseas desactivar a ${operador.nombre_completo}?`)) {
        this.http.delete(`${this.apiUrl}/${operador.id_operador}`).subscribe({
            next: () => {
                this.mostrarNotificacion('Éxito', 'Operador desactivado.', 'exito');
                this.obtenerOperadores();
            },
            error: (err) => {
                this.mostrarNotificacion('Error', err.error?.message || 'No se pudo desactivar al operador.', 'error');
            }
        });
    }
  }

 mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}