import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Interfaces ---
export interface Autobus {
  id_autobus: number;
  economico: string;
  marca: string;
  modelo: string;
  anio: number;
  kilometraje_actual: number;
  vin: string;
  razon_social: string;
  chasis: string;
  motor: string;
  tarjeta_circulacion: string;
  placa: string;
  sistema: string;
  hp: number;
  carroceria: string;
  sistema_electrico: string;
  medida_llanta: string;
  kilometraje_ultima_carga?: number; // Añadido para evitar el error
}

@Component({
  selector: 'app-autobuses',
  standalone: false,
  templateUrl: './autobuses.component.html',
  styleUrls: ['./autobuses.component.css']
})
export class AutobusesComponent implements OnInit, OnDestroy {

  autobuses: Autobus[] = [];
  private apiUrl = `${environment.apiUrl}/autobuses`;
  private historialApiUrl = `${environment.apiUrl}/historial`;

  // --- Listas para Dropdowns ---
  razonesSociales: string[] = ['MARTRESS', 'A8M', 'TRESA', 'GIALJU'];
  sistemasEmisiones: string[] = ['UREA', 'EGR', 'OTRO'];

  // --- Estado de la Tabla ---
  sortField: string = 'economico';
  sortDirection: 'asc' | 'desc' = 'asc';
  currentPage: number = 1;
  itemsPerPage: number = 10; 
  totalItems: number = 0;

  // --- Búsqueda ---
  terminoBusqueda: string = '';
  private searchSubject: Subject<string> = new Subject<string>();
  private searchSubscription?: Subscription;

  // --- Estado de los Modales ---
  mostrarModal = false;
  modoEdicion = false;
  autobusSeleccionado: Partial<Autobus> = {};
  
  mostrarModalBorrar = false;
  autobusABorrar: Autobus | null = null;

  mostrarModalDetalles = false;
  autobusParaDetalles: Autobus | null = null;
  
  mostrarModalHistorial = false;
  historialCompleto: any[] = [];
  historialFiltrado: any[] = [];
  autobusSeleccionadoEconomico: string | null = null;
  costoTotalHistorial: number = 0;
  
  filtroHistorialItem: string = '';
  filtroHistorialFechaInicio: string = '';
  filtroHistorialFechaFin: string = '';

  mostrarModalSyncKm = false;
  autobusParaSync: Autobus | null = null;
  kmSincronizar: number | null = null;
  
  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient, public authService: AuthService, private router: Router) { }

  ngOnInit(): void {
    this.obtenerAutobuses();
    
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerAutobuses();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }
  
  obtenerAutobuses(): void {
    const params = {
      page: this.currentPage.toString(),
      limit: this.itemsPerPage.toString(),
      search: this.terminoBusqueda.trim(),
      sortBy: this.sortField,
      sortOrder: this.sortDirection
    };

    this.http.get<{ total: number, data: Autobus[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.autobuses = response.data || [];
        this.totalItems = response.total || 0;
      },
      error: (err) => {
        console.error('Error al obtener autobuses', err);
        this.mostrarNotificacion('Error', 'No se pudo cargar la lista de autobuses.', 'error');
        this.autobuses = [];
        this.totalItems = 0;
      }
    });
  }
  
  onSort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.obtenerAutobuses();
  }

  onSearchChange(): void {
    this.searchSubject.next(this.terminoBusqueda);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerAutobuses();
  }

  abrirModal(modo: 'agregar' | 'editar', autobus?: Autobus): void {
    this.modoEdicion = (modo === 'editar');
    if (modo === 'editar' && autobus) {
      this.autobusSeleccionado = { ...autobus };
    } else {
      // Se inicializan TODOS los campos para un nuevo autobús
      this.autobusSeleccionado = {
        economico: '', vin: '', razon_social: '', placa: '', chasis: '',
        motor: '', tarjeta_circulacion: '', sistema: '', hp: undefined,
        carroceria: '', sistema_electrico: '', medida_llanta: ''
      };
    }
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }

  guardarAutobus(): void {
    if (!this.autobusSeleccionado.economico || !this.autobusSeleccionado.vin || !this.autobusSeleccionado.razon_social/*  || !this.autobusSeleccionado.placa */) {
      this.mostrarNotificacion('Campos Requeridos', 'Económico, VIN, y Razón Social son obligatorios.');
      return;
    }

    // Se construye el payload con TODOS los campos, incluyendo los nuevos
    const payload = {
      Economico: this.autobusSeleccionado.economico,
      Marca: this.autobusSeleccionado.marca,
      Modelo: this.autobusSeleccionado.modelo,
      Anio: this.autobusSeleccionado.anio,
      Kilometraje_Actual: this.autobusSeleccionado.kilometraje_actual,
      VIN: this.autobusSeleccionado.vin,
      Razon_Social: this.autobusSeleccionado.razon_social,
      Chasis: this.autobusSeleccionado.chasis,
      Motor: this.autobusSeleccionado.motor,
      Tarjeta_Circulacion: this.autobusSeleccionado.tarjeta_circulacion,
      Placa: this.autobusSeleccionado.placa,
      Sistema: this.autobusSeleccionado.sistema,
      HP: this.autobusSeleccionado.hp,
      Carroceria: this.autobusSeleccionado.carroceria,
      Sistema_Electrico: this.autobusSeleccionado.sistema_electrico,
      Medida_Llanta: this.autobusSeleccionado.medida_llanta
    };

    const request = this.modoEdicion
      ? this.http.put(`${this.apiUrl}/${this.autobusSeleccionado.id_autobus}`, payload)
      : this.http.post(this.apiUrl, payload);

    request.subscribe({
      next: () => this.postGuardado(`Autobús ${this.modoEdicion ? 'actualizado' : 'creado'} exitosamente.`),
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || `No se pudo ${this.modoEdicion ? 'actualizar' : 'crear'}.`, 'error')
    });
  }

  abrirModalBorrar(autobus: Autobus): void {
    this.autobusABorrar = autobus;
    this.mostrarModalBorrar = true;
  }

  cerrarModalBorrar(): void {
    this.mostrarModalBorrar = false;
    this.autobusABorrar = null;
  }

  confirmarEliminacion(): void {
    if (!this.autobusABorrar) return;
    const url = `${this.apiUrl}/${this.autobusABorrar.id_autobus}`;
    this.http.delete(url).subscribe({
      next: () => this.postGuardado('Autobús eliminado exitosamente.'),
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo eliminar.', 'error')
    });
  }

  private postGuardado(mensaje: string): void {
    this.mostrarNotificacion('Éxito', mensaje, 'exito');
    this.obtenerAutobuses(); 
    this.cerrarModal();
    this.cerrarModalBorrar();
  }

  abrirModalDetalles(autobus: Autobus): void {
    this.autobusParaDetalles = autobus;
    this.mostrarModalDetalles = true;
  }

  cerrarModalDetalles(): void {
    this.mostrarModalDetalles = false;
    this.autobusParaDetalles = null;
  }

  editarDesdeDetalles(): void {
    if (this.autobusParaDetalles) {
      this.abrirModal('editar', this.autobusParaDetalles as Autobus);
      this.cerrarModalDetalles();
    }
  }

  verHistorialDesdeDetalles(): void {
    if (this.autobusParaDetalles) {
      this.verHistorial(this.autobusParaDetalles as Autobus);
      this.cerrarModalDetalles();
    }
  }

  verHistorial(autobus: Autobus): void {
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

  cerrarModalHistorial(): void {
    this.mostrarModalHistorial = false;
    this.historialCompleto = [];
    this.historialFiltrado = [];
    this.filtroHistorialItem = '';
    this.filtroHistorialFechaInicio = '';
    this.filtroHistorialFechaFin = '';
  }
  
  aplicarFiltroHistorial() {
  // 1. Filtrar la lista
  this.historialFiltrado = this.historialCompleto.filter(item => {
    // Filtro de Texto (nombre, marca o tipo)
    const coincideTexto = !this.filtroHistorialItem || 
      item.nombre.toLowerCase().includes(this.filtroHistorialItem.toLowerCase()) ||
      item.tipo_item.toLowerCase().includes(this.filtroHistorialItem.toLowerCase()) ||
      item.marca?.toLowerCase().includes(this.filtroHistorialItem.toLowerCase());

    // Filtro de Fechas
    const fechaItem = new Date(item.fecha).getTime();
    const fechaInicio = this.filtroHistorialFechaInicio ? new Date(this.filtroHistorialFechaInicio).getTime() : 0;
    
    // Para fecha fin, ajustamos al final del día
    let fechaFin = Infinity;
    if (this.filtroHistorialFechaFin) {
        const fin = new Date(this.filtroHistorialFechaFin);
        fin.setHours(23, 59, 59, 999);
        fechaFin = fin.getTime();
    }

    const coincideFecha = fechaItem >= fechaInicio && fechaItem <= fechaFin;

    return coincideTexto && coincideFecha;
  });

  this.costoTotalHistorial = this.historialFiltrado.reduce((acumulado, item) => {
    return acumulado + (Number(item.costo) || 0);
  }, 0);
}
  abrirModalSyncKm(autobus: Autobus): void {
    this.autobusParaSync = autobus;
    this.kmSincronizar = autobus.kilometraje_ultima_carga !== undefined ? autobus.kilometraje_ultima_carga : null; // Precarga el valor actual
    this.mostrarModalSyncKm = true;
  }

  cerrarModalSyncKm(): void {
    this.mostrarModalSyncKm = false;
  }

  guardarSyncKm(): void {
    if (!this.autobusParaSync || this.kmSincronizar === null || this.kmSincronizar < 0) {
      this.mostrarNotificacion('Dato Inválido', 'Ingresa un kilometraje válido.');
      return;
    }

    const url = `${this.apiUrl}/${this.autobusParaSync.id_autobus}/sync-km-carga`;
    const payload = { kilometraje: this.kmSincronizar };

    this.http.post(url, payload).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Kilometraje para cargas sincronizado.', 'exito');
        this.cerrarModalSyncKm();
        this.obtenerAutobuses(); // Refresca la lista
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'No se pudo sincronizar.', 'error');
      }
    });
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
  exportarHistorialExcel() {
  if (this.historialFiltrado.length === 0) {
    this.mostrarNotificacion('Sin datos', 'No hay registros para exportar.', 'advertencia');
    return;
  }

  // Mapear datos
  const data = this.historialFiltrado.map(item => ({
    'Fecha': new Date(item.fecha).toLocaleDateString(),
    'Kilometraje': item.kilometraje,
    'Tipo': item.tipo_item,
    'Descripción': item.nombre,
    'Marca': item.marca || '-',
    'Cantidad': item.cantidad,
    'Costo Unitario': (item.costo / item.cantidad) || 0, // Cálculo aproximado si tienes el total
    'Costo Total': item.costo,
    'Solicitado Por': item.solicitado_por
  }));

  // Crear hoja y libro
  const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
  const wb: XLSX.WorkBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Historial');

  // Guardar
  XLSX.writeFile(wb, `Historial_Bus_${this.autobusSeleccionadoEconomico}.xlsx`);
}

// 2. Exportar a PDF
exportarHistorialPDF() {
  if (this.historialFiltrado.length === 0) {
    this.mostrarNotificacion('Sin datos', 'No hay registros para exportar.', 'advertencia');
    return;
  }

  const doc = new jsPDF();

  // Encabezado del PDF
  doc.setFontSize(18);
  doc.text(`Historial de Mantenimiento: Autobús #${this.autobusSeleccionadoEconomico}`, 14, 20);
  
  doc.setFontSize(12);
  doc.text(`Costo Total del Periodo: $${this.costoTotalHistorial.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 14, 30);
  
  doc.setFontSize(10);
  doc.text(`Fecha de reporte: ${new Date().toLocaleDateString()}`, 14, 36);

  // Generar tabla
  autoTable(doc, {
    startY: 40,
    head: [['Fecha', 'KM', 'Tipo', 'Descripción', 'Cant.', 'Costo', 'Solicitante']],
    body: this.historialFiltrado.map(item => [
      new Date(item.fecha).toLocaleDateString(),
      item.kilometraje,
      item.tipo_item,
      item.nombre,
      item.cantidad,
      `$${Number(item.costo).toFixed(2)}`,
      item.solicitado_por
    ]),
    theme: 'grid',
    headStyles: { fillColor: [44, 62, 80] }, // Color oscuro azulado
    styles: { fontSize: 8 }
  });

  // Guardar
  doc.save(`Historial_Bus_${this.autobusSeleccionadoEconomico}.pdf`);
}
}