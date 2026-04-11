import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf'; 
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-servicios-externos',
  standalone: false,
  templateUrl: './servicios-externos.component.html',
  styleUrls: ['./servicios-externos.component.css']
})
export class ServiciosExternosComponent implements OnInit {
  
  // Arreglos principales de datos
  servicios: any[] = [];             
  filteredServicios: any[] = [];     
  paginatedServicios: any[] = [];    
  proveedores: any[] = []; 
  
  isLoading = false;
  modalVisible = false;

  // ==========================================
  // VARIABLES PARA FILTROS Y PAGINACIÓN
  // ==========================================
  filtroBus: string = '';
  filtroProveedor: string = '';
  filtroFechaInicio: string = '';
  filtroFechaFin: string = '';

  paginaActual: number = 1;
  itemsPorPagina: number = 10;
  totalPaginas: number = 1;

  // Autocompletar Autobús
  busControl = new FormControl<any>('');
  filteredAutobuses$!: Observable<any[]>;

  nuevoServicio: any = {
    id_autobus: null, kilometraje_autobus: null, id_proveedor: null,
    fecha_servicio: new Date().toISOString().split('T')[0],
    descripcion: '', subtotal: null, aplica_iva: false, iva_monto: 0, costo_total: 0,
    factura_nota: '', tiene_garantia: false, dias_garantia: null, fecha_vencimiento_garantia: null
  };

  mostrarModalNotificacion = false;
  notificacion = { titulo: '', mensaje: '', tipo: 'exito' as 'exito' | 'error' | 'advertencia' };

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarServicios();
    this.cargarCatalogos();

    this.filteredAutobuses$ = this.busControl.valueChanges.pipe(
      startWith(''), debounceTime(300), distinctUntilChanged(),
      switchMap(value => this._buscarAutobusApi(value || ''))
    );
  }

  private _buscarAutobusApi(term: any): Observable<any[]> {
    const searchTerm = typeof term === 'string' ? term : term?.economico;
    if (!searchTerm) { return of([]); }
    return this.http.get<any[]>(`${this.apiUrl}/autobuses/buscar`, { params: { term: searchTerm } }).pipe(
      catchError(() => of([]))
    );
  }

  displayFnBus(bus: any): string { return bus && bus.economico ? `Bus ${bus.economico}` : ''; }

  seleccionarAutobus(event: any) {
    const bus = event.option.value;
    this.nuevoServicio.id_autobus = bus.id_autobus;
    this.nuevoServicio.kilometraje_autobus = bus.kilometraje_actual || bus.kilometraje_ultima_carga || 0;
  }

  // ==========================================
  // CARGA DE DATOS Y FILTROS
  // ==========================================
  cargarServicios() {
    this.isLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/servicios-externos`).subscribe({
      next: (data) => {
        this.servicios = data;
        this.aplicarFiltros(); 
        this.isLoading = false;
      },
      error: () => {
        this.mostrarNotificacion('Error', 'No se pudieron cargar los servicios.', 'error');
        this.isLoading = false;
      }
    });
  }

  cargarCatalogos() {
    this.http.get<any[]>(`${this.apiUrl}/proveedores`).subscribe(data => this.proveedores = data);
  }

  aplicarFiltros() {
    this.filteredServicios = this.servicios.filter(servicio => {
      let matchBus = true;
      let matchProveedor = true;
      let matchFecha = true;

      if (this.filtroBus) {
        const termino = this.filtroBus.toLowerCase();
        matchBus = 
          (servicio.autobus && String(servicio.autobus).toLowerCase().includes(termino)) ||
          (servicio.descripcion && servicio.descripcion.toLowerCase().includes(termino)) ||
          (servicio.factura_nota && servicio.factura_nota.toLowerCase().includes(termino));
      }

      // 🛠️ AQUÍ ESTÁ LA MAGIA REPARADA 🛠️
      if (this.filtroProveedor) {
        // 1. Buscamos en el arreglo de 'proveedores' el nombre real usando el ID que manda el HTML
        const provSeleccionado = this.proveedores.find(p => p.id_proveedor == this.filtroProveedor);
        
        if (provSeleccionado) {
          // 2. Ahora sí, comparamos texto contra texto (ej. "Taller Juan" === "Taller Juan")
          matchProveedor = servicio.proveedor === provSeleccionado.nombre_proveedor;
        } else {
          matchProveedor = false; 
        }
      }

      if (this.filtroFechaInicio) {
        matchFecha = matchFecha && (servicio.fecha_servicio >= this.filtroFechaInicio);
      }
      if (this.filtroFechaFin) {
        matchFecha = matchFecha && (servicio.fecha_servicio <= this.filtroFechaFin);
      }

      return matchBus && matchProveedor && matchFecha;
    });

    this.totalPaginas = Math.ceil(this.filteredServicios.length / this.itemsPorPagina) || 1;
    this.paginaActual = 1;
    this.actualizarPaginacion();
  }
  limpiarFiltros() {
    this.filtroBus = ''; this.filtroProveedor = ''; this.filtroFechaInicio = ''; this.filtroFechaFin = '';
    this.aplicarFiltros();
  }

  actualizarPaginacion() {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    this.paginatedServicios = this.filteredServicios.slice(inicio, fin);
  }

  cambiarPagina(delta: number) {
    const nuevaPagina = this.paginaActual + delta;
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas) {
      this.paginaActual = nuevaPagina;
      this.actualizarPaginacion();
    }
  }

  // ==========================================
  // EXPORTACIONES (EXCEL, PDF, XML)
  // 🛠️ CORRECCIONES APLICADAS TAMBIÉN AQUÍ 🛠️
  // ==========================================
  exportarExcel() {
    const dataToExport = this.filteredServicios.map(s => ({
      'ID Servicio': s.id_servicio, // Antes: id_servicio_externo
      'Fecha': s.fecha_servicio,
      'Autobús': `Bus ${s.autobus || 'S/N'}`, // Antes: economico_autobus
      'Proveedor': s.proveedor || 'S/N', // Antes: nombre_proveedor
      'Descripción': s.descripcion,
      'Subtotal': s.subtotal,
      'IVA': s.iva_monto,
      'Total ($)': s.costo_total,
      'Factura/Nota': s.factura_nota,
      'Estatus': s.estatus
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Servicios');
    XLSX.writeFile(wb, `Reporte_Servicios_Externos_${new Date().getTime()}.xlsx`);

    this.mostrarNotificacion('Exportación Exitosa', 'El archivo Excel se ha descargado en tu equipo.', 'exito');
  }

  exportarPDF() {
    if (this.filteredServicios.length === 0) {
      this.mostrarNotificacion('Sin Datos', 'No hay servicios en la lista para exportar a PDF.', 'advertencia');
      return;
    }

    const doc = new jsPDF('landscape');
    let startY = 40;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE SERVICIOS EXTERNOS (TALLERES)', 14, 20);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-MX')}`, 14, 28);
    
    if (this.filtroFechaInicio && this.filtroFechaFin) {
      doc.text(`Periodo auditado: ${this.filtroFechaInicio} al ${this.filtroFechaFin}`, 14, 34);
    } else {
      doc.text('Periodo auditado: Histórico Completo', 14, 34);
    }

    const head = [['FECHA', 'VEHÍCULO', 'PROVEEDOR / TALLER', 'DESCRIPCIÓN DEL SERVICIO', 'FACTURA / NOTA', 'COSTO TOTAL', 'ESTATUS']];
    
    const body = this.filteredServicios.map(s => {
      let vehiculoStr = 'S/N';
      if (s.autobus) { 
        vehiculoStr = `Bus ${s.autobus}`;
      } else if (s.id_vehiculo_particular) {
        vehiculoStr = `Flota Admin.`;
      }

      return [
        new Date(s.fecha_servicio).toLocaleDateString('es-MX'),
        vehiculoStr,
        s.proveedor || 'No Especificado', // Antes: nombre_proveedor
        s.descripcion || '-',
        s.factura_nota || 'S/D',
        { 
          content: `$${Number(s.costo_total).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
          styles: { halign: 'right', fontStyle: 'bold', textColor: [34, 197, 94] }
        },
        {
          content: s.estatus,
          styles: { 
            halign: 'center', 
            fontStyle: 'bold', 
            textColor: s.estatus === 'Cancelado' ? [239, 68, 68] : [56, 189, 248]
          }
        }
      ];
    });

    autoTable(doc, {
      startY: startY,
      head: head,
      body: body,
      headStyles: { 
        fillColor: [68, 128, 211], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold', 
        fontSize: 9,
        halign: 'center'
      },
      styles: { 
        fontSize: 8, 
        cellPadding: 4,
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      },
      alternateRowStyles: { 
        fillColor: [245, 248, 250] 
      },
      margin: { top: 15 }
    });

    const timestamp = new Date().getTime();
    doc.save(`Servicios_Externos_${timestamp}.pdf`);
    
    this.mostrarNotificacion('Exportación Exitosa', 'El archivo PDF se ha descargado en tu equipo.', 'exito');
  }

  exportarXML() {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<ServiciosExternos>\n';
    this.filteredServicios.forEach(s => {
      xml += '  <Servicio>\n';
      xml += `    <ID>${s.id_servicio}</ID>\n`; // Antes: id_servicio_externo
      xml += `    <Fecha>${s.fecha_servicio}</Fecha>\n`;
      xml += `    <Autobus>${s.autobus || 'S/N'}</Autobus>\n`; // Antes: economico_autobus
      xml += `    <Proveedor>${s.proveedor || 'S/N'}</Proveedor>\n`; // Antes: nombre_proveedor
      xml += `    <Descripcion>${s.descripcion}</Descripcion>\n`;
      xml += `    <Factura>${s.factura_nota}</Factura>\n`;
      xml += `    <Total>${s.costo_total}</Total>\n`;
      xml += `    <Estatus>${s.estatus}</Estatus>\n`;
      xml += '  </Servicio>\n';
    });
    xml += '</ServiciosExternos>';

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Servicios_Externos_${new Date().getTime()}.xml`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // ==========================================
  // LÓGICA DE FORMULARIOS Y MODALES
  // ==========================================
  calcularTotales() {
    const sub = parseFloat(this.nuevoServicio.subtotal) || 0;
    this.nuevoServicio.iva_monto = this.nuevoServicio.aplica_iva ? sub * 0.16 : 0;
    this.nuevoServicio.costo_total = sub + this.nuevoServicio.iva_monto;
  }

  getEstadoGarantiaClass(servicio: any): string {
    if (servicio.estatus === 'Cancelado') return 'fila-cancelada';
    if (!servicio.tiene_garantia || !servicio.fecha_vencimiento_garantia) return '';

    const hoy = new Date(); hoy.setHours(0,0,0,0); 
    const vencimiento = new Date(servicio.fecha_vencimiento_garantia);
    vencimiento.setMinutes(vencimiento.getMinutes() + vencimiento.getTimezoneOffset());
    vencimiento.setHours(0,0,0,0);

    const diffDays = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'garantia-vencida';
    if (diffDays <= 15) return 'garantia-por-vencer';
    return 'garantia-activa';
  }

  abrirModal() {
    this.busControl.setValue('');
    this.nuevoServicio = {
      id_autobus: null, kilometraje_autobus: null, id_proveedor: null,
      fecha_servicio: new Date().toISOString().split('T')[0],
      descripcion: '', subtotal: null, aplica_iva: false, iva_monto: 0, costo_total: 0,
      factura_nota: '', tiene_garantia: false, dias_garantia: null, fecha_vencimiento_garantia: null
    };
    this.modalVisible = true; document.body.style.overflow = 'hidden';
  }

  cerrarModal() { this.modalVisible = false; document.body.style.overflow = 'auto'; }

  guardarServicio() {
    if (!this.nuevoServicio.id_autobus || !this.nuevoServicio.descripcion || !this.nuevoServicio.subtotal) {
      this.mostrarNotificacion('Campos incompletos', 'Selecciona autobús, descripción y subtotal.', 'advertencia'); return;
    }
    if (this.nuevoServicio.tiene_garantia && !this.nuevoServicio.fecha_vencimiento_garantia) {
      this.mostrarNotificacion('Garantía', 'Establece la fecha de vencimiento.', 'advertencia'); return;
    }

    this.http.post(`${this.apiUrl}/servicios-externos`, this.nuevoServicio).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Servicio registrado correctamente.', 'exito');
        this.cerrarModal(); this.cargarServicios();
      },
      error: () => this.mostrarNotificacion('Error', 'Error al guardar.', 'error')
    });
  }

  cancelarServicio(id: number) {
    if (confirm('¿Estás seguro de cancelar este servicio?')) {
      this.http.put(`${this.apiUrl}/servicios-externos/${id}/cancelar`, {}).subscribe({
        next: () => { this.mostrarNotificacion('Cancelado', 'El servicio fue cancelado.', 'exito'); this.cargarServicios(); },
        error: () => this.mostrarNotificacion('Error', 'No se pudo cancelar.', 'error')
      });
    }
  }

  calcularFechaGarantia() {
    if (this.nuevoServicio.tiene_garantia && this.nuevoServicio.dias_garantia > 0 && this.nuevoServicio.fecha_servicio) {
      const [year, month, day] = this.nuevoServicio.fecha_servicio.split('-');
      const fecha = new Date(Number(year), Number(month) - 1, Number(day));
      fecha.setDate(fecha.getDate() + this.nuevoServicio.dias_garantia);
      
      const y = fecha.getFullYear();
      const m = String(fecha.getMonth() + 1).padStart(2, '0');
      const d = String(fecha.getDate()).padStart(2, '0');
      
      this.nuevoServicio.fecha_vencimiento_garantia = `${y}-${m}-${d}`;
    } else {
      this.nuevoServicio.fecha_vencimiento_garantia = null;
    }
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo }; this.mostrarModalNotificacion = true;
  }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}