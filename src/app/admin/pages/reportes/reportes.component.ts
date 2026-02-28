import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { environment } from '../../../../environments/environments';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-reportes',
  standalone: false,
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css']
})
export class ReportesComponent implements OnInit {
  
  // --- VARIABLES PRINCIPALES ---
  tipoReporteSeleccionado: string = 'stock-bajo';
  fechaInicio: string = '';
  fechaFin: string = '';

  reporteData: any[] = [];
  columnasReporte: string[] = [];
  totalGeneral: number = 0;
  isLoading = false;

  // --- VARIABLES PARA EL BUSCADOR (Historial por Refacción) ---
  itemsSeleccionados: { id: number, nombre: string, tipo: 'Refacción' | 'Insumo', marca?: string }[] = [];
  refaccionControl = new FormControl('');
  insumoControl = new FormControl('');
  filteredRefacciones$!: Observable<any[]>;
  filteredInsumos$!: Observable<any[]>;

  // --- VARIABLES PARA MODALES ---
  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  modalDetallesVisible: boolean = false;
  busSeleccionado: any = null;
  
  private apiUrl = `${environment.apiUrl}/reportes`;

  // --- CONFIGURACIÓN DE REPORTES ---
  reportesConfig: { [key: string]: { titulo: string, descripcion: string, requiereFecha: boolean, requiereListaArticulos?: boolean } } = {
    'stock-bajo': {
      titulo: 'Stock Bajo',
      descripcion: 'Refacciones e insumos con stock por debajo del mínimo',
      requiereFecha: false
    },
    'gastos-totales': {
      titulo: 'Gastos Totales por Entradas',
      descripcion: 'Resumen de todas las entradas de almacén y su costo total',
      requiereFecha: true
    },
    'menos-utilizadas': {
      titulo: 'Refacciones Menos Utilizadas',
      descripcion: 'Refacciones con menor movimiento en el periodo seleccionado',
      requiereFecha: true
    },
    'mas-utilizadas': {
      titulo: 'Refacciones Más Utilizadas',
      descripcion: 'Refacciones con mayor movimiento en el periodo seleccionado',
      requiereFecha: true
    },
    'costo-autobus': {
      titulo: 'Costo por Autobús',
      descripcion: 'Costo total de mantenimiento por unidad en el periodo seleccionado',
      requiereFecha: true
    },
    'movimientos-refaccion': {
      titulo: 'Movimientos Generales por Refacción',
      descripcion: 'Historial general de todas las refacciones que tuvieron movimiento',
      requiereFecha: true
    },
    'historial-por-refaccion': {
      titulo: 'Historial por Artículos Específicos',
      descripcion: 'Auditoría de entradas y salidas de una lista personalizada de refacciones e insumos.',
      requiereFecha: true,
      requiereListaArticulos: true // Activa los buscadores
    }
  };

  constructor(private http: HttpClient) { }

  ngOnInit() {
    // Inicializar los buscadores reactivos para el reporte específico
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

  // --- LÓGICA DE BÚSQUEDA Y SELECCIÓN ---
  private _buscarApi(tipo: 'refacciones' | 'insumos', term: any): Observable<any[]> {
    const searchTerm = typeof term === 'string' ? term : term?.nombre;
    if (!searchTerm || searchTerm.length < 2) return of([]);
    
    return this.http.get<any[]>(`${environment.apiUrl}/${tipo}/buscar`, { params: { term: searchTerm } }).pipe(
      map(res => res.map(item => ({
        id: item.id_refaccion || item.id_insumo,
        nombre: item.nombre,
        marca: item.marca || 'N/A',
        tipo: tipo === 'refacciones' ? 'Refacción' : 'Insumo'
      }))),
      catchError(() => of([]))
    );
  }

  displayFn(item: any): string {
    return item ? `${item.nombre} ${item.marca !== 'N/A' ? '('+item.marca+')' : ''}` : '';
  }

  agregarItemLista(event: MatAutocompleteSelectedEvent, tipo: 'Refacción' | 'Insumo') {
    const item = event.option.value;
    
    // Evitar agregar elementos duplicados a la lista
    const yaExiste = this.itemsSeleccionados.some(i => i.id === item.id && i.tipo === tipo);
    if (!yaExiste) {
      this.itemsSeleccionados.push(item);
    } else {
      this.mostrarNotificacion('Duplicado', `Este artículo ya está en la lista de auditoría.`, 'advertencia');
    }

    // Limpiar el input
    if (tipo === 'Refacción') this.refaccionControl.setValue('');
    else this.insumoControl.setValue('');
  }

  eliminarItemLista(index: number) {
    this.itemsSeleccionados.splice(index, 1);
  }

  // --- GETTERS (Propiedades Computadas) ---
  get tituloReporte(): string {
    return this.reportesConfig[this.tipoReporteSeleccionado]?.titulo || 'Reporte';
  }

  get descripcionReporte(): string {
    return this.reportesConfig[this.tipoReporteSeleccionado]?.descripcion || '';
  }

  get requiereFechas(): boolean {
    return this.reportesConfig[this.tipoReporteSeleccionado]?.requiereFecha || false;
  }

  get requiereListaArticulos(): boolean {
    return this.reportesConfig[this.tipoReporteSeleccionado]?.requiereListaArticulos || false;
  }

  get mostrarTotalGeneral(): boolean {
    return this.tipoReporteSeleccionado === 'gastos-totales' && this.totalGeneral > 0;
  }


  // --- GENERACIÓN DE REPORTE ---
  generarReporte() {
    if (!this.tipoReporteSeleccionado) {
      this.mostrarNotificacion('Selección Requerida', 'Por favor, selecciona un tipo de reporte.');
      return;
    }

    if (this.requiereFechas && (!this.fechaInicio || !this.fechaFin)) {
      this.mostrarNotificacion('Filtro Requerido', 'Este reporte requiere un rango de fechas.');
      return;
    }

    if (this.requiereListaArticulos && this.itemsSeleccionados.length === 0) {
      this.mostrarNotificacion('Lista Vacía', 'Busca y agrega al menos un artículo a la lista.');
      return;
    }
    
    this.isLoading = true;
    this.reporteData = [];
    this.totalGeneral = 0;
    
    let params = new HttpParams();
    if (this.fechaInicio) params = params.set('fechaInicio', this.fechaInicio);
    if (this.fechaFin) params = params.set('fechaFin', this.fechaFin);
    
    // Si es el reporte por selección, enviamos los IDs concatenados
    if (this.tipoReporteSeleccionado === 'historial-por-refaccion') {
      const idsRefacciones = this.itemsSeleccionados.filter(i => i.tipo === 'Refacción').map(i => i.id).join(',');
      const idsInsumos = this.itemsSeleccionados.filter(i => i.tipo === 'Insumo').map(i => i.id).join(',');
      
      if(idsRefacciones) params = params.set('idsRefacciones', idsRefacciones);
      if(idsInsumos) params = params.set('idsInsumos', idsInsumos);
    }

    this.http.get<any>(`${this.apiUrl}/${this.tipoReporteSeleccionado}`, { params }).subscribe({
      next: (data) => {
        // Manejo especial para gastos-totales que devuelve un objeto { entradas: [], totalGeneral: 0 }
        if (this.tipoReporteSeleccionado === 'gastos-totales') {
          this.reporteData = data.entradas || [];
          this.totalGeneral = data.totalGeneral || 0;
        } else {
          this.reporteData = Array.isArray(data) ? data : [];
          this.totalGeneral = 0;
        }

        if (this.reporteData.length > 0) {
          this.columnasReporte = Object.keys(this.reporteData[0]);
        } else {
          this.columnasReporte = [];
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.mostrarNotificacion('Error', `Error al generar el reporte: ${err.error?.message || err.message}`, 'error');
        this.isLoading = false;
      }
    });
  }

  // --- MODALES (Notificación y Detalles) ---
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }

  abrirModalDetalles(fila: any) {
    this.busSeleccionado = fila;
    
    // Sanear los detalles para el modal HTML por si vienen como string JSON
    if (typeof this.busSeleccionado.detalles === 'string') {
      try {
        this.busSeleccionado.detalles = JSON.parse(this.busSeleccionado.detalles);
      } catch (e) {
        this.busSeleccionado.detalles = [];
      }
    }
    
    // Extraer datos si vienen envueltos en 'value' (bug de json_array_elements de PostgreSQL)
    if (Array.isArray(this.busSeleccionado.detalles)) {
      this.busSeleccionado.detalles = this.busSeleccionado.detalles.map((d: any) => d.value || d);
    }

    this.modalDetallesVisible = true;
    document.body.style.overflow = 'hidden'; 
  }

  cerrarModalDetalles() {
    this.modalDetallesVisible = false;
    this.busSeleccionado = null;
    document.body.style.overflow = 'auto'; 
  }

  // --- FORMATEADORES ---
  formatearValor(valor: any, columna: string): string {
    if (columna.toLowerCase().includes('valor') || 
        columna.toLowerCase().includes('costo') || 
        columna.toLowerCase().includes('precio')) {
      const numero = parseFloat(valor);
      if (!isNaN(numero)) {
        return '$' + numero.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }
    
    if (columna.toLowerCase().includes('fecha')) {
      const fecha = new Date(valor);
      if (!isNaN(fecha.getTime())) {
        return fecha.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
      }
    }

    if (typeof valor === 'number') return valor.toLocaleString('es-MX');

    return valor || '-';
  }

  formatearColumna(columna: string): string {
    return columna.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }


  // --- MÉTODOS DE EXPORTACIÓN ---

  exportarPDF() {
    if (this.reporteData.length === 0) {
      this.mostrarNotificacion('Sin Datos', 'No hay datos para exportar.');
      return;
    }
    
    const doc = new jsPDF('landscape');
    const titulo = this.tituloReporte.toUpperCase();
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, 14, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-MX')}`, 14, 28);

    if (this.requiereFechas && this.fechaInicio && this.fechaFin) {
      doc.text(`Periodo: ${this.fechaInicio} al ${this.fechaFin}`, 14, 34);
    }

    let startY = 40;
    if (this.tipoReporteSeleccionado === 'gastos-totales' && this.totalGeneral > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(76, 175, 80);
      doc.text(`TOTAL GENERAL: $${this.totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, startY);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      startY = 48;
    }

    const columnasVisibles = this.columnasReporte.filter(col => col !== 'detalles');
    const headers = columnasVisibles.map(col => this.formatearColumna(col));
    const body: any[] = [];

    const reportesConDesglose = ['costo-autobus', 'gastos-totales', 'movimientos-refaccion', 'historial-por-refaccion'];

    this.reporteData.forEach(item => {
      const filaPrincipal = columnasVisibles.map(col => this.formatearValor(item[col], col));
      
      // Saneamiento robusto del array de detalles
      let detallesArray = [];
      try {
        detallesArray = typeof item.detalles === 'string' ? JSON.parse(item.detalles) : item.detalles;
      } catch (e) { detallesArray = []; }
      
      if (!Array.isArray(detallesArray)) detallesArray = [];

      if (reportesConDesglose.includes(this.tipoReporteSeleccionado) && detallesArray.length > 0) {
        
        const filaMaestra = filaPrincipal.map(val => ({
          content: val,
          styles: { fontStyle: 'bold', fillColor: [235, 245, 255] }
        }));
        body.push(filaMaestra);

        if (this.tipoReporteSeleccionado === 'costo-autobus') {
          body.push([
            { content: '', styles: { fillColor: [255, 255, 255] } },
            { content: 'FECHA', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } },
            { content: 'TIPO', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } },
            { content: 'ARTÍCULO', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } },
            { content: 'CANT.', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'center' } },
            { content: 'COSTO U.', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'right' } },
            { content: 'SUBTOTAL', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'right' } }
          ]);
        } else if (this.tipoReporteSeleccionado === 'gastos-totales') {
          body.push([
            { content: '', styles: { fillColor: [255, 255, 255] } }, 
            { content: 'TIPO', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } },
            { content: 'ARTÍCULO', colSpan: 2, styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } },
            { content: 'MARCA', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } },
            { content: 'CANT.', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'center' } },
            { content: 'COSTO U.', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'right' } },
            { content: 'SUBTOTAL', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'right' } }
          ]);
        } else if (this.tipoReporteSeleccionado === 'movimientos-refaccion' || this.tipoReporteSeleccionado === 'historial-por-refaccion') {
          body.push([
            { content: '', styles: { fillColor: [255, 255, 255] } }, 
            { content: 'FECHA', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } },
            { content: 'MOVIMIENTO', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } },
            { content: 'ORIGEN / DESTINO', colSpan: 2, styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } },
            { content: 'CANT.', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'center' } },
            { content: 'COSTO TOTAL', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'right' } }
          ]);
        }

        detallesArray.forEach((rawD: any) => {
          // Extraemos el objeto real, protegiendo contra nulos o envoltorios 'value'
          const d = rawD?.value || rawD; 
          if (!d || Object.keys(d).length === 0) return; 
          
          const cantidadStr = (d.cantidad !== undefined && d.cantidad !== null) ? d.cantidad.toString() : '0';
          const costoUnitario = parseFloat(d.costo_unitario) || 0;
          const costoTotal = parseFloat(d.costo_total) || 0;

          if (this.tipoReporteSeleccionado === 'costo-autobus') {
            const articuloTxt = d.marca && d.marca !== 'N/A' ? `${d.nombre} (${d.marca})` : d.nombre;
            body.push([
              { content: '', styles: { fillColor: [255, 255, 255] } }, 
              { content: new Date(d.fecha).toLocaleDateString('es-MX'), styles: { fontSize: 8, textColor: [100,100,100] } },
              { content: d.tipo_item || '-', styles: { fontSize: 8, textColor: [100,100,100] } },
              { content: articuloTxt || '-', styles: { fontSize: 8, textColor: [100,100,100] } },
              { content: cantidadStr, styles: { fontSize: 8, textColor: [100,100,100], halign: 'center' } },
              { content: `$${costoUnitario.toFixed(2)}`, styles: { fontSize: 8, textColor: [100,100,100], halign: 'right' } },
              { content: `$${costoTotal.toFixed(2)}`, styles: { fontSize: 8, textColor: [100,100,100], halign: 'right' } }
            ]);
          } else if (this.tipoReporteSeleccionado === 'gastos-totales') {
            body.push([
              { content: '', styles: { fillColor: [255, 255, 255] } }, 
              { content: d.tipo_item || '-', styles: { fontSize: 8, textColor: [100,100,100] } },
              { content: d.nombre || '-', colSpan: 2, styles: { fontSize: 8, textColor: [100,100,100] } },
              { content: d.marca || 'N/A', styles: { fontSize: 8, textColor: [100,100,100] } },
              { content: cantidadStr, styles: { fontSize: 8, textColor: [100,100,100], halign: 'center' } },
              { content: `$${costoUnitario.toFixed(2)}`, styles: { fontSize: 8, textColor: [100,100,100], halign: 'right' } },
              { content: `$${costoTotal.toFixed(2)}`, styles: { fontSize: 8, textColor: [100,100,100], halign: 'right' } }
            ]);
          } else if (this.tipoReporteSeleccionado === 'movimientos-refaccion' || this.tipoReporteSeleccionado === 'historial-por-refaccion') {
            const colorTexto = d.tipo_movimiento === 'Entrada' ? [46, 204, 113] : [231, 76, 60];
            body.push([
              { content: '', styles: { fillColor: [255, 255, 255] } }, 
              { content: new Date(d.fecha).toLocaleDateString('es-MX'), styles: { fontSize: 8, textColor: [100,100,100] } },
              { content: d.tipo_movimiento || '-', styles: { fontSize: 8, fontStyle: 'bold', textColor: colorTexto } },
              { content: d.documento || '-', colSpan: 2, styles: { fontSize: 8, textColor: [100,100,100] } },
              { content: cantidadStr, styles: { fontSize: 8, textColor: [100,100,100], halign: 'center' } },
              { content: `$${costoTotal.toFixed(2)}`, styles: { fontSize: 8, textColor: [100,100,100], halign: 'right' } }
            ]);
          }
        });

      } else {
        body.push(filaPrincipal);
      }
    });

    autoTable(doc, {
      startY: startY,
      head: [headers],
      body: body,
      headStyles: { fillColor: [68, 128, 211], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 10 }
    });

    doc.save(`Reporte_${this.tipoReporteSeleccionado}_${new Date().getTime()}.pdf`);
    this.mostrarNotificacion('Éxito', 'PDF exportado correctamente', 'exito');
  }

  exportarExcel() {
    if (this.reporteData.length === 0) {
      this.mostrarNotificacion('Sin Datos', 'No hay datos para exportar.');
      return;
    }

    const columnasVisibles = this.columnasReporte.filter(col => col !== 'detalles');
    const headers = columnasVisibles.map(col => this.formatearColumna(col));
    const datosExcel: any[][] = [];
    
    datosExcel.push(headers);

    const reportesConDesglose = ['costo-autobus', 'gastos-totales', 'movimientos-refaccion', 'historial-por-refaccion'];

    this.reporteData.forEach(fila => {
      const filaPrincipal = columnasVisibles.map(header => {
        const colOriginal = this.columnasReporte.find(c => this.formatearColumna(c) === header) || header;
        return this.formatearValor(fila[colOriginal], colOriginal);
      });
      datosExcel.push(filaPrincipal);

      // Saneamiento de array
      let detallesArray = [];
      try {
        detallesArray = typeof fila.detalles === 'string' ? JSON.parse(fila.detalles) : fila.detalles;
      } catch (e) { detallesArray = []; }

      if (!Array.isArray(detallesArray)) detallesArray = [];

      if (reportesConDesglose.includes(this.tipoReporteSeleccionado) && detallesArray.length > 0) {
        
        if (this.tipoReporteSeleccionado === 'costo-autobus') {
          datosExcel.push(['', '--> FECHA', 'TIPO', 'ARTÍCULO', 'MARCA', 'CANTIDAD', 'COSTO UNIT.', 'SUBTOTAL']);
          detallesArray.forEach((rawD: any) => {
            const d = rawD?.value || rawD;
            if (!d || Object.keys(d).length === 0) return;
            const costoUnitario = parseFloat(d.costo_unitario) || 0;
            const costoTotal = parseFloat(d.costo_total) || 0;

            datosExcel.push([
              '', 
              new Date(d.fecha).toLocaleDateString('es-MX'),
              d.tipo_item || '-',
              d.nombre || '-',
              d.marca || 'N/A',
              d.cantidad || 0,
              `$${costoUnitario.toFixed(2)}`,
              `$${costoTotal.toFixed(2)}`
            ]);
          });
        } else if (this.tipoReporteSeleccionado === 'gastos-totales') {
          datosExcel.push(['', '--> TIPO', 'ARTÍCULO', 'MARCA', 'CANTIDAD', 'COSTO UNIT.', 'SUBTOTAL']);
          detallesArray.forEach((rawD: any) => {
            const d = rawD?.value || rawD;
            if (!d || Object.keys(d).length === 0) return;
            const costoUnitario = parseFloat(d.costo_unitario) || 0;
            const costoTotal = parseFloat(d.costo_total) || 0;

            datosExcel.push([
              '', 
              d.tipo_item || '-',
              d.nombre || '-',
              d.marca || 'N/A',
              d.cantidad || 0,
              `$${costoUnitario.toFixed(2)}`,
              `$${costoTotal.toFixed(2)}`
            ]);
          });
        } else if (this.tipoReporteSeleccionado === 'movimientos-refaccion' || this.tipoReporteSeleccionado === 'historial-por-refaccion') {
          datosExcel.push(['', '--> FECHA', 'MOVIMIENTO', 'ORIGEN / DESTINO', 'CANTIDAD', 'COSTO TOTAL']);
          detallesArray.forEach((rawD: any) => {
            const d = rawD?.value || rawD;
            if (!d || Object.keys(d).length === 0) return;
            const costoTotal = parseFloat(d.costo_total) || 0;

            datosExcel.push([
              '', 
              new Date(d.fecha).toLocaleDateString('es-MX'),
              d.tipo_movimiento || '-',
              d.documento || '-',
              d.cantidad || 0,
              `$${costoTotal.toFixed(2)}`
            ]);
          });
        }
        
        datosExcel.push([]); // Espacio en blanco separador
      }
    });

    if (this.tipoReporteSeleccionado === 'gastos-totales' && this.totalGeneral > 0) {
      const filaTotales = new Array(headers.length).fill('');
      filaTotales[headers.length - 1] = `TOTAL: $${this.totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      datosExcel.push(filaTotales);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(datosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');

    const wscols = [ { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 } ];
    worksheet['!cols'] = wscols;

    const nombreArchivo = `Reporte_${this.tipoReporteSeleccionado}_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(workbook, nombreArchivo);
    this.mostrarNotificacion('Éxito', 'Excel exportado correctamente', 'exito');
  }
}