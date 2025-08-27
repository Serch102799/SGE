import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, startWith, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { environment } from '../../../../environments/environments';

// --- Interfaces ---
interface Proveedor { id_proveedor: number; nombre_proveedor: string; }
interface Empleado { id_empleado: number; nombre: string; }
interface ItemSimple { id: number; nombre: string; }
interface DetalleTemporal {
  id: number;
  nombre: string;
  tipo: 'Refacción' | 'Insumo';
  cantidad: number;
  costo_ingresado: number;
  tipo_costo: 'unitario' | 'neto';
  aplica_iva: boolean;
}

@Component({
  selector: 'app-registro-entrada',
  standalone: false,
  templateUrl: './registro-entrada.component.html',
  styleUrls: ['./registro-entrada.component.css']
})
export class RegistroEntradaComponent implements OnInit {

  private apiUrl = environment.apiUrl;
  razonesSociales: string[] = ['MARTRESS', 'A8M', 'TRESA', 'GIALJU'];

  // --- Catálogos (para dropdowns estáticos) ---
  proveedores: Proveedor[] = [];
  empleados: Empleado[] = [];

  // --- Formulario Maestro ---
  entradaMaestro = {
    idProveedor: null as number | null,
    factura_proveedor: '', 
    vale_interno: '',     
    observaciones: '',
    recibidoPorID: null as number | null,
    razon_social: null as string | null
  };

  // --- Lógica para Autocompletes ---
  refaccionControl = new FormControl();
  insumoControl = new FormControl();
  filteredRefacciones$: Observable<ItemSimple[]>;
  filteredInsumos$: Observable<ItemSimple[]>;
  
  // --- Formulario de Detalle (unificado) ---
  detalleActual = {
    tipo_item: 'Refacción' as 'Refacción' | 'Insumo',
    id_item: null as number | null,
    cantidad: null as number | null,
    costo_ingresado: null as number | null,
    tipo_costo: 'unitario' as 'unitario' | 'neto',
    aplica_iva: false
  };

  // --- Lista de Items a Agregar ---
  detallesAAgregar: DetalleTemporal[] = [];
  isSaving = false;

  // --- Notificaciones ---
  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };

  constructor(private http: HttpClient, private router: Router, private location: Location) {
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
    this.cargarCatalogos();
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
      error: err => {
        this.mostrarNotificacion('Error de Carga', 'No se pudieron cargar los datos necesarios para el formulario.', 'error');
      }
    });
  }

  onTipoItemChange(): void {
    this.detalleActual.id_item = null;
    this.refaccionControl.setValue('');
    this.insumoControl.setValue('');
  }

  agregarDetalle() {
    const { tipo_item, id_item, cantidad, costo_ingresado, tipo_costo, aplica_iva } = this.detalleActual;
    const itemControl = tipo_item === 'Refacción' ? this.refaccionControl : this.insumoControl;
    const itemSeleccionado = itemControl.value as ItemSimple;

    if (!id_item || !itemSeleccionado || !cantidad || cantidad <= 0 || (costo_ingresado !== 0 && !costo_ingresado) || costo_ingresado < 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Busca y selecciona un ítem, y completa una cantidad y costo válidos.');
      return;
    }

    if (this.detallesAAgregar.some(d => d.id === id_item && d.tipo === tipo_item)) {
      this.mostrarNotificacion('Ítem Duplicado', `Este ${tipo_item.toLowerCase()} ya ha sido agregado a la lista.`);
      return;
    }

    const nuevoDetalle: DetalleTemporal = {
      id: id_item,
      nombre: itemSeleccionado.nombre,
      tipo: tipo_item,
      cantidad,
      costo_ingresado,
      tipo_costo,
      aplica_iva
    };

    this.detallesAAgregar = [...this.detallesAAgregar, nuevoDetalle];
    this.resetDetalleActual();
  }
  
  resetDetalleActual(): void {
    const tipoActual = this.detalleActual.tipo_item;
    this.detalleActual = { tipo_item: tipoActual, id_item: null, cantidad: null, costo_ingresado: null, tipo_costo: 'unitario', aplica_iva: false };
    this.refaccionControl.setValue('');
    this.insumoControl.setValue('');
  }

  eliminarDetalle(index: number): void {
    this.detallesAAgregar = this.detallesAAgregar.filter((_, i) => i !== index);
  }

  guardarEntradaCompleta() {
    if (this.isSaving) return;
    if (!this.entradaMaestro.idProveedor || !this.entradaMaestro.recibidoPorID) {
      this.mostrarNotificacion('Datos Incompletos', 'Debes seleccionar un proveedor y quién recibe la mercancía.');
      return;
    }
    if (this.detallesAAgregar.length === 0) {
      this.mostrarNotificacion('Sin Detalles', 'Debes agregar al menos una refacción o insumo a la entrada.');
      return;
    }

    this.isSaving = true;
     const payloadMaestro = {
      ID_Proveedor: this.entradaMaestro.idProveedor,
      Factura_Proveedor: this.entradaMaestro.factura_proveedor, 
      Vale_Interno: this.entradaMaestro.vale_interno,           
      Observaciones: this.entradaMaestro.observaciones,
      Recibido_Por_ID: this.entradaMaestro.recibidoPorID,
      Razon_Social: this.entradaMaestro.razon_social
    };

    this.http.post<any>(`${this.apiUrl}/entradas`, payloadMaestro).subscribe({
      next: (respuestaMaestro) => {
        const nuevaEntradaID = respuestaMaestro.id_entrada;

        const peticionesRefacciones = this.detallesAAgregar
            .filter(d => d.tipo === 'Refacción')
            .map(detalle => this.http.post(`${this.apiUrl}/detalle-entrada`, {
                ID_Entrada: nuevaEntradaID,
                ID_Refaccion: detalle.id,
                Cantidad_Recibida: detalle.cantidad,
                costo_ingresado: detalle.costo_ingresado,
                tipo_costo: detalle.tipo_costo,
                aplica_iva: detalle.aplica_iva
            }));
            
        const peticionesInsumos = this.detallesAAgregar
            .filter(d => d.tipo === 'Insumo')
            .map(detalle => this.http.post(`${this.apiUrl}/detalle-entrada-insumo`, {
                ID_Entrada: nuevaEntradaID,
                ID_Insumo: detalle.id,
                Cantidad_Recibida: detalle.cantidad,
                costo_ingresado: detalle.costo_ingresado,
                tipo_costo: detalle.tipo_costo,
                aplica_iva: detalle.aplica_iva
            }));

        const todasLasPeticiones = [...peticionesRefacciones, ...peticionesInsumos];
        if (todasLasPeticiones.length === 0) {
            this.finalizarGuardado();
            return;
        }

        forkJoin(todasLasPeticiones).subscribe({
          next: () => {
            this.finalizarGuardado();
          },
          error: err => {
            const serverMessage = err.error?.message || 'Error desconocido al guardar detalles.';
            this.mostrarNotificacion('Error al Guardar Detalles', serverMessage, 'error');
            this.isSaving = false;
          }
        });
      },
      error: err => {
        const serverMessage = err.error?.message || 'Error desconocido al crear la entrada.';
        this.mostrarNotificacion('Error al Crear Entrada', serverMessage, 'error');
        this.isSaving = false;
      }
    });
  }

  private finalizarGuardado(): void {
    sessionStorage.setItem('notificacion', '¡Entrada registrada exitosamente!');
    this.isSaving = false;
    this.router.navigate(['/admin/entradas']);
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