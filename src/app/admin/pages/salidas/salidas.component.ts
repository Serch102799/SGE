import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import * as Papa from 'papaparse';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';


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

interface RefaccionSimple { id_refaccion: number; nombre: string; stock_actual: number; }
interface InsumoSimple { id_insumo: number; nombre: string; stock_actual: number; unidad_medida: string; }
interface Lote {
  id_lote: number;
  cantidad_disponible: number;
  costo_unitario_compra: number;
  nombre_proveedor: string;
}

@Component({
  selector: 'app-salidas',
  standalone: false,
  templateUrl: './salidas.component.html',
  styleUrls: ['./salidas.component.css']
})
export class SalidasComponent implements OnInit {

  salidas: Salida[] = [];
  salidasFiltradas: Salida[] = [];
  private apiUrl = `${environment.apiUrl}/salidas`;
  
  terminoBusqueda: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';

  mostrarModalDetalles = false;
  detallesSeleccionados: any[] = [];
  salidaSeleccionadaId: number | null = null;

  // Modal "Agregar Items"
  mostrarModalAgregarItems = false;
  salidaSeleccionada: Salida | null = null;
  itemsExistentes: any[] = [];
  itemsNuevosRefacciones: any[] = [];
  itemsNuevosInsumos: any[] = [];
  detalleActualRefaccion = { id_refaccion: null as number | null, id_lote: null as number | null, cantidad_despachada: null as number | null };
  detalleActualInsumo = { id_insumo: null as number | null, cantidad_usada: null as number | null };
  refacciones: RefaccionSimple[] = [];
  insumos: InsumoSimple[] = [];
  lotesDisponibles: Lote[] = [];

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient, private router: Router, public authService: AuthService) { }

  ngOnInit(): void {
    this.obtenerSalidas();
    this.revisarNotificaciones();
    this.cargarCatalogos(); 
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }
  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
  revisarNotificaciones() {
    const notificacionMsg = sessionStorage.getItem('notificacion');
    if (notificacionMsg) {
      this.mostrarNotificacion('Éxito', notificacionMsg, 'exito');
      sessionStorage.removeItem('notificacion');
    }
  }

  obtenerSalidas() {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.salidas = data.map(item => ({
          idSalida: item.id_salida, fechaSalida: item.fecha_operacion, tipoSalida: item.tipo_salida,
          idAutobus: item.id_autobus, solicitadoPorID: item.solicitado_por_id, observaciones: item.observaciones,
          economicoAutobus: item.economico_autobus, nombreEmpleado: item.nombre_empleado, kilometrajeAutobus: item.kilometraje_autobus
        }));
        this.aplicarFiltros();
      },
      error: (err) => console.error('Error al obtener las salidas', err)
    });
  }

  aplicarFiltros() {
    let salidasTemp = this.salidas;
    const busqueda = this.terminoBusqueda.toLowerCase();
    if (this.terminoBusqueda) {
      salidasTemp = salidasTemp.filter(s =>
        (s.economicoAutobus && s.economicoAutobus.toLowerCase().includes(busqueda)) ||
        (s.tipoSalida && s.tipoSalida.toLowerCase().includes(busqueda)) ||
        (s.nombreEmpleado && s.nombreEmpleado.toLowerCase().includes(busqueda))
      );
    }
    if (this.fechaInicio) {
      const fechaDesde = new Date(this.fechaInicio);
      salidasTemp = salidasTemp.filter(s => new Date(s.fechaSalida) >= fechaDesde);
    }
    if (this.fechaFin) {
      const fechaHasta = new Date(this.fechaFin);
      fechaHasta.setDate(fechaHasta.getDate() + 1);
      salidasTemp = salidasTemp.filter(s => new Date(s.fechaSalida) < fechaHasta);
    }
    this.salidasFiltradas = salidasTemp;
  }
  
  cargarCatalogos() {
    const peticiones = [
      this.http.get<RefaccionSimple[]>(`${environment.apiUrl}/refacciones`),
      this.http.get<InsumoSimple[]>(`${environment.apiUrl}/insumos`)
    ];
    forkJoin(peticiones).subscribe(([refacciones, insumos]) => {
      this.refacciones = refacciones as RefaccionSimple[];
      this.insumos = insumos as InsumoSimple[];
    });
  }

  registrarNuevaSalida() { this.router.navigate(['/admin/registro-salida']); }

  exportarACSV() {
    if (this.salidasFiltradas.length === 0) { this.mostrarNotificacion('Sin Datos', 'No hay datos para exportar.'); return; }
    const dataParaExportar = this.salidasFiltradas.map(salida => ({
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
      next: (detalles) => { this.detallesSeleccionados = detalles; this.mostrarModalDetalles = true; },
      error: (err) => this.mostrarNotificacion('Error', 'No se pudieron cargar los detalles.', 'error')
    });
  }
  cerrarModalDetalles() { this.mostrarModalDetalles = false; }

  abrirModalAgregarItems(salida: Salida) {
    this.salidaSeleccionada = salida;
    this.itemsNuevosRefacciones = [];
    this.itemsNuevosInsumos = [];
    this.detalleActualRefaccion = { id_refaccion: null, id_lote: null, cantidad_despachada: null };
    this.detalleActualInsumo = { id_insumo: null, cantidad_usada: null };
    this.lotesDisponibles = [];
    
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
      this.http.get<Lote[]>(`${environment.apiUrl}/lotes/${idRefaccion}`).subscribe(lotes => {
        this.lotesDisponibles = lotes;
      });
    }
  }

  agregarNuevaRefaccion() {
    const { id_refaccion, id_lote, cantidad_despachada } = this.detalleActualRefaccion;
    if (!id_refaccion || !id_lote || !cantidad_despachada || cantidad_despachada <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Selecciona refacción, lote y cantidad.'); return;
    }
    const refaccion = this.refacciones.find(r => r.id_refaccion === id_refaccion);
    const lote = this.lotesDisponibles.find(l => l.id_lote === id_lote);
    if (!refaccion || !lote) return;
    if (cantidad_despachada > lote.cantidad_disponible) {
      this.mostrarNotificacion('Stock Insuficiente', `Disponibles en este lote: ${lote.cantidad_disponible}`); return;
    }
    this.itemsNuevosRefacciones.push({ id_refaccion, id_lote, nombre_refaccion: refaccion.nombre, nombre_proveedor: lote.nombre_proveedor, cantidad_despachada });
    this.detalleActualRefaccion = { id_refaccion: null, id_lote: null, cantidad_despachada: null };
    this.lotesDisponibles = [];
  }

  agregarNuevoInsumo() {
    const { id_insumo, cantidad_usada } = this.detalleActualInsumo;
    if (!id_insumo || !cantidad_usada || cantidad_usada <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Selecciona un insumo y cantidad válida.'); return;
    }
    const insumo = this.insumos.find(i => i.id_insumo === id_insumo);
    if (!insumo) return;
    if (cantidad_usada > insumo.stock_actual) {
      this.mostrarNotificacion('Stock Insuficiente', `Disponibles: ${insumo.stock_actual}`); return;
    }
    this.itemsNuevosInsumos.push({ id_insumo, nombre_insumo: insumo.nombre, cantidad_usada });
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
        this.mostrarNotificacion('Éxito', 'Valores agregados correctamente a la salida.', 'exito');
        this.cerrarModalAgregarItems();
        this.obtenerSalidas();
      },
      error: (err) => this.mostrarNotificacion('Error', `Error al agregar: ${err.error.message}`, 'error')
    });
  }
}