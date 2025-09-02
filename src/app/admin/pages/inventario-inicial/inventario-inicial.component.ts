import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Observable, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';

// --- Interfaces ---
interface Empleado { id_empleado: number; nombre: string; }
interface ItemSimple { id: number; nombre: string; }
interface DetalleCarga {
  id: number;
  nombre: string;
  tipo: 'Refacción' | 'Insumo';
  cantidad: number;
  costo: number;
}

@Component({
  selector: 'app-inventario-inicial',
  standalone: false,
  templateUrl: './inventario-inicial.component.html',
  styleUrls: ['./inventario-inicial.component.css']
})
export class InventarioInicialComponent implements OnInit {

  private apiUrl = environment.apiUrl;
  empleados: Empleado[] = [];

  // --- Formulario Maestro ---
  conteoMaestro = {
    id_empleado: null as number | null,
    fecha_conteo: this.getFormattedCurrentDateTime(),
    motivo: 'Carga de inventario inicial'
  };
  
  // --- Lógica para Autocompletes ---
  refaccionControl = new FormControl();
  insumoControl = new FormControl();
  filteredRefacciones$: Observable<ItemSimple[]>;
  filteredInsumos$: Observable<ItemSimple[]>;
  
  // --- Formulario de Detalle ---
  detalleActual = {
    tipo_item: 'Refacción' as 'Refacción' | 'Insumo',
    id_item: null as number | null,
    cantidad: null as number | null,
    costo: null as number | null
  };

  // --- Lista de Items a Agregar ---
  detallesAAgregar: DetalleCarga[] = [];
  isSaving = false;

  // --- Notificaciones ---
  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };

  constructor(
    private http: HttpClient, 
    private router: Router, 
    private location: Location,
    public authService: AuthService
  ) {
    this.filteredRefacciones$ = this.refaccionControl.valueChanges.pipe(
      startWith(''),
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(value => this._buscarApi('refacciones', value || ''))
    );
    this.filteredInsumos$ = this.insumoControl.valueChanges.pipe(
      startWith(''),
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(value => this._buscarApi('insumos', value || ''))
    );
  }

  ngOnInit(): void {
    // Asigna el ID del usuario logueado por defecto
    this.conteoMaestro.id_empleado = this.authService.getCurrentUser()?.id || null;
    this.cargarEmpleados();
  }

  private getFormattedCurrentDateTime(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  private _buscarApi(tipo: 'refacciones' | 'insumos', term: any): Observable<ItemSimple[]> {
    const searchTerm = typeof term === 'string' ? term : term.nombre;
    if (!searchTerm || searchTerm.length < 2) {
      return of([]);
    }
    return this.http.get<any[]>(`${this.apiUrl}/${tipo}/buscar`, { params: { term: searchTerm } })
      .pipe(
        map(respuesta => 
          respuesta.map(item => ({
            id: item.id_refaccion || item.id_insumo,
            nombre: item.nombre,
          }))
        )
      );
  }

  displayFn(item: ItemSimple): string {
    return item ? item.nombre : '';
  }

  onItemSelected(event: MatAutocompleteSelectedEvent): void {
    const item = event.option.value as ItemSimple;
    this.detalleActual.id_item = item.id;
  }

  cargarEmpleados() {
    this.http.get<Empleado[]>(`${this.apiUrl}/empleados`).subscribe(
      data => this.empleados = data
    );
  }

  onTipoItemChange(): void {
    this.detalleActual.id_item = null;
    this.refaccionControl.setValue('');
    this.insumoControl.setValue('');
  }

  agregarDetalle() {
    const { tipo_item, id_item, cantidad, costo } = this.detalleActual;
    const itemControl = tipo_item === 'Refacción' ? this.refaccionControl : this.insumoControl;
    const itemSeleccionado = itemControl.value as ItemSimple;

    if (!id_item || !itemSeleccionado || !cantidad || cantidad <= 0 || (costo !== 0 && !costo) || costo < 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Busca y selecciona un ítem, y completa una cantidad y costo válidos.');
      return;
    }

    if (this.detallesAAgregar.some(d => d.id === id_item && d.tipo === tipo_item)) {
      this.mostrarNotificacion('Ítem Duplicado', `Este ${tipo_item.toLowerCase()} ya ha sido agregado a la lista.`);
      return;
    }

    this.detallesAAgregar.push({
      id: id_item,
      nombre: itemSeleccionado.nombre,
      tipo: tipo_item,
      cantidad,
      costo
    });
    
    this.resetDetalleActual();
  }

  resetDetalleActual(): void {
    const tipoActual = this.detalleActual.tipo_item;
    this.detalleActual = { tipo_item: tipoActual, id_item: null, cantidad: null, costo: null };
    this.refaccionControl.setValue('');
    this.insumoControl.setValue('');
  }

  eliminarDetalle(index: number): void {
    this.detallesAAgregar = this.detallesAAgregar.filter((_, i) => i !== index);
  }

  guardarInventario() {
    if (this.isSaving) return;
    if (!this.conteoMaestro.id_empleado || !this.conteoMaestro.fecha_conteo || !this.conteoMaestro.motivo) {
      this.mostrarNotificacion('Datos Incompletos', 'Completa la fecha, quién realiza el conteo y el motivo.');
      return;
    }
    if (this.detallesAAgregar.length === 0) {
      this.mostrarNotificacion('Sin Detalles', 'Debes agregar al menos una refacción o insumo al inventario.');
      return;
    }

    this.isSaving = true;
    const payload = {
      maestro: this.conteoMaestro,
      detallesRefacciones: this.detallesAAgregar
        .filter(d => d.tipo === 'Refacción')
        .map(d => ({ id_refaccion: d.id, cantidad: d.cantidad, costo: d.costo })),
      detallesInsumos: this.detallesAAgregar
        .filter(d => d.tipo === 'Insumo')
        .map(d => ({ id_insumo: d.id, cantidad: d.cantidad, costo: d.costo }))
    };

    this.http.post(`${this.apiUrl}/inventario-inicial`, payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.mostrarNotificacion('Éxito', 'Inventario inicial cargado exitosamente.', 'exito');
        this.detallesAAgregar = [];
        this.resetDetalleActual();
      },
      error: err => {
        this.mostrarNotificacion('Error', err.error?.message || 'Error desconocido al guardar el inventario.', 'error');
        this.isSaving = false;
      }
    });
  }

  regresar() { this.location.back(); }
  
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }
  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}