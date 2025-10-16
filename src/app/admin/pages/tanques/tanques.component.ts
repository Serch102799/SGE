import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface Tanque {
  id_tanque: number;
  nombre_tanque: string;
  capacidad_litros: number;
  nivel_actual_litros: number;
  id_ubicacion: number;
  nombre_ubicacion: string;
}

interface TotalPorUbicacion {
  nombre_ubicacion: string;
  total_litros: number;
}

interface Ubicacion {
  id_ubicacion: number;
  nombre_ubicacion: string;
}

interface Recarga {
  id_recarga: number;
  litros_cargados: number;
  fecha_operacion: string;
  observaciones?: string;
}

@Component({
  selector: 'app-tanques',
  standalone: false,
  templateUrl: './tanques.component.html',
  styleUrls: ['./tanques.component.css']
})
export class TanquesComponent implements OnInit {
  
  private apiUrl = `${environment.apiUrl}/tanques`;
  tanques: Tanque[] = [];
  totalesPorUbicacion: TotalPorUbicacion[] = [];
  ubicaciones: Ubicacion[] = [];

  // --- Modales y Notificaciones ---
  mostrarModal = false;
  modoEdicion = false;
  tanqueSeleccionado: Partial<Tanque> = {};
  
  mostrarModalRecarga = false;
  tanqueARecargar: Tanque | null = null;
  litrosARecargar: number | null = null;
  fechaRecarga: string = this.getFormattedCurrentDateTime();

  // --- Modal de Historial ---
  mostrarModalHistorial = false;
  historialRecargas: Recarga[] = [];
  tanqueSeleccionadoHistorial: Tanque | null = null;

  // --- Modal de Traslado ---
  mostrarModalTraslado = false;
  traslado = {
    id_tanque_origen: null as number | null,
    id_tanque_destino: null as number | null,
    litros_trasladados: null as number | null,
    fecha_operacion: this.getFormattedCurrentDateTime(),
    observaciones: ''
  };

  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };

  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit(): void {
    this.obtenerDatos();
  }

  private getFormattedCurrentDateTime(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  obtenerDatos(): void {
    const tanques$ = this.http.get<{ tanques: Tanque[], totalesPorUbicacion: TotalPorUbicacion[] }>(this.apiUrl);
    const ubicaciones$ = this.http.get<Ubicacion[]>(`${environment.apiUrl}/ubicaciones`).pipe(catchError(() => of([])));

    forkJoin([tanques$, ubicaciones$]).subscribe({
      next: ([respuestaTanques, ubicaciones]) => {
        this.tanques = respuestaTanques.tanques;
        this.totalesPorUbicacion = respuestaTanques.totalesPorUbicacion;
        this.ubicaciones = (ubicaciones as any).data || ubicaciones;
      },
      error: (err) => this.mostrarNotificacion('Error', 'No se pudieron cargar los datos de los tanques.', 'error')
    });
  }

  // --- Métodos para Modal de Agregar/Editar Tanque ---
  abrirModal(modo: 'agregar' | 'editar', tanque?: Tanque): void {
    this.modoEdicion = modo === 'editar';
    this.tanqueSeleccionado = modo === 'editar' && tanque ? { ...tanque } : { nivel_actual_litros: 0 };
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }

  guardarTanque(): void {
    if (!this.tanqueSeleccionado.nombre_tanque || !this.tanqueSeleccionado.id_ubicacion) {
      this.mostrarNotificacion('Campos Requeridos', 'El nombre del tanque y la ubicación son obligatorios.');
      return;
    }
    const request$ = this.modoEdicion
      ? this.http.put(`${this.apiUrl}/${this.tanqueSeleccionado.id_tanque}`, this.tanqueSeleccionado)
      : this.http.post(this.apiUrl, this.tanqueSeleccionado);
      
    request$.subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', `Tanque ${this.modoEdicion ? 'actualizado' : 'creado'} exitosamente.`, 'exito');
        this.obtenerDatos();
        this.cerrarModal();
      },
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'Ocurrió un error al guardar.', 'error')
    });
  }
  
  // --- Métodos para Modal de Recargar Tanque ---
  abrirModalRecarga(tanque: Tanque): void {
    this.tanqueARecargar = tanque;
    this.litrosARecargar = null;
    this.fechaRecarga = this.getFormattedCurrentDateTime();
    this.mostrarModalRecarga = true;
  }

  cerrarModalRecarga(): void {
    this.mostrarModalRecarga = false;
  }

  confirmarRecarga(): void {
    if (!this.tanqueARecargar || !this.litrosARecargar || this.litrosARecargar <= 0) {
      this.mostrarNotificacion('Dato Inválido', 'Por favor, ingresa una cantidad de litros válida.');
      return;
    }
    if (!this.fechaRecarga) {
      this.mostrarNotificacion('Fecha Requerida', 'Por favor, selecciona una fecha de operación.');
      return;
    }

    const url = `${this.apiUrl}/recargar/${this.tanqueARecargar.id_tanque}`;
    const payload = { 
      litros_a_cargar: this.litrosARecargar,
      fecha_operacion: this.fechaRecarga
    };
    
    this.http.post(url, payload).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Tanque recargado correctamente.', 'exito');
        this.cerrarModalRecarga();
        this.obtenerDatos();
      },
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo completar la recarga.', 'error')
    });
  }

  // --- Métodos para Modal de Historial ---
  abrirModalHistorial(tanque: Tanque): void {
    this.tanqueSeleccionadoHistorial = tanque;
    this.mostrarModalHistorial = true;
    this.cargarHistorialRecargas(tanque.id_tanque);
  }

  cerrarModalHistorial(): void {
    this.mostrarModalHistorial = false;
    this.historialRecargas = [];
  }

  cargarHistorialRecargas(idTanque: number): void {
    this.http.get<Recarga[]>(`${this.apiUrl}/${idTanque}/historial-recargas`).subscribe({
      next: (recargas) => {
        this.historialRecargas = recargas;
      },
      error: (err) => {
        this.mostrarNotificacion('Error', 'No se pudo cargar el historial de recargas.', 'error');
        this.historialRecargas = [];
      }
    });
  }

  // --- Métodos para el Modal de Traslado ---
  abrirModalTraslado(): void {
    this.traslado = {
      id_tanque_origen: null,
      id_tanque_destino: null,
      litros_trasladados: null,
      fecha_operacion: this.getFormattedCurrentDateTime(),
      observaciones: ''
    };
    this.mostrarModalTraslado = true;
  }

  cerrarModalTraslado(): void {
    this.mostrarModalTraslado = false;
  }

  guardarTraslado(): void {
    if (!this.traslado.id_tanque_origen || !this.traslado.id_tanque_destino || !this.traslado.litros_trasladados || this.traslado.litros_trasladados <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Completa todos los campos para realizar el traslado.');
      return;
    }
    if (!this.traslado.fecha_operacion) {
      this.mostrarNotificacion('Fecha Requerida', 'Por favor, selecciona una fecha de operación.');
      return;
    }

    this.http.post(`${environment.apiUrl}/traslados`, this.traslado).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Traslado registrado exitosamente.', 'exito');
        this.cerrarModalTraslado();
        this.obtenerDatos();
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'No se pudo registrar el traslado.', 'error');
      }
    });
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}