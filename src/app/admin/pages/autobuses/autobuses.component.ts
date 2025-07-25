import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';

// Interfaz actualizada
export interface Autobus {
  id_autobus: number;
  economico: string;
  marca: string;
  modelo: string;
  anio: number;
  kilometraje_actual: number;
  vin: string;
}

@Component({
  selector: 'app-autobuses',
  standalone: false,
  templateUrl: './autobuses.component.html',
  styleUrls: ['./autobuses.component.css']
})
export class AutobusesComponent implements OnInit {

  autobuses: Autobus[] = [];
  autobusesFiltrados: Autobus[] = [];
  private apiUrl = 'http://localhost:3000/api/autobuses';
   private historialApiUrl = 'http://localhost:3000/api/historial';

  terminoBusqueda: string = '';
  mostrarModalHistorial = false;
  historialCompleto: any[] = [];
  historialFiltrado: any[] = [];
  autobusSeleccionadoEconomico: string | null = null;
  costoTotalHistorial: number = 0;
  
  filtroHistorialItem: string = '';
  filtroHistorialFechaInicio: string = '';
  filtroHistorialFechaFin: string = '';

  mostrarModal = false;
  modoEdicion = false;
  autobusSeleccionado: Partial<Autobus> = {};
  
  mostrarModalBorrar = false;
  autobusABorrar: Autobus | null = null;
  
  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit(): void {
    this.obtenerAutobuses();
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }

  obtenerAutobuses() {
    this.http.get<Autobus[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.autobuses = data;
        this.autobusesFiltrados = data;
      },
      error: (err) => console.error('Error al obtener autobuses', err)
    });
  }

  aplicarFiltros() {
    const busqueda = this.terminoBusqueda.toLowerCase();
    this.autobusesFiltrados = this.autobuses.filter(a =>
      a.economico.toLowerCase().includes(busqueda) ||
      (a.marca && a.marca.toLowerCase().includes(busqueda)) ||
      (a.vin && a.vin.toLowerCase().includes(busqueda))
    );
  }

  abrirModal(modo: 'agregar' | 'editar', autobus?: Autobus) {
    this.modoEdicion = (modo === 'editar');
    if (modo === 'editar' && autobus) {
      this.autobusSeleccionado = { ...autobus };
    } else {
      this.autobusSeleccionado = { economico: '', vin: '' };
    }
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
  }

  guardarAutobus() {
    if (!this.autobusSeleccionado.economico || !this.autobusSeleccionado.vin) {
      this.mostrarNotificacion('Campos Requeridos', 'El número económico y el VIN son obligatorios.');
      return;
    }

    const payload = {
        Economico: this.autobusSeleccionado.economico,
        Marca: this.autobusSeleccionado.marca,
        Modelo: this.autobusSeleccionado.modelo,
        Anio: this.autobusSeleccionado.anio,
        Kilometraje_Actual: this.autobusSeleccionado.kilometraje_actual,
        VIN: this.autobusSeleccionado.vin
    };

    if (this.modoEdicion) {
      const url = `${this.apiUrl}/${this.autobusSeleccionado.economico}`;
      const updatePayload = {
          Marca: payload.Marca, Modelo: payload.Modelo, Anio: payload.Anio, Kilometraje_Actual: payload.Kilometraje_Actual
      };
      this.http.put(url, updatePayload).subscribe({
        next: () => this.postGuardado('Autobús actualizado exitosamente.'),
        error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo actualizar.', 'error')
      });
    } else {
      this.http.post(this.apiUrl, payload).subscribe({
        next: () => this.postGuardado('Autobús creado exitosamente.'),
        error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo agregar.', 'error')
      });
    }
  }

  abrirModalBorrar(autobus: Autobus) {
    this.autobusABorrar = autobus;
    this.mostrarModalBorrar = true;
  }

  cerrarModalBorrar() {
    this.mostrarModalBorrar = false;
    this.autobusABorrar = null;
  }

  confirmarEliminacion() {
    if (!this.autobusABorrar) return;
    const url = `${this.apiUrl}/${this.autobusABorrar.economico}`;
    this.http.delete(url).subscribe({
      next: () => this.postGuardado('Autobús eliminado exitosamente.'),
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo eliminar.', 'error')
    });
  }
  
  private postGuardado(mensaje: string) {
    this.mostrarNotificacion('Éxito', mensaje, 'exito');
    this.obtenerAutobuses();
    this.cerrarModal();
    this.cerrarModalBorrar();
  }
  verHistorial(autobus: Autobus) {
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

  cerrarModalHistorial() {
    this.mostrarModalHistorial = false;
    this.historialCompleto = [];
    this.historialFiltrado = [];
    this.filtroHistorialItem = '';
    this.filtroHistorialFechaInicio = '';
    this.filtroHistorialFechaFin = '';
  }

  aplicarFiltroHistorial() {
    let historialTemp = [...this.historialCompleto];
    const busqueda = this.filtroHistorialItem.toLowerCase();

    // Filtro por nombre de refacción
    if (busqueda) {
      historialTemp = historialTemp.filter(item => 
        (item.nombre_refaccion && item.nombre_refaccion.toLowerCase().includes(busqueda))||
        (item.nombre && item.nombre.toLowerCase().includes(busqueda)) ||
        (item.marca && item.marca.toLowerCase().includes(busqueda)) ||
        (item.tipo_item && item.tipo_item.toLowerCase().includes(busqueda))
      );
    }
    // Filtro por fecha de inicio
    if (this.filtroHistorialFechaInicio) {
      const fechaDesde = new Date(this.filtroHistorialFechaInicio);
      historialTemp = historialTemp.filter(item => new Date(item.fecha_salida) >= fechaDesde);
    }
    // Filtro por fecha de fin
    if (this.filtroHistorialFechaFin) {
      const fechaHasta = new Date(this.filtroHistorialFechaFin);
      fechaHasta.setDate(fechaHasta.getDate() + 1);
      historialTemp = historialTemp.filter(item => new Date(item.fecha_salida) < fechaHasta);
    }

    this.historialFiltrado = historialTemp;
  }
}