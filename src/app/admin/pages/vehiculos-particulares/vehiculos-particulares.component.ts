import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';

export interface VehiculoParticular {
  id_vehiculo?: number;
  propietario: string;
  puesto: string;
  marca: string;
  modelo: string;
  anio: number | null;
  color: string;
  placas: string;
  kilometraje_actual: number;
  esta_activo?: boolean;
}

@Component({
  selector: 'app-vehiculos-particulares',
  standalone: false,
  templateUrl: './vehiculos-particulares.component.html',
  styleUrls: ['./vehiculos-particulares.component.css']
})
export class VehiculosParticularesComponent implements OnInit {
  vehiculos: VehiculoParticular[] = [];
  vehiculosFiltrados: VehiculoParticular[] = [];
  terminoBusqueda: string = '';

  private apiUrl = `${environment.apiUrl}/vehiculos-particulares`;

  // Control de Modales
  mostrarModal = false;
  modoEdicion = false;
  vehiculoSeleccionado: VehiculoParticular = this.obtenerVehiculoVacio();

  mostrarModalEliminar = false;
  vehiculoAEliminar: VehiculoParticular | null = null;

  mostrarModalNotificacion = false;
  notificacion = { titulo: '', mensaje: '', tipo: 'exito' };
  isSaving = false;

  constructor(private http: HttpClient, public authService: AuthService) {}

  ngOnInit(): void {
    this.obtenerVehiculos();
  }

  obtenerVehiculoVacio(): VehiculoParticular {
    return { propietario: '', puesto: '', marca: '', modelo: '', anio: null, color: '', placas: '', kilometraje_actual: 0 };
  }

  obtenerVehiculos(): void {
    this.http.get<VehiculoParticular[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.vehiculos = data;
        this.vehiculosFiltrados = data;
      },
      error: (err) => console.error('Error al cargar vehículos', err)
    });
  }

  aplicarFiltro(): void {
    const busqueda = this.terminoBusqueda.toLowerCase();
    this.vehiculosFiltrados = this.vehiculos.filter(v => 
      v.propietario.toLowerCase().includes(busqueda) ||
      v.puesto?.toLowerCase().includes(busqueda) ||
      v.marca?.toLowerCase().includes(busqueda) ||
      v.placas?.toLowerCase().includes(busqueda)
    );
  }

  abrirModal(modo: 'agregar' | 'editar', vehiculo?: VehiculoParticular): void {
    this.modoEdicion = modo === 'editar';
    if (modo === 'editar' && vehiculo) {
      this.vehiculoSeleccionado = { ...vehiculo };
    } else {
      this.vehiculoSeleccionado = this.obtenerVehiculoVacio();
    }
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.vehiculoSeleccionado = this.obtenerVehiculoVacio();
  }

  guardarVehiculo(): void {
    if (!this.vehiculoSeleccionado.propietario || !this.vehiculoSeleccionado.marca || !this.vehiculoSeleccionado.modelo) {
      this.mostrarNotificacion('Campos incompletos', 'El propietario, marca y modelo son obligatorios.', 'advertencia');
      return;
    }

    this.isSaving = true;

    if (this.modoEdicion && this.vehiculoSeleccionado.id_vehiculo) {
      this.http.put(`${this.apiUrl}/${this.vehiculoSeleccionado.id_vehiculo}`, this.vehiculoSeleccionado).subscribe({
        next: () => {
          this.mostrarNotificacion('Actualizado', 'Vehículo actualizado correctamente.', 'exito');
          this.obtenerVehiculos();
          this.cerrarModal();
        },
        error: () => this.mostrarNotificacion('Error', 'No se pudo actualizar el vehículo.', 'error')
      }).add(() => this.isSaving = false);
    } else {
      this.http.post(this.apiUrl, this.vehiculoSeleccionado).subscribe({
        next: () => {
          this.mostrarNotificacion('Registrado', 'Vehículo agregado exitosamente.', 'exito');
          this.obtenerVehiculos();
          this.cerrarModal();
        },
        error: () => this.mostrarNotificacion('Error', 'No se pudo registrar el vehículo.', 'error')
      }).add(() => this.isSaving = false);
    }
  }

  confirmarEliminar(vehiculo: VehiculoParticular): void {
    this.vehiculoAEliminar = vehiculo;
    this.mostrarModalEliminar = true;
  }

  cerrarModalEliminar(): void {
    this.mostrarModalEliminar = false;
    this.vehiculoAEliminar = null;
  }

  eliminar(): void {
    if (!this.vehiculoAEliminar || !this.vehiculoAEliminar.id_vehiculo) return;
    
    this.http.delete(`${this.apiUrl}/${this.vehiculoAEliminar.id_vehiculo}`).subscribe({
      next: () => {
        this.mostrarNotificacion('Eliminado', 'Vehículo dado de baja del catálogo.', 'exito');
        this.obtenerVehiculos();
        this.cerrarModalEliminar();
      },
      error: () => this.mostrarNotificacion('Error', 'No se pudo eliminar el vehículo.', 'error')
    });
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia'): void {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion(): void {
    this.mostrarModalNotificacion = false;
  }

  obtenerIniciales(nombre: string): string {
    if (!nombre) return 'VP';
    const partes = nombre.trim().split(' ');
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return nombre.substring(0, 2).toUpperCase();
  }
}