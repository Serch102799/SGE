import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin, Observable, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { environment } from '../../../../environments/environments';
import { AuthService } from '../../../services/auth.service';

// --- Interfaces ---
interface Autobus { id_autobus: number; economico: string; kilometraje_actual: number; }
interface Empleado { id_empleado: number; nombre: string; }
interface RefaccionSimple { id_refaccion: number; nombre: string; marca: string; numero_parte: string; } 
interface InsumoSimple { id_insumo: number; nombre: string; stock_actual: number; unidad_medida: string; }
interface Lote { id_lote: number; cantidad_disponible: number; costo_unitario_compra: number; nombre_proveedor: string; }
interface DetalleRefaccionTemporal { id_lote: number; id_refaccion: number; nombre_refaccion: string; nombre_proveedor: string; cantidad_despachada: number; }
interface DetalleInsumoTemporal { id_insumo: number; nombre_insumo: string; cantidad_usada: number; }

@Component({
  selector: 'app-registro-salida',
  standalone: false,
  templateUrl: './registro-salida.component.html',
  styleUrls: ['./registro-salida.component.css']
})
export class RegistroSalidaComponent implements OnInit {

  private apiUrl = environment.apiUrl;

  // --- Catálogos (solo para dropdowns estáticos) ---
  empleados: Empleado[] = [];
  
  // --- Formularios y Listas ---
  salidaMaestro = {
    tipoSalida: 'Mantenimiento Correctivo',
    idAutobus: null as number | null,
    solicitadoPorID: null as number | null,
    observaciones: '',
    kilometraje: null as number | null
  };
  
  // --- Lógica para Autocompletes ---
  autobusControl = new FormControl();
  refaccionControl = new FormControl();
  insumoControl = new FormControl();

  filteredAutobuses$: Observable<Autobus[]>;
  filteredRefacciones$: Observable<RefaccionSimple[]>;
  filteredInsumos$: Observable<InsumoSimple[]>;

  detalleActualRefaccion = { id_refaccion: null as number | null, id_lote: null as number | null, cantidad_despachada: null as number | null };
  lotesDisponibles: Lote[] = [];
  detallesRefaccionesAAgregar: DetalleRefaccionTemporal[] = [];

  detalleActualInsumo = { id_insumo: null as number | null, cantidad_usada: null as number | null };
  detallesInsumosAAgregar: DetalleInsumoTemporal[] = [];
  
  isSaving = false;
  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };
  
  constructor(private http: HttpClient, private router: Router, private location: Location, public authService: AuthService) {
    // Se inicializan los observables para los autocompletes
    this.filteredAutobuses$ = this.autobusControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => this._buscarApi('autobuses', value || ''))
    );
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

  private _buscarApi(tipo: 'autobuses' | 'refacciones' | 'insumos', term: any): Observable<any[]> {
    const searchTerm = typeof term === 'string' ? term : term.nombre || term.economico;
    if (!searchTerm || searchTerm.length < 1) {
      return of([]);
    }
    return this.http.get<any[]>(`${this.apiUrl}/${tipo}/buscar`, { params: { term: searchTerm } });
  }

  displayFn(item: any): string {
    return item ? item.nombre || item.economico : '';
  }

  onAutobusSelected(event: MatAutocompleteSelectedEvent): void {
    const autobus = event.option.value as Autobus;
    this.salidaMaestro.idAutobus = autobus.id_autobus;
    this.salidaMaestro.kilometraje = autobus.kilometraje_actual;
  }

  onRefaccionSelected(event: MatAutocompleteSelectedEvent): void {
    const refaccion = event.option.value as RefaccionSimple;
    this.detalleActualRefaccion.id_refaccion = refaccion.id_refaccion;
    this.onRefaccionSelect();
  }

  onInsumoSelected(event: MatAutocompleteSelectedEvent): void {
    const insumo = event.option.value as InsumoSimple;
    this.detalleActualInsumo.id_insumo = insumo.id_insumo;
  }
  
  cargarCatalogos() {
    // La carga inicial ahora solo trae el catálogo de empleados
    this.http.get<Empleado[]>(`${this.apiUrl}/empleados`).subscribe({
      next: (empleados) => { this.empleados = empleados; },
      error: err => this.mostrarNotificacion('Error de Carga', 'No se pudo cargar el catálogo de empleados.', 'error')
    });
  }
  
  onRefaccionSelect() {
    this.lotesDisponibles = [];
    this.detalleActualRefaccion.id_lote = null;
    const idRefaccion = this.detalleActualRefaccion.id_refaccion;
    if (idRefaccion) {
      this.http.get<Lote[]>(`${this.apiUrl}/lotes/${idRefaccion}`).subscribe(lotes => this.lotesDisponibles = lotes);
    }
  }

  agregarDetalleRefaccion() {
    const { id_lote, cantidad_despachada } = this.detalleActualRefaccion;
    const refaccionSeleccionada = this.refaccionControl.value as RefaccionSimple;

    if (!refaccionSeleccionada || !refaccionSeleccionada.id_refaccion || !id_lote || !cantidad_despachada || cantidad_despachada <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Busca y selecciona una refacción, un lote y una cantidad válida.');
      return;
    }
    const lote = this.lotesDisponibles.find(l => l.id_lote === id_lote);
    if (!lote) return;
    if (cantidad_despachada > lote.cantidad_disponible) {
      this.mostrarNotificacion('Stock Insuficiente', `Stock insuficiente en este lote. Disponible: ${lote.cantidad_disponible}`);
      return;
    }
    this.detallesRefaccionesAAgregar.push({ 
      id_lote, id_refaccion: refaccionSeleccionada.id_refaccion, nombre_refaccion: refaccionSeleccionada.nombre, 
      nombre_proveedor: lote.nombre_proveedor || 'N/A', cantidad_despachada 
    });
    this.refaccionControl.setValue('');
    this.detalleActualRefaccion = { id_refaccion: null, id_lote: null, cantidad_despachada: null };
    this.lotesDisponibles = [];
  }

  agregarDetalleInsumo() {
    const { cantidad_usada } = this.detalleActualInsumo;
    const insumoSeleccionado = this.insumoControl.value as InsumoSimple;

    if (!insumoSeleccionado || !insumoSeleccionado.id_insumo || !cantidad_usada || cantidad_usada <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Busca y selecciona un insumo y una cantidad válida.');
      return;
    }
    // Necesitamos obtener el stock actualizado del insumo seleccionado
    this.http.get<InsumoSimple>(`${this.apiUrl}/insumos/${insumoSeleccionado.id_insumo}`).subscribe(insumoDetalle => {
        if (cantidad_usada > insumoDetalle.stock_actual) {
            this.mostrarNotificacion('Stock Insuficiente', `Stock insuficiente. Disponible: ${insumoDetalle.stock_actual}`);
            return;
        }
        this.detallesInsumosAAgregar.push({ 
            id_insumo: insumoSeleccionado.id_insumo, 
            nombre_insumo: insumoSeleccionado.nombre, 
            cantidad_usada 
        });
        this.insumoControl.setValue('');
        this.detalleActualInsumo = { id_insumo: null, cantidad_usada: null };
    });
  }
  
  guardarSalidaCompleta() {
    if (this.isSaving) return;
    if (!this.salidaMaestro.idAutobus || !this.salidaMaestro.solicitadoPorID || !this.salidaMaestro.tipoSalida || !this.salidaMaestro.kilometraje) {
      this.mostrarNotificacion('Datos Incompletos', 'Completa los datos del vale de salida (Tipo, Autobús, Kilometraje, Solicitado Por).');
      return;
    }
    // La validación de kilometraje ahora se basa en el objeto del FormControl
    const autobusSeleccionado = this.autobusControl.value as Autobus;
    if (autobusSeleccionado && this.salidaMaestro.kilometraje < autobusSeleccionado.kilometraje_actual) {
      this.mostrarNotificacion('Dato Inválido', `El kilometraje no puede ser menor al actual (${autobusSeleccionado.kilometraje_actual}).`);
      return;
    }
    if (this.detallesRefaccionesAAgregar.length === 0 && this.detallesInsumosAAgregar.length === 0) {
      this.mostrarNotificacion('Sin Detalles', 'Agrega al menos una refacción o insumo.');
      return;
    }
    
    this.isSaving = true;
    const payloadMaestro = {
      Tipo_Salida: this.salidaMaestro.tipoSalida,
      ID_Autobus: this.salidaMaestro.idAutobus,
      Solicitado_Por_ID: this.salidaMaestro.solicitadoPorID,
      Observaciones: this.salidaMaestro.observaciones,
      Kilometraje_Autobus: this.salidaMaestro.kilometraje
    };
    this.http.post<any>(`${this.apiUrl}/salidas`, payloadMaestro).subscribe({
      next: (respuestaMaestro) => {
        const nuevaSalidaID = respuestaMaestro.id_salida;
        const peticionesDetalle = [];

        for (const detalle of this.detallesRefaccionesAAgregar) {
          const payload = { ID_Salida: nuevaSalidaID, ID_Refaccion: detalle.id_refaccion, Cantidad_Despachada: detalle.cantidad_despachada, ID_Lote: detalle.id_lote };
          peticionesDetalle.push(this.http.post(`${this.apiUrl}/detalleSalida`, payload));
        }
        for (const detalle of this.detallesInsumosAAgregar) {
          const payload = { id_salida: nuevaSalidaID, id_insumo: detalle.id_insumo, cantidad_usada: detalle.cantidad_usada };
          peticionesDetalle.push(this.http.post(`${this.apiUrl}/detalle-salida-insumo`, payload));
        }

        if (peticionesDetalle.length === 0) { this.finalizarGuardado(); return; }

        forkJoin(peticionesDetalle).subscribe({
          next: () => this.finalizarGuardado(),
          error: err => { this.mostrarNotificacion('Error', `Error al guardar los detalles: ${err.error?.message || 'Error desconocido'}`, 'error'); this.isSaving = false; }
        });
      },
      error: err => { this.mostrarNotificacion('Error', `Error al crear la salida principal: ${err.error?.message || 'Error desconocido'}`, 'error'); this.isSaving = false; }
    });
  }

  private finalizarGuardado() {
    sessionStorage.setItem('notificacion', '¡Salida registrada exitosamente!');
    this.isSaving = false;
    this.router.navigate(['/admin/salidas']);
  }

  regresar() { this.location.back(); }
  eliminarDetalleRefaccion(index: number) { this.detallesRefaccionesAAgregar.splice(index, 1); }
  eliminarDetalleInsumo(index: number) { this.detallesInsumosAAgregar.splice(index, 1); }
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') { this.notificacion = { titulo, mensaje, tipo }; this.mostrarModalNotificacion = true; }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}