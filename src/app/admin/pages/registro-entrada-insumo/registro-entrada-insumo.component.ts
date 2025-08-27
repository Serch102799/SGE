import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, startWith, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { environment } from '../../../../environments/environments';

// --- Interfaces ---
interface Proveedor { id_proveedor: number; nombre_proveedor: string; }
interface Empleado { id_empleado: number; nombre: string; }
interface InsumoSimple { id_insumo: number; nombre: string; }
interface DetalleInsumoTemporal {
  id_insumo: number;
  nombre_insumo: string;
  cantidad_recibida: number;
  costo_ingresado: number;
  tipo_costo: 'unitario' | 'neto';
  aplica_iva: boolean;
}

@Component({
  selector: 'app-registro-entrada-insumo',
  standalone: false,
  templateUrl: './registro-entrada-insumo.component.html',
  styleUrls: ['./registro-entrada-insumo.component.css']
})
export class RegistroEntradaInsumoComponent implements OnInit {

  private apiUrl = environment.apiUrl;
  razonesSociales: string[] = ['MARTRESS', 'A8M', 'TRESA', 'GIALJU'];

  // --- Catálogos (para dropdowns estáticos) ---
  proveedores: Proveedor[] = [];
  empleados: Empleado[] = [];

  // --- Lógica para Autocomplete ---
  insumoControl = new FormControl();
  filteredInsumos$: Observable<InsumoSimple[]>;
  
  // --- Formulario Maestro ---
  entradaMaestro = {
    id_proveedor: null as number | null,
    numero_factura: '',
    observaciones: '',
    id_empleado: null as number | null,
    razon_social: null as string | null
  };
  
  // --- Formulario de Detalle ---
  detalleActual = {
    id_insumo: null as number | null,
    cantidad_recibida: null as number | null,
    costo_ingresado: null as number | null,
    tipo_costo: 'unitario' as 'unitario' | 'neto',
    aplica_iva: false
  };
  
  detallesAAgregar: DetalleInsumoTemporal[] = [];
  isSaving = false;

  // --- Notificaciones ---
  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };

  constructor(private http: HttpClient, private router: Router, private location: Location) {
    this.filteredInsumos$ = this.insumoControl.valueChanges.pipe(
      startWith(''),
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(value => this._buscarApi('insumos', value || ''))
    );
  }

  ngOnInit(): void {
    this.cargarCatalogos();
  }
  
  private _buscarApi(tipo: 'insumos', term: any): Observable<InsumoSimple[]> {
    const searchTerm = typeof term === 'string' ? term : term.nombre;
    if (!searchTerm || searchTerm.length < 2) {
      return of([]);
    }
    return this.http.get<InsumoSimple[]>(`${this.apiUrl}/${tipo}/buscar`, { params: { term: searchTerm } });
  }

  displayFn(item: InsumoSimple): string {
    return item ? item.nombre : '';
  }

  onInsumoSelected(event: MatAutocompleteSelectedEvent): void {
    const insumo = event.option.value as InsumoSimple;
    this.detalleActual.id_insumo = insumo.id_insumo;
  }

  cargarCatalogos() {
    const peticiones: [Observable<Proveedor[]>, Observable<Empleado[]>] = [
      this.http.get<Proveedor[]>(`${this.apiUrl}/proveedores`),
      this.http.get<Empleado[]>(`${this.apiUrl}/empleados`)
    ];

    forkJoin(peticiones).subscribe({
      next: ([proveedores, empleados]) => {
        this.proveedores = proveedores;
        this.empleados = empleados;
      },
      error: err => this.mostrarNotificacion('Error de Carga', 'No se pudieron cargar los datos necesarios.', 'error')
    });
  }
  
  agregarDetalle() {
    const { id_insumo, cantidad_recibida, costo_ingresado, tipo_costo, aplica_iva } = this.detalleActual;
    const insumoSeleccionado = this.insumoControl.value as InsumoSimple;

    if (!id_insumo || !insumoSeleccionado || !cantidad_recibida || cantidad_recibida <= 0 || !costo_ingresado || costo_ingresado < 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Busca y selecciona un insumo, y completa cantidad y costo válidos.');
      return;
    }

    this.detallesAAgregar.push({
      id_insumo: insumoSeleccionado.id_insumo,
      nombre_insumo: insumoSeleccionado.nombre,
      cantidad_recibida: cantidad_recibida,
      costo_ingresado: costo_ingresado,
      tipo_costo: tipo_costo,
      aplica_iva: aplica_iva
    });

    this.detalleActual = { id_insumo: null, cantidad_recibida: null, costo_ingresado: null, tipo_costo: 'unitario', aplica_iva: false };
    this.insumoControl.setValue('');
  }

  eliminarDetalle(index: number) {
    this.detallesAAgregar = this.detallesAAgregar.filter((_, i) => i !== index);
  }

  guardarEntradaCompleta() {
    if (this.isSaving) return;
    if (!this.entradaMaestro.razon_social) {
    this.mostrarNotificacion('Campo Requerido', 'Debes seleccionar la Razón Social que cubre el gasto.');
    return;
  }
    if (!this.entradaMaestro.id_empleado) {
      this.mostrarNotificacion('Campo Requerido', 'Debes seleccionar quién recibe los insumos.');
      return;
    }
    if (this.detallesAAgregar.length === 0) {
      this.mostrarNotificacion('Sin Detalles', 'Debes agregar al menos un insumo a la entrada.');
      return;
    }
    
    this.isSaving = true;
    const payload = {
        maestro: this.entradaMaestro,
        detalles: this.detallesAAgregar
    };

    this.http.post(`${this.apiUrl}/entradas-insumo`, payload).subscribe({
      next: () => {
        sessionStorage.setItem('notificacion', '¡Entrada de insumos registrada exitosamente!');
        this.isSaving = false;
        this.router.navigate(['/admin/entradas-insumo']);
      },
      error: err => {
        this.mostrarNotificacion('Error', `Error al registrar la entrada: ${err.error.message}`, 'error');
        this.isSaving = false;
      }
    });
  }
  
  regresar() { this.location.back(); }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') { this.notificacion = { titulo, mensaje, tipo }; this.mostrarModalNotificacion = true; }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}