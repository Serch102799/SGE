import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

@Component({
  selector: 'app-taller',
  standalone: false,
  templateUrl: './taller.component.html',
  styleUrls: ['./taller.component.css']
})
export class TallerComponent implements OnInit {
  apiUrl = `${environment.apiUrl}/taller`;
  
  ordenesEnTaller: any[] = [];
  empleados: any[] = [];
  
  // --- Formulario Nuevo Ingreso ---
  mostrarModalIngreso = false;
  isSaving = false;
  autobusControl = new FormControl();
  filteredAutobuses$: Observable<any[]> = of([]);
  
  nuevaOrden = {
    id_autobus: null as number | null,
    kilometraje: null,
    tipo_mantenimiento: 'Correctivo',
    urgencia: 'Normal',
    falla_reportada: '',
    id_mecanico: null as number | null
  };

  // --- Notificaciones ---
  mostrarModalNotificacion = false;
  notificacion = { titulo: '', mensaje: '', tipo: 'advertencia' };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // Aquí cargarías las órdenes activas (SELECT * FROM orden_servicio WHERE estado != 'Terminado')
    // this.cargarOrdenesActivas();
    // this.cargarMecanicos();
    
    // Simulación de datos para que veas el diseño:
    this.ordenesEnTaller = [
      { id_orden: 101, economico: 'U-440', tipo_mantenimiento: 'Preventivo', urgencia: 'Normal', estado: 'En Reparación', falla_reportada: 'Cambio de aceite y filtros', mecanico: 'Juan Pérez', fecha_ingreso: new Date() },
      { id_orden: 102, economico: 'U-120', tipo_mantenimiento: 'Correctivo', urgencia: 'Alta', estado: 'Pendiente', falla_reportada: 'Pérdida de potencia en subidas', mecanico: 'Sin Asignar', fecha_ingreso: new Date() },
      { id_orden: 103, economico: 'U-305', tipo_mantenimiento: 'Correctivo', urgencia: 'Alta', estado: 'Esperando Refacciones', falla_reportada: 'Fuga en compresor de aire', mecanico: 'Carlos Slim', fecha_ingreso: new Date() }
    ];
  }

  abrirModalIngreso() {
    this.nuevaOrden = { id_autobus: null, kilometraje: null, tipo_mantenimiento: 'Correctivo', urgencia: 'Normal', falla_reportada: '', id_mecanico: null };
    this.autobusControl.setValue('');
    this.mostrarModalIngreso = true;
  }
  cerrarModalIngreso() { this.mostrarModalIngreso = false; }

  // Aquí irían tus funciones de guardar, autocomplete, etc. idénticas a las de "Salidas"
  
  cambiarEstado(orden: any, nuevoEstado: string) {
    // Aquí llamarías al backend para hacer UPDATE orden_servicio SET estado = nuevoEstado WHERE id_orden = orden.id_orden
    orden.estado = nuevoEstado;
    this.mostrarNotificacion('Estado Actualizado', `La unidad ${orden.economico} ahora está: ${nuevoEstado}`, 'exito');
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: string) {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}