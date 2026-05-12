import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { 
  faSearch, faEdit, faTrashAlt, faPlus, 
  faBuilding, faEnvelope, faPhone, faUserTie, faTimes
} from '@fortawesome/free-solid-svg-icons';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfFooter } from '../../../shared/utils/pdf-footer.util';
import { ExportNotificationService } from '../../../shared/services/export-notification.service';

// --- INTERFACES ---
export interface Proveedor {
  id_proveedor: number;
  nombre_proveedor: string;
  contacto: string;
  telefono: string;
  correo: string;
  direccion: string;
  rfc: string;
}

export interface CompraDetalle {
  fecha: string;
  tipo_compra: string;
  documento: string;
  costo_total: number;
  articulos: string;
}

export interface ReporteCompra {
  id_proveedor: number;
  proveedor: string;
  total_comprado: number;
  detalles: CompraDetalle[];
}

@Component({
  selector: 'app-proveedores',
  standalone: false,
  templateUrl: './proveedores.component.html',
  styleUrls: ['./proveedores.component.css']
})
export class ProveedoresComponent implements OnInit {

  faSearch = faSearch; faEdit = faEdit; faTrashAlt = faTrashAlt; 
  faPlus = faPlus; faBuilding = faBuilding; faEnvelope = faEnvelope; 
  faPhone = faPhone; faUserTie = faUserTie; faTimes = faTimes;

  vistaActual: 'directorio' | 'dashboard' = 'directorio';

  // --- ESTADO: DIRECTORIO ---
  proveedores: Proveedor[] = [];
  proveedoresFiltrados: Proveedor[] = [];
  private apiUrl = `${environment.apiUrl}/proveedores`;
  terminoBusqueda: string = '';

  mostrarModal = false; modoEdicion = false;
  proveedorSeleccionado: Partial<Proveedor> = {};
  mostrarModalBorrar = false; proveedorABorrar: Proveedor | null = null;
  
  // --- ESTADO: DASHBOARD FINANCIERO ---
  datosReporte: ReporteCompra[] = [];
  
  // Paginación Dashboard
  paginaActual: number = 1;
  itemsPorPagina: number = 5;
  totalPaginas: number = 1;
  proveedoresPaginados: ReporteCompra[] = [];
  detallesPaginados: CompraDetalle[] = [];

  filtroIdProveedor: string = ''; 
  fechaInicio: string = ''; fechaFin: string = '';
  loadingReporte = false;
  granTotalGeneral = 0; maxCompraValor = 0;

  // --- NOTIFICACIONES ---
  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };

  constructor(private http: HttpClient, public authService: AuthService, private exportNotif: ExportNotificationService) { }


  ngOnInit(): void {
    this.obtenerProveedores();
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.fechaInicio = primerDia.toISOString().split('T')[0];
    this.fechaFin = hoy.toISOString().split('T')[0];
  }

  cambiarVista(vista: 'directorio' | 'dashboard') {
    this.vistaActual = vista;
    if (vista === 'dashboard' && this.datosReporte.length === 0) {
      this.generarReporte();
    }
  }

  // ==========================================
  // LÓGICA DIRECTORIO
  // ==========================================
  obtenerIniciales(nombre: string): string {
    if (!nombre) return 'PR';
    const partes = nombre.trim().split(' ');
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return nombre.substring(0, 2).toUpperCase();
  }

  obtenerProveedores() {
    this.http.get<Proveedor[]>(this.apiUrl).subscribe({
      next: (data) => { this.proveedores = data; this.proveedoresFiltrados = data; },
      error: (err) => console.error('Error al obtener proveedores', err)
    });
  }

  aplicarFiltros() {
    const busqueda = this.terminoBusqueda.toLowerCase();
    this.proveedoresFiltrados = this.proveedores.filter(p =>
      p.nombre_proveedor.toLowerCase().includes(busqueda) ||
      (p.contacto && p.contacto.toLowerCase().includes(busqueda)) ||
      (p.rfc && p.rfc.toLowerCase().includes(busqueda))
    );
  }

  abrirModal(modo: 'agregar' | 'editar', proveedor?: Proveedor) {
    this.modoEdicion = (modo === 'editar');
    this.proveedorSeleccionado = modo === 'editar' && proveedor ? { ...proveedor } : { nombre_proveedor: '' };
    this.mostrarModal = true;
  }
  cerrarModal() { this.mostrarModal = false; }

  guardarProveedor() {
    if (!this.proveedorSeleccionado.nombre_proveedor) {
      this.mostrarNotificacion('Campo Requerido', 'El nombre del proveedor es obligatorio.', 'advertencia'); return;
    }
    const payload = {
      Nombre_Proveedor: this.proveedorSeleccionado.nombre_proveedor, Contacto: this.proveedorSeleccionado.contacto,
      Telefono: this.proveedorSeleccionado.telefono, Correo: this.proveedorSeleccionado.correo,
      Direccion: this.proveedorSeleccionado.direccion, RFC: this.proveedorSeleccionado.rfc
    };

    const peticion = this.modoEdicion 
      ? this.http.put(`${this.apiUrl}/nombre/${this.proveedorSeleccionado.nombre_proveedor}`, payload)
      : this.http.post(this.apiUrl, payload);

    peticion.subscribe({
      next: () => this.postGuardado(this.modoEdicion ? 'Actualizado exitosamente.' : 'Agregado exitosamente.'),
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'Hubo un error.', 'error')
    });
  }

  abrirModalBorrar(proveedor: Proveedor) { this.proveedorABorrar = proveedor; this.mostrarModalBorrar = true; }
  cerrarModalBorrar() { this.mostrarModalBorrar = false; this.proveedorABorrar = null; }

  confirmarEliminacion() {
    if (!this.proveedorABorrar) return;
    this.http.delete(`${this.apiUrl}/nombre/${this.proveedorABorrar.nombre_proveedor}`).subscribe({
      next: () => this.postGuardado('Proveedor eliminado exitosamente.'),
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo eliminar.', 'error')
    });
  }

  // ==========================================
  // LÓGICA DASHBOARD & PAGINACIÓN
  // ==========================================
  generarReporte() {
    if (!this.fechaInicio || !this.fechaFin) {
      this.mostrarNotificacion('Faltan datos', 'Selecciona un rango de fechas.', 'advertencia'); return;
    }
    this.loadingReporte = true;
    let params = new HttpParams().set('fechaInicio', this.fechaInicio).set('fechaFin', this.fechaFin);
    if (this.filtroIdProveedor) params = params.set('idProveedor', this.filtroIdProveedor);

    this.http.get<ReporteCompra[]>(`${environment.apiUrl}/reportes/compras-proveedor`, { params }).subscribe({
      next: (data) => {
        this.datosReporte = data;
        this.granTotalGeneral = this.datosReporte.reduce((sum, item) => sum + Number(item.total_comprado), 0);
        this.maxCompraValor = this.datosReporte.length > 0 ? Math.max(...this.datosReporte.map(d => Number(d.total_comprado))) : 0;
        
        this.paginaActual = 1;
        this.actualizarPaginacion();
        this.loadingReporte = false;
      },
      error: () => {
        this.mostrarNotificacion('Error', 'No se pudo generar el reporte financiero.', 'error');
        this.loadingReporte = false;
      }
    });
  }

  actualizarPaginacion() {
    if (!this.filtroIdProveedor && this.datosReporte.length > 0) {
      this.itemsPorPagina = 5;
      this.totalPaginas = Math.ceil(this.datosReporte.length / this.itemsPorPagina) || 1;
      const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
      this.proveedoresPaginados = this.datosReporte.slice(inicio, inicio + this.itemsPorPagina);
    } else if (this.filtroIdProveedor && this.datosReporte.length > 0) {
      this.itemsPorPagina = 10;
      this.totalPaginas = Math.ceil(this.datosReporte[0].detalles.length / this.itemsPorPagina) || 1;
      const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
      this.detallesPaginados = this.datosReporte[0].detalles.slice(inicio, inicio + this.itemsPorPagina);
    }
  }

  cambiarPagina(delta: number) {
    const nuevaPagina = this.paginaActual + delta;
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas) {
      this.paginaActual = nuevaPagina;
      this.actualizarPaginacion();
    }
  }

  // ==========================================
  // EXPORTACIONES (DIRECTORIO)
  // ==========================================
  exportarDirectorioExcel() {
    if (this.proveedoresFiltrados.length === 0) {
      this.mostrarNotificacion('Sin Datos', 'No hay proveedores para exportar.', 'advertencia'); return;
    }
    
    const data = this.proveedoresFiltrados.map(p => ({
      'Empresa': p.nombre_proveedor,
      'RFC': p.rfc || 'No registrado',
      'Contacto Principal': p.contacto || 'Sin contacto',
      'Teléfono': p.telefono || 'N/A',
      'Correo': p.correo || 'N/A',
      'Dirección': p.direccion || 'N/A'
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Directorio');
    const filename = `Directorio_Proveedores_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(wb, filename);
    this.exportNotif.showExcel(filename);
  }

  exportarDirectorioPDF() {
    if (this.proveedoresFiltrados.length === 0) {
      this.mostrarNotificacion('Sin Datos', 'No hay proveedores para exportar.', 'advertencia'); return;
    }

    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.width;
    let yPos = 0;

    // --- ENCABEZADO MODERNO ---
    doc.setFillColor(30, 41, 59); // Fondo oscuro Slate 800
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Título Principal
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('DIRECTORIO DE PROVEEDORES', 20, 24);

    // Subtítulo / Fecha
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, 34);

    // Resumen a la derecha
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(`Total Registrados: ${this.proveedoresFiltrados.length}`, pageWidth - 20, 27, { align: 'right' });
    
    // Línea decorativa de acento
    doc.setFillColor(56, 189, 248); // Sky 400
    doc.rect(pageWidth - 75, 34, 55, 2, 'F'); 
    // -------------------------

    yPos = 55;

    const columnas = [['Empresa', 'RFC', 'Contacto Principal', 'Teléfono', 'Correo', 'Dirección']];
    const filas = this.proveedoresFiltrados.map(p => [
      p.nombre_proveedor,
      p.rfc || '-',
      p.contacto || '-',
      p.telefono || '-',
      p.correo || '-',
      p.direccion || '-'
    ]);

    autoTable(doc, { 
      head: columnas, 
      body: filas, 
      startY: yPos,
      theme: 'plain',
      headStyles: { 
        fillColor: [241, 245, 249], // Slate 100
        textColor: [15, 23, 42], // Slate 900
        fontStyle: 'bold',
        fontSize: 10,
        cellPadding: { top: 6, bottom: 6, left: 5, right: 5 }
      },
      bodyStyles: { 
        textColor: [71, 85, 105], // Slate 500
        fontSize: 9,
        cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
        lineWidth: { bottom: 0.1 },
        lineColor: [226, 232, 240] // Slate 200
      },
      alternateRowStyles: { 
        fillColor: [250, 250, 252] // Gris muy claro para filas alternas
      },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [30, 41, 59], cellWidth: 55 } // Empresa en negritas y ancho fijo
      },
      margin: { left: 20, right: 20 },
      didDrawPage: function (data) {
        const docSettings = doc.internal.pageSize;
        const pageHeight = docSettings.height || docSettings.getHeight();
        
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('Página ' + (doc as any).internal.getNumberOfPages(), data.settings.margin.left, pageHeight - 10);
        doc.text('Directorio Telefónico Corporativo', pageWidth - data.settings.margin.right, pageHeight - 10, { align: 'right' });
      }
    });

    const filename = `Directorio_Proveedores_${new Date().getTime()}.pdf`;
    doc.save(filename);
    this.exportNotif.showPdf(filename);
  }

  // ==========================================
  // EXPORTACIONES (DETALLADAS)
  // ==========================================
  exportarExcel() {
    if (this.datosReporte.length === 0) {
      this.mostrarNotificacion('Sin Datos', 'No hay información para exportar.', 'advertencia'); return;
    }
    let dataLimpia: any[] = [];

    if (!this.filtroIdProveedor) {
      this.datosReporte.forEach((prov) => {
        dataLimpia.push({
          'Proveedor': `=== ${prov.proveedor.toUpperCase()} ===`, 'Fecha': '', 'Tipo Operación': '', 'Documento / Factura': '', 'Artículos / Detalles': 'TOTAL PROVEEDOR:', 'Monto ($)': Number(prov.total_comprado)
        });
        if (prov.detalles) {
          prov.detalles.forEach(d => {
            dataLimpia.push({
              'Proveedor': '', 'Fecha': new Date(d.fecha).toLocaleDateString(), 'Tipo Operación': d.tipo_compra, 'Documento / Factura': d.documento, 'Artículos / Detalles': d.articulos, 'Monto ($)': Number(d.costo_total)
            });
          });
        }
        dataLimpia.push({});
      });
    } else {
      const prov = this.datosReporte[0];
      dataLimpia = prov.detalles.map(d => ({
        'Proveedor': prov.proveedor, 'Fecha': new Date(d.fecha).toLocaleDateString(), 'Tipo Operación': d.tipo_compra, 'Documento / Factura': d.documento, 'Artículos / Detalles': d.articulos, 'Monto ($)': Number(d.costo_total)
      }));
    }

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataLimpia);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte_Compras');
    const filename = `Reporte_Compras_Proveedor_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(wb, filename);
    this.exportNotif.showExcel(filename);
  }

  // 3. ACTUALIZA EXPORTAR PDF
  exportarPDF() {
    if (this.datosReporte.length === 0) {
      this.mostrarNotificacion('Sin Datos', 'No hay información para exportar.', 'advertencia'); return;
    }

    const doc = new jsPDF('landscape'); // 👈 LO PONEMOS EN HORIZONTAL PORQUE AHORA HAY MÁS TEXTO
    let yPos = 15;
    doc.setFontSize(16); doc.text('Análisis de Compras por Proveedor', 14, yPos); yPos += 7;
    doc.setFontSize(10); doc.text(`Periodo: ${new Date(this.fechaInicio).toLocaleDateString()} al ${new Date(this.fechaFin).toLocaleDateString()}`, 14, yPos); yPos += 10;

    if (!this.filtroIdProveedor) {
      doc.setTextColor(34, 197, 94); doc.setFontSize(12);
      doc.text(`GRAN TOTAL INVERTIDO: $${this.granTotalGeneral.toLocaleString('es-MX', {minimumFractionDigits:2})}`, 14, yPos);
      yPos += 10; doc.setTextColor(0, 0, 0);

      this.datosReporte.forEach((prov, index) => {
        if (yPos > 180) { doc.addPage(); yPos = 20; }
        doc.setFillColor(240, 240, 240); doc.rect(14, yPos - 5, 269, 10, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text(`#${index + 1} - ${prov.proveedor}`, 16, yPos);
        doc.setTextColor(34, 197, 94); doc.text(`Total: $${Number(prov.total_comprado).toLocaleString('es-MX', {minimumFractionDigits:2})}`, 230, yPos);
        doc.setTextColor(0, 0, 0); yPos += 8;

        if (prov.detalles && prov.detalles.length > 0) {
          const bodyData = prov.detalles.map(d => [ new Date(d.fecha).toLocaleDateString(), d.tipo_compra, d.documento, d.articulos, `$${Number(d.costo_total).toLocaleString('es-MX', {minimumFractionDigits:2})}` ]);
          autoTable(doc, {
            startY: yPos, head: [['Fecha', 'Operación', 'Documento', 'Artículos / Descripción', 'Costo']], body: bodyData,
            theme: 'plain', styles: { fontSize: 8, cellPadding: 2 }, headStyles: { textColor: [100, 100, 100], fontStyle: 'bold' },
            margin: { left: 20, right: 20 }, didDrawPage: (data) => { if (data.cursor) yPos = data.cursor.y; }
          });
          yPos = (doc as any).lastAutoTable.finalY + 10;
        } else { yPos += 5; }
      });
    } else {
      const prov = this.datosReporte[0];
      doc.setTextColor(56, 189, 248); doc.text(`Proveedor: ${prov.proveedor}`, 14, yPos); yPos += 6;
      doc.setTextColor(34, 197, 94); doc.text(`Total Comprado: $${Number(prov.total_comprado).toLocaleString('es-MX', {minimumFractionDigits:2})}`, 14, yPos); yPos += 10;
      const columnas = [['Fecha', 'Tipo de Operación', 'Documento', 'Artículos / Descripción', 'Costo']];
      const filas = prov.detalles.map(d => [ new Date(d.fecha).toLocaleDateString(), d.tipo_compra, d.documento, d.articulos, `$${Number(d.costo_total).toLocaleString('es-MX', {minimumFractionDigits:2})}` ]);
      autoTable(doc, { head: columnas, body: filas, startY: yPos, headStyles: { fillColor: [41, 128, 185] } });
    }

    const filename = `Compras_Proveedor_${new Date().getTime()}.pdf`;
    addPdfFooter(doc, 'Gestión de Proveedores');
    doc.save(filename);
    this.exportNotif.showPdf(filename);
  }

  private postGuardado(mensaje: string) {
    this.mostrarNotificacion('Éxito', mensaje, 'exito');
    this.obtenerProveedores(); this.cerrarModal(); this.cerrarModalBorrar();
  }
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo }; this.mostrarModalNotificacion = true;
  }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}