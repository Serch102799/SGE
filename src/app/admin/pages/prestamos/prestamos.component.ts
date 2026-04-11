import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PrestamoActivo {
  id_prestamo: number;
  fecha_prestamo: string;
  fecha_devolucion?: string; 
  estado_devolucion?: string; 
  nombre_solicitante_manual?: string; 
  solicitante?: string; 
  id_detalle_prestamo: number;
  tipo_item: string;
  nombre_item: string;
  cantidad_prestada: number;
  cantidad_devuelta: number;
  pendiente: number;
  costo_unitario?: number;
  valor_total_prestado?: number;
}

interface ItemBusqueda {
  id: number;
  nombre: string;
  stock_actual?: number;
  cantidad_disponible?: number;
  tipo: 'insumo' | 'refaccion' | 'herramienta';
}

@Component({
  selector: 'app-prestamos',
  standalone: false,
  templateUrl: './prestamos.component.html',
  styleUrls: ['./prestamos.component.css']
})
export class PrestamosComponent implements OnInit {
  
  private apiUrl = environment.apiUrl;
  
  vistaActual: 'activos' | 'historico' = 'activos'; 
  
  prestamosActivos: PrestamoActivo[] = [];
  prestamosHistoricos: PrestamoActivo[] = []; 
  loading = false;

  // ==========================================
  // 🚀 VARIABLES PARA FILTROS Y PAGINACIÓN (HISTÓRICO)
  // ==========================================
  filteredHistoricos: PrestamoActivo[] = [];
  paginatedHistoricos: PrestamoActivo[] = [];
  
  filtroBusquedaHist: string = '';
  filtroFechaInicioHist: string = '';
  filtroFechaFinHist: string = '';

  paginaActualHist: number = 1;
  itemsPorPaginaHist: number = 10;
  totalPaginasHist: number = 1;

  // --- Modales e Inputs ---
  mostrarModalNuevo = false;
  mostrarModalDevolucion = false;

  itemControl = new FormControl();
  filteredItems$: Observable<ItemBusqueda[]>;
  
  nuevoPrestamo = { nombre_solicitante_manual: '', observaciones: '', items: [] as any[] };
  itemSeleccionadoTemporal: ItemBusqueda | null = null;
  cantidadAPrestar: number = 1;
  tipoItemBusqueda: 'insumo' | 'refaccion' | 'herramienta' = 'insumo'; 

  itemParaDevolver: PrestamoActivo | null = null;
  datosDevolucion = { cantidad: 0, estado: 'BUENO' };

  mostrarModalNotificacion = false;
  notificacion = { titulo: '', mensaje: '', tipo: 'exito' as 'exito' | 'error' | 'advertencia' };

  constructor(private http: HttpClient, public authService: AuthService) {
    this.filteredItems$ = this.itemControl.valueChanges.pipe(
      startWith(''), debounceTime(300), distinctUntilChanged(),
      switchMap(val => this._buscarItem(val || ''))
    );
  }

  ngOnInit(): void {
    this.obtenerPrestamosActivos();
  }

  cambiarVista(vista: 'activos' | 'historico') {
    this.vistaActual = vista;
    if (vista === 'activos') {
      this.obtenerPrestamosActivos();
    } else {
      this.obtenerPrestamosHistoricos();
    }
  }

  obtenerPrestamosActivos() {
    this.loading = true;
    this.http.get<PrestamoActivo[]>(`${this.apiUrl}/prestamos/activos`).subscribe({
      next: (data) => {
        this.prestamosActivos = data.map(p => ({
            ...p, solicitante: p.nombre_solicitante_manual || p.solicitante || 'Desconocido'
        }));
        this.loading = false;
      },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }

  obtenerPrestamosHistoricos() {
    this.loading = true;
    this.http.get<PrestamoActivo[]>(`${this.apiUrl}/prestamos/historico`).subscribe({
      next: (data) => {
        this.prestamosHistoricos = data.map(p => ({
            ...p, solicitante: p.nombre_solicitante_manual || p.solicitante || 'Desconocido'
        }));
        this.aplicarFiltrosHist(); // 🚀 Filtramos y paginamos al cargar
        this.loading = false;
      },
      error: (err) => { console.error(err); this.loading = false; }
    });
  }

  // ==========================================
  // 🚀 LÓGICA DE FILTRADO Y PAGINACIÓN (HISTÓRICO)
  // ==========================================
  aplicarFiltrosHist() {
    this.filteredHistoricos = this.prestamosHistoricos.filter(p => {
      let matchBusqueda = true;
      let matchFecha = true;

      if (this.filtroBusquedaHist) {
        const term = this.filtroBusquedaHist.toLowerCase();
        matchBusqueda = 
          (p.solicitante && p.solicitante.toLowerCase().includes(term)) ||
          (p.nombre_item && p.nombre_item.toLowerCase().includes(term)) ||
          (!!p.id_prestamo && p.id_prestamo.toString().includes(term));
      }

      if (this.filtroFechaInicioHist || this.filtroFechaFinHist) {
        const fechaPrestamo = p.fecha_prestamo ? p.fecha_prestamo.split('T')[0] : '';
        if (this.filtroFechaInicioHist) matchFecha = matchFecha && (fechaPrestamo >= this.filtroFechaInicioHist);
        if (this.filtroFechaFinHist) matchFecha = matchFecha && (fechaPrestamo <= this.filtroFechaFinHist);
      }

      return matchBusqueda && matchFecha;
    });

    this.totalPaginasHist = Math.ceil(this.filteredHistoricos.length / this.itemsPorPaginaHist) || 1;
    this.paginaActualHist = 1;
    this.actualizarPaginacionHist();
  }

  limpiarFiltrosHist() {
    this.filtroBusquedaHist = ''; this.filtroFechaInicioHist = ''; this.filtroFechaFinHist = '';
    this.aplicarFiltrosHist();
  }

  actualizarPaginacionHist() {
    const inicio = (this.paginaActualHist - 1) * this.itemsPorPaginaHist;
    const fin = inicio + this.itemsPorPaginaHist;
    this.paginatedHistoricos = this.filteredHistoricos.slice(inicio, fin);
  }

  cambiarPaginaHist(delta: number) {
    const nuevaPagina = this.paginaActualHist + delta;
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginasHist) {
      this.paginaActualHist = nuevaPagina;
      this.actualizarPaginacionHist();
    }
  }

  // ==========================================
  // 🚀 EXPORTACIONES (Exportan lo que esté filtrado)
  // ==========================================
  exportarExcel() {
    // Si estamos en histórico, exportamos lo filtrado. Si no, los activos completos.
    const data = this.vistaActual === 'activos' ? this.prestamosActivos : this.filteredHistoricos;
    
    if(data.length === 0){
      this.mostrarNotificacion('Sin datos', 'No hay registros para exportar.', 'advertencia');
      return;
    }

    const dataLimpia = data.map(p => ({
      'ID Préstamo': p.id_prestamo,
      'Fecha': new Date(p.fecha_prestamo).toLocaleDateString(),
      'Solicitante': p.solicitante,
      'Tipo Item': p.tipo_item.toUpperCase(),
      'Herramienta/Insumo': p.nombre_item,
      'Prestados': p.cantidad_prestada,
      'Devueltos': p.cantidad_devuelta,
      'Pendientes': p.pendiente || 0,
      'Estado Devolución': p.estado_devolucion || (p.pendiente > 0 ? 'Pendiente' : 'Cerrado')
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataLimpia);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Prestamos_${this.vistaActual}`);
    
    XLSX.writeFile(wb, `Reporte_Prestamos_${this.vistaActual}_${new Date().getTime()}.xlsx`);
    this.mostrarNotificacion('Exportación Exitosa', 'El archivo Excel se ha descargado.', 'exito');
  }

  // 🚀 --- Exportar a PDF (AHORA CON TOTALES EN VERDE) ---
  exportarPDF() {
    const data = this.vistaActual === 'activos' ? this.prestamosActivos : this.filteredHistoricos;
    
    if(data.length === 0){
      this.mostrarNotificacion('Sin datos', 'No hay registros para exportar.', 'advertencia');
      return;
    }

    // 1. CALCULAMOS LOS TOTALES
    const totalPrestados = data.reduce((sum, p) => sum + Number(p.cantidad_prestada || 0), 0);
    const totalDevueltos = data.reduce((sum, p) => sum + Number(p.cantidad_devuelta || 0), 0);

    const doc = new jsPDF('landscape'); 
    
    // Título Principal
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0); // Letra negra para el título
    doc.text(`Reporte de Préstamos de Pañol - ${this.vistaActual.toUpperCase()}`, 14, 15);
    
    // Fecha
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100); // Gris para la fecha
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 14, 22);

    // 2. IMPRIMIMOS LOS TOTALES CON COLORES
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    
    // Total Prestados en VERDE
    doc.setTextColor(34, 197, 94); 
    doc.text(`Total Prestado: ${totalPrestados} piezas`, 14, 30);

    // Total Devueltos o Pendientes dependiendo de la pestaña
    if (this.vistaActual === 'historico') {
        doc.setTextColor(56, 189, 248); // Azul brillante para devueltos
        doc.text(`Total Devuelto: ${totalDevueltos} piezas`, 80, 30);
    } else {
        const totalPendientes = data.reduce((sum, p) => sum + Number(p.pendiente || 0), 0);
        doc.setTextColor(239, 68, 68); // Rojo para alertar de piezas sin devolver
        doc.text(`Total Pendientes de Devolver: ${totalPendientes} piezas`, 80, 30);
    }

    // 3. ARMAMOS LA TABLA
    const columnas = [['ID', 'Fecha', 'Mecánico / Solicitante', 'Tipo', 'Artículo', 'Prestados', 'Devueltos', 'Valor ($)', 'Estado']];
    const filas = data.map(p => [
      String(p.id_prestamo ?? ''),
      new Date(p.fecha_prestamo).toLocaleDateString(),
      String(p.solicitante ?? ''),
      String(p.tipo_item ?? '').toUpperCase(),
      String(p.nombre_item ?? ''),
      String(p.cantidad_prestada ?? ''),
      String(p.cantidad_devuelta ?? ''),
      `$${Number(p.valor_total_prestado || 0).toFixed(2)}`,
      String(p.estado_devolucion || (p.pendiente > 0 ? 'Pendiente' : 'Cerrado'))
    ]);

    autoTable(doc, {
      head: columnas, 
      body: filas, 
      startY: 38, // Bajamos el inicio de la tabla para que quepan los totales
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] }, 
      styles: { fontSize: 9 }
    });

    doc.save(`Reporte_Prestamos_${this.vistaActual}_${new Date().getTime()}.pdf`);
    this.mostrarNotificacion('Exportación Exitosa', 'El archivo PDF se ha descargado.', 'exito');
  }

  // --- Resto de las funciones intactas (buscarItem, abrirModalNuevo, guardarPrestamo, etc.) ---
  cambiarTipoBusqueda(tipo: 'insumo' | 'refaccion' | 'herramienta') {
    this.tipoItemBusqueda = tipo; this.itemControl.setValue(''); this.itemSeleccionadoTemporal = null;
  }

  private _buscarItem(term: any): Observable<ItemBusqueda[]> {
    const searchTerm = typeof term === 'string' ? term : term.nombre;
    if (!searchTerm || searchTerm.length < 2) return of([]);
    const endpoint = this.tipoItemBusqueda === 'insumo' ? 'insumos' : 'refacciones';
    return this.http.get<any[]>(`${this.apiUrl}/${endpoint}/buscar`, { params: { term: searchTerm } })
      .pipe(map(items => items.map(i => ({
        id: this.tipoItemBusqueda === 'insumo' ? i.id_insumo : i.id_refaccion,
        nombre: i.nombre,
        stock_actual: this.tipoItemBusqueda === 'insumo' ? i.stock_actual : i.cantidad_disponible,
        tipo: this.tipoItemBusqueda 
      }))));
  }

  displayFnItem(item: ItemBusqueda): string { return item ? item.nombre : ''; }

  abrirModalNuevo() {
    this.nuevoPrestamo = { nombre_solicitante_manual: '', observaciones: '', items: [] };
    this.itemControl.setValue(''); this.itemSeleccionadoTemporal = null; this.mostrarModalNuevo = true;
  }

  seleccionarItem(event: MatAutocompleteSelectedEvent) { this.itemSeleccionadoTemporal = event.option.value as ItemBusqueda; }

  agregarAlCarrito() {
    if (!this.itemSeleccionadoTemporal || this.cantidadAPrestar <= 0) return;
    const stock = this.itemSeleccionadoTemporal.stock_actual !== undefined ? this.itemSeleccionadoTemporal.stock_actual : (this.itemSeleccionadoTemporal.cantidad_disponible || 0);
    if (this.cantidadAPrestar > stock) {
      this.mostrarNotificacion('Stock Insuficiente', `Solo hay ${stock} disponibles.`, 'advertencia'); return;
    }
    this.nuevoPrestamo.items.push({ ...this.itemSeleccionadoTemporal, cantidad: this.cantidadAPrestar });
    this.itemControl.setValue(''); this.itemSeleccionadoTemporal = null; this.cantidadAPrestar = 1;
  }

  eliminarDelCarrito(index: number) { this.nuevoPrestamo.items.splice(index, 1); }

  guardarPrestamo() {
    if (!this.nuevoPrestamo.nombre_solicitante_manual.trim()) {
        this.mostrarNotificacion('Faltan Datos', 'Escribe el nombre del mecánico.', 'advertencia'); return;
    }
    if (this.nuevoPrestamo.items.length === 0) {
      this.mostrarNotificacion('Faltan Datos', 'Agrega al menos una herramienta o insumo.', 'advertencia'); return;
    }

    const payload = {
        nombre_solicitante_manual: this.nuevoPrestamo.nombre_solicitante_manual, observaciones: this.nuevoPrestamo.observaciones,
        items: this.nuevoPrestamo.items.map(i => ({ id: i.id, cantidad: i.cantidad, tipo: i.tipo === 'herramienta' ? 'refaccion' : i.tipo }))
    };

    this.http.post(`${this.apiUrl}/prestamos`, payload).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Préstamo registrado correctamente.', 'exito');
        this.mostrarModalNuevo = false;
        this.vistaActual === 'activos' ? this.obtenerPrestamosActivos() : this.obtenerPrestamosHistoricos();
      },
      error: (err) => { this.mostrarNotificacion('Error', err.error?.message || 'Error al guardar.', 'error'); }
    });
  }

  abrirModalDevolucion(item: PrestamoActivo) {
    this.itemParaDevolver = item; this.datosDevolucion = { cantidad: item.pendiente, estado: 'BUENO' };
    this.mostrarModalDevolucion = true;
  }

  confirmarDevolucion() {
    if (!this.itemParaDevolver) return;
    if (this.datosDevolucion.cantidad > this.itemParaDevolver.pendiente) {
        this.mostrarNotificacion('Error', 'No puedes devolver más de lo pendiente.', 'error'); return;
    }

    const payload = {
      id_detalle_prestamo: this.itemParaDevolver.id_detalle_prestamo, cantidad_devuelta: this.datosDevolucion.cantidad, estado_devolucion: this.datosDevolucion.estado
    };

    this.http.put(`${this.apiUrl}/prestamos/devolucion`, payload).subscribe({
      next: () => {
        this.mostrarNotificacion('Devolución Exitosa', 'El inventario ha sido actualizado.', 'exito');
        this.mostrarModalDevolucion = false;
        this.obtenerPrestamosActivos(); 
      },
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'Error al devolver.', 'error')
    });
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo }; this.mostrarModalNotificacion = true;
  }
  cerrarNotificacion() { this.mostrarModalNotificacion = false; }
}