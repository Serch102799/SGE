import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { forkJoin, Observable, of } from 'rxjs';

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
  mostrarModalRecarga = false;
  tanqueARecargar: Tanque | null = null;
  litrosARecargar: number | null = null;

  // --- Modales y Notificaciones ---
  mostrarModal = false;
  modoEdicion = false;
  tanqueSeleccionado: Partial<Tanque> = {};
  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };

  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit(): void {
    this.obtenerDatos();
  }

  obtenerDatos(): void {
    // Se obtienen tanto los tanques como el catálogo de ubicaciones para el modal
    const tanques$ = this.http.get<{ tanques: Tanque[], totalesPorUbicacion: TotalPorUbicacion[] }>(this.apiUrl);
    const ubicaciones$ = this.http.get<Ubicacion[]>(`${environment.apiUrl}/ubicaciones`); // Asumiendo que crearás este endpoint

    forkJoin([tanques$, ubicaciones$]).subscribe({
      next: ([respuestaTanques, ubicaciones]) => {
        this.tanques = respuestaTanques.tanques;
        this.totalesPorUbicacion = respuestaTanques.totalesPorUbicacion;
        this.ubicaciones = ubicaciones;
      },
      error: (err) => this.mostrarNotificacion('Error', 'No se pudieron cargar los datos de los tanques.', 'error')
    });
  }

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
  abrirModalRecarga(tanque: Tanque): void {
    this.tanqueARecargar = tanque;
    this.litrosARecargar = null; // Resetea el campo
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
    
    const url = `${this.apiUrl}/recargar/${this.tanqueARecargar.id_tanque}`;
    const payload = { litros_a_cargar: this.litrosARecargar };

    this.http.post(url, payload).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Tanque recargado correctamente.', 'exito');
        this.cerrarModalRecarga();
        this.obtenerDatos(); // Refresca la lista de tanques
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'No se pudo completar la recarga.', 'error');
      }
    });
  }

  // --- Métodos de utilidad ---
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') { this.notificacion = { titulo, mensaje, tipo }; this.mostrarModalNotificacion = true; }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}