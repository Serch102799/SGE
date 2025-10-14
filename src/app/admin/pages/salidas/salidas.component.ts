import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject, Subscription, forkJoin, Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, startWith, switchMap } from 'rxjs/operators';
import * as Papa from 'papaparse';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

// --- Interfaces ---
export interface Salida {
  idSalida: number;
  fechaSalida: string;
  tipoSalida: string;
  idAutobus: number;
  solicitadoPorID: number;
  observaciones: string;
  economicoAutobus: string;
  nombreEmpleado: string;
  kilometrajeAutobus: number;
}
interface RefaccionSimple { id_refaccion: number; nombre: string; marca: string; numero_parte: string; }
interface InsumoSimple { id_insumo: number; nombre: string; stock_actual: number; unidad_medida: string; }
interface Lote { id_lote: number; cantidad_disponible: number; nombre_proveedor: string; }

@Component({
  selector: 'app-salidas',
  standalone: false,
  templateUrl: './salidas.component.html',
  styleUrls: ['./salidas.component.css']
})
export class SalidasComponent implements OnInit, OnDestroy {

  private apiUrl = `${environment.apiUrl}/salidas`;
  
  // --- Estado de la Tabla Principal ---
  salidas: Salida[] = [];
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;
  
  // --- Filtros ---
  terminoBusqueda: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';
  private searchSubject: Subject<void> = new Subject<void>();
  private searchSubscription?: Subscription;

  // --- Modal de Detalles ---
  mostrarModalDetalles = false;
  detallesSeleccionados: any[] = [];
  salidaSeleccionadaId: number | null = null;

  // --- Modal "Agregar Items" ---
  mostrarModalAgregarItems = false;
  salidaSeleccionada: Salida | null = null;
  itemsExistentes: any[] = [];
  itemsNuevosRefacciones: any[] = [];
  itemsNuevosInsumos: any[] = [];

  mostrarModalDevolucion = false;
  itemParaDevolucion: any = null; // Guardará el detalle seleccionado
  datosDevolucion = {
    cantidad_devuelta: null as number | null,
    motivo: ''
  };
  
  // --- Lógica de Autocomplete para el Modal ---
  refaccionControl = new FormControl();
  insumoControl = new FormControl();
  filteredRefacciones$: Observable<RefaccionSimple[]>;
  filteredInsumos$: Observable<InsumoSimple[]>;
  
  detalleActualRefaccion = { id_refaccion: null as number | null, id_lote: null as number | null, cantidad_despachada: null as number | null };
  detalleActualInsumo = { id_insumo: null as number | null, cantidad_usada: null as number | null };
  lotesDisponibles: Lote[] = [];

  // --- Notificaciones ---
  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };

  constructor(private http: HttpClient, private router: Router, public authService: AuthService) {
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
    this.revisarNotificaciones();
    
    this.searchSubscription = this.searchSubject.pipe(
      startWith(undefined), 
      debounceTime(400)
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerSalidas();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  private _buscarApi(tipo: 'refacciones' | 'insumos', term: any): Observable<any[]> {
    const searchTerm = typeof term === 'string' ? term : term.nombre;
    if (!searchTerm || searchTerm.length < 2) {
      return of([]);
    }
    return this.http.get<any[]>(`${environment.apiUrl}/${tipo}/buscar`, { params: { term: searchTerm } });
  }

  displayFn(item: any): string {
    return item ? item.nombre : '';
  }

  onRefaccionSelectedEnModal(event: MatAutocompleteSelectedEvent): void {
    const refaccion = event.option.value as RefaccionSimple;
    this.detalleActualRefaccion.id_refaccion = refaccion.id_refaccion;
    this.onRefaccionSelectEnModal();
  }

  onInsumoSelectedEnModal(event: MatAutocompleteSelectedEvent): void {
    const insumo = event.option.value as InsumoSimple;
    this.detalleActualInsumo.id_insumo = insumo.id_insumo;
  }

  obtenerSalidas() {
    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('limit', this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim());
    
    if (this.fechaInicio) params = params.set('fechaInicio', this.fechaInicio);
    if (this.fechaFin) params = params.set('fechaFin', this.fechaFin);
    
    this.http.get<{ total: number, data: any[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.salidas = (response.data || []).map(item => ({
          idSalida: item.id_salida,
          fechaSalida: item.fecha_operacion,
          tipoSalida: item.tipo_salida,
          idAutobus: item.id_autobus,
          solicitadoPorID: item.solicitado_por_id,
          observaciones: item.observaciones,
          economicoAutobus: item.economico_autobus,
          nombreEmpleado: item.nombre_empleado,
          kilometrajeAutobus: item.kilometraje_autobus
        }));
        this.totalItems = response.total || 0;
      },
      error: (err) => {
        console.error('Error al obtener las salidas', err);
        this.salidas = [];
        this.totalItems = 0;
      }
    });
  }

  onFiltroChange(): void {
    this.searchSubject.next();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerSalidas();
  }
  
  registrarNuevaSalida() { this.router.navigate(['/admin/registro-salida']); }

  exportarACSV() {
    if (this.salidas.length === 0) { this.mostrarNotificacion('Sin Datos', 'No hay datos para exportar.'); return; }
    const dataParaExportar = this.salidas.map(salida => ({
      'ID Salida': salida.idSalida, 'Fecha': salida.fechaSalida, 'Tipo de Salida': salida.tipoSalida,
      'Autobús': salida.economicoAutobus, 'Kilometraje': salida.kilometrajeAutobus, 'Solicitado Por': salida.nombreEmpleado, 'Observaciones': salida.observaciones
    }));
    const csv = Papa.unparse(dataParaExportar);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'reporte_salidas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  verDetalles(salida: Salida) {
    this.salidaSeleccionadaId = salida.idSalida;
    this.http.get<any[]>(`${this.apiUrl}/detalles/${salida.idSalida}`).subscribe({
      next: (detalles) => {
        this.detallesSeleccionados = detalles;
        this.mostrarModalDetalles = true;
      },
      error: (err) => this.mostrarNotificacion('Error', 'No se pudieron cargar los detalles.', 'error')
    });
  }
  cerrarModalDetalles() { this.mostrarModalDetalles = false; }

  abrirModalAgregarItems(salida: Salida) {
    this.salidaSeleccionada = salida;
    this.itemsNuevosRefacciones = [];
    this.itemsNuevosInsumos = [];
    this.resetDetalleRefaccion();
    this.resetDetalleInsumo();
    
    this.http.get<any[]>(`${this.apiUrl}/detalles/${salida.idSalida}`).subscribe(detalles => {
      this.itemsExistentes = detalles;
      this.mostrarModalAgregarItems = true;
    });
  }
  cerrarModalAgregarItems() { this.mostrarModalAgregarItems = false; }

  onRefaccionSelectEnModal() {
    this.lotesDisponibles = [];
    this.detalleActualRefaccion.id_lote = null;
    const idRefaccion = this.detalleActualRefaccion.id_refaccion;
    if (idRefaccion) {
      this.http.get<Lote[]>(`${environment.apiUrl}/lotes/${idRefaccion}`).subscribe(lotes => this.lotesDisponibles = lotes);
    }
  }

  agregarNuevaRefaccion() {
    const { id_lote, cantidad_despachada } = this.detalleActualRefaccion;
    const refaccionSeleccionada = this.refaccionControl.value as RefaccionSimple;

    if (!refaccionSeleccionada || !refaccionSeleccionada.id_refaccion || !id_lote || !cantidad_despachada || cantidad_despachada <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Busca y selecciona una refacción, un lote y una cantidad válida.'); return;
    }
    const lote = this.lotesDisponibles.find(l => l.id_lote === id_lote);
    if (!lote) return;
    if (cantidad_despachada > lote.cantidad_disponible) {
      this.mostrarNotificacion('Stock Insuficiente', `Disponibles en este lote: ${lote.cantidad_disponible}`); return;
    }
    this.itemsNuevosRefacciones.push({ id_refaccion: refaccionSeleccionada.id_refaccion, id_lote, nombre_refaccion: refaccionSeleccionada.nombre, nombre_proveedor: lote.nombre_proveedor, cantidad_despachada });
    this.resetDetalleRefaccion();
  }
  
  resetDetalleRefaccion() {
      this.refaccionControl.setValue('');
      this.detalleActualRefaccion = { id_refaccion: null, id_lote: null, cantidad_despachada: null };
      this.lotesDisponibles = [];
  }

  agregarNuevoInsumo() {
    const { cantidad_usada } = this.detalleActualInsumo;
    const insumoSeleccionado = this.insumoControl.value as InsumoSimple;

    if (!insumoSeleccionado || !insumoSeleccionado.id_insumo || !cantidad_usada || cantidad_usada <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Busca y selecciona un insumo y una cantidad válida.'); return;
    }
    
    this.http.get<InsumoSimple>(`${environment.apiUrl}/insumos/${insumoSeleccionado.id_insumo}`).subscribe(insumoDetalle => {
        if (cantidad_usada > insumoDetalle.stock_actual) {
            this.mostrarNotificacion('Stock Insuficiente', `Stock insuficiente. Disponible: ${insumoDetalle.stock_actual}`); return;
        }
        this.itemsNuevosInsumos.push({ id_insumo: insumoSeleccionado.id_insumo, nombre_insumo: insumoSeleccionado.nombre, cantidad_usada });
        this.resetDetalleInsumo();
    });
  }

  resetDetalleInsumo() {
      this.insumoControl.setValue('');
      this.detalleActualInsumo = { id_insumo: null, cantidad_usada: null };
  }
  
  guardarItemsAdicionales() {
    if (!this.salidaSeleccionada) return;
    const peticionesDetalle = [];
    for (const detalle of this.itemsNuevosRefacciones) {
      const payload = { ID_Salida: this.salidaSeleccionada.idSalida, ID_Refaccion: detalle.id_refaccion, Cantidad_Despachada: detalle.cantidad_despachada, ID_Lote: detalle.id_lote };
      peticionesDetalle.push(this.http.post(`${environment.apiUrl}/detalleSalida`, payload));
    }
    for (const detalle of this.itemsNuevosInsumos) {
      const payload = { id_salida: this.salidaSeleccionada.idSalida, id_insumo: detalle.id_insumo, cantidad_usada: detalle.cantidad_usada };
      peticionesDetalle.push(this.http.post(`${environment.apiUrl}/detalle-salida-insumo`, payload));
    }
    if (peticionesDetalle.length === 0) { this.cerrarModalAgregarItems(); return; }
    forkJoin(peticionesDetalle).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Items agregados correctamente a la salida.', 'exito');
        this.cerrarModalAgregarItems();
        this.obtenerSalidas();
      },
      error: (err) => this.mostrarNotificacion('Error', `Error al agregar: ${err.error.message}`, 'error')
    });
  }
  
  revisarNotificaciones() {
    const notificacionMsg = sessionStorage.getItem('notificacion');
    if (notificacionMsg) {
      this.mostrarNotificacion('Éxito', notificacionMsg, 'exito');
      sessionStorage.removeItem('notificacion');
    }
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }
  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
  abrirModalDevolucion(detalle: any): void {
    const cantidadMaxima = detalle.cantidad - (detalle.cantidad_devuelta || 0);
    this.itemParaDevolucion = { ...detalle, cantidad_maxima: cantidadMaxima };
    this.datosDevolucion = { cantidad_devuelta: null, motivo: '' };
    this.mostrarModalDevolucion = true;
  }

  cerrarModalDevolucion(): void {
    this.mostrarModalDevolucion = false;
  }

  guardarDevolucion(): void {
    if (!this.itemParaDevolucion || !this.datosDevolucion.cantidad_devuelta || this.datosDevolucion.cantidad_devuelta <= 0 || !this.datosDevolucion.motivo.trim()) {
      this.mostrarNotificacion('Datos Incompletos', 'Debes ingresar una cantidad y un motivo válidos.');
      return;
    }
    if (this.datosDevolucion.cantidad_devuelta > this.itemParaDevolucion.cantidad_maxima) {
      this.mostrarNotificacion('Cantidad Inválida', `No puedes devolver más de la cantidad pendiente (${this.itemParaDevolucion.cantidad_maxima}).`);
      return;
    }

    const payload = {
      tipo_item: this.itemParaDevolucion.tipo_item,
      id_detalle_salida: this.itemParaDevolucion.id_detalle,
      cantidad_devuelta: this.datosDevolucion.cantidad_devuelta,
      motivo: this.datosDevolucion.motivo
    };

    this.http.post(`${environment.apiUrl}/superadmin/devolucion`, payload).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Devolución registrada correctamente. El stock ha sido actualizado.', 'exito');
        this.cerrarModalDevolucion();
        this.cerrarModalDetalles();
        this.obtenerSalidas();
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'No se pudo procesar la devolución.', 'error');
      }
    });
  }
}