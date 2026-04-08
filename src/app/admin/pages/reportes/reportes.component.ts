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
  
  tipoReporteSeleccionado: string = 'stock-bajo';
  fechaInicio: string = '';
  fechaFin: string = '';

  // Variables Reporte Categoría
  categoriasDisponibles: string[] = [];
  categoriaSeleccionada: string = '';
  fechaInicioCat: string = '';
  fechaFinCat: string = '';
  movimientosCategoria: any[] = [];
  isLoadingReporteCat = false;

  reporteData: any[] = [];
  columnasReporte: string[] = [];
  totalGeneral: number = 0;
  isLoading = false;

  itemsSeleccionados: { id: number, nombre: string, tipo: 'Refacción' | 'Insumo', marca?: string }[] = [];
  refaccionControl = new FormControl('');
  insumoControl = new FormControl('');
  filteredRefacciones$!: Observable<any[]>;
  filteredInsumos$!: Observable<any[]>;

  busesSeleccionados: { id: number, economico: string }[] = [];
  busReporteControl = new FormControl<string | any>('');
  filteredBusesReporte$!: Observable<any[]>;

  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' | 'descargando' };

  modalDetallesVisible: boolean = false;
  busSeleccionado: any = null;
  
  private apiUrl = `${environment.apiUrl}/reportes`;

  // --- CONFIGURACIÓN DE REPORTES (ACTUALIZADO CON NUEVAS FUNCIONES) ---
  reportesConfig: { [key: string]: { titulo: string, descripcion: string, requiereFecha: boolean, requiereListaArticulos?: boolean, requiereListaBuses?: boolean } } = {
    'stock-bajo': { titulo: 'Stock Bajo', descripcion: 'Refacciones e insumos con stock por debajo del mínimo', requiereFecha: false },
    'gastos-totales': { titulo: 'Gastos Totales de Almacén y Servicios', descripcion: 'Resumen de compras de refacciones, insumos y facturación de talleres o servicios externos.', requiereFecha: true },
    'compras-razon-social': { titulo: 'Compras por Razón Social', descripcion: 'Total de compras y facturas agrupadas por la empresa que facturó.', requiereFecha: true },
    'gastos-razon-social': { titulo: 'Gastos por Razón Social / Flota', descripcion: 'Total de salidas y servicios agrupados por Razón Social o Flota Administrativa.', requiereFecha: true },
    'menos-utilizadas': { titulo: 'Refacciones Menos Utilizadas', descripcion: 'Refacciones con menor movimiento en el periodo seleccionado', requiereFecha: true },
    'mas-utilizadas': { titulo: 'Refacciones Más Utilizadas', descripcion: 'Refacciones con mayor movimiento en el periodo seleccionado', requiereFecha: true },
    'costo-autobus': { titulo: 'Costo por Vehículo (General)', descripcion: 'Costo de mantenimiento, servicios y cascos por Autobús o Vehículo Administrativo.', requiereFecha: true },
    'movimientos-refaccion': { titulo: 'Movimientos Generales por Refacción', descripcion: 'Historial de entradas y salidas de refacciones.', requiereFecha: true },
    'historial-por-refaccion': { titulo: 'Historial por Artículos Específicos', descripcion: 'Auditoría de entradas y salidas de una lista personalizada de ítems.', requiereFecha: true, requiereListaArticulos: true },
    'costo-por-autobus-especifico': { titulo: 'Costo por Vehículo Específico', descripcion: 'Desglose de gastos de mantenimiento de la lista de vehículos seleccionados.', requiereFecha: true, requiereListaBuses: true }
  };

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.cargarCategorias();

    this.filteredRefacciones$ = this.refaccionControl.valueChanges.pipe(
      startWith(''), debounceTime(400), distinctUntilChanged(),
      switchMap(value => this._buscarApi('refacciones', value || ''))
    );
    
    this.filteredInsumos$ = this.insumoControl.valueChanges.pipe(
      startWith(''), debounceTime(400), distinctUntilChanged(),
      switchMap(value => this._buscarApi('insumos', value || ''))
    );

    this.filteredBusesReporte$ = this.busReporteControl.valueChanges.pipe(
      startWith(''), debounceTime(400), distinctUntilChanged(),
      switchMap(value => {
        const term = typeof value === 'string' ? value : value?.economico;
        if (!term) return of([]);
        return this.http.get<any[]>(`${environment.apiUrl}/autobuses/buscar`, { params: { term } }).pipe(catchError(() => of([])));
      })
    );
  }

  cargarCategorias() {
    this.http.get<string[]>(`${this.apiUrl}/categorias-disponibles`).subscribe({
      next: (data) => this.categoriasDisponibles = data,
      error: (err) => console.error('Error cargando categorías', err)
    });
    const hoy = new Date();
    this.fechaInicioCat = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    this.fechaFinCat = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  generarReporteCategoria() {
    if (!this.categoriaSeleccionada || !this.fechaInicioCat || !this.fechaFinCat) {
      this.mostrarNotificacion('Faltan Datos', 'Asegúrate de seleccionar una categoría y el rango de fechas.', 'advertencia');
      return;
    }
    this.isLoadingReporteCat = true;
    let params = new HttpParams().set('categoria', this.categoriaSeleccionada).set('fechaInicio', this.fechaInicioCat).set('fechaFin', this.fechaFinCat);

    this.http.get<any[]>(`${this.apiUrl}/movimientos-categoria`, { params }).subscribe({
      next: (data) => { this.movimientosCategoria = data; this.isLoadingReporteCat = false; },
      error: (err) => { this.mostrarNotificacion('Error', 'No se pudo generar el reporte por categoría.', 'error'); this.isLoadingReporteCat = false; }
    });
  }

  get totalGastadoCategoria() { return this.movimientosCategoria.filter(m => m.tipo_movimiento === 'Salida').reduce((acc, val) => acc + Number(val.costo_total || 0), 0); }
  get totalInvertidoCategoria() { return this.movimientosCategoria.filter(m => m.tipo_movimiento === 'Entrada').reduce((acc, val) => acc + Number(val.costo_total || 0), 0); }

  private _buscarApi(tipo: 'refacciones' | 'insumos', term: any): Observable<any[]> {
    const searchTerm = typeof term === 'string' ? term : term?.nombre;
    if (!searchTerm || searchTerm.length < 2) return of([]);
    return this.http.get<any[]>(`${environment.apiUrl}/${tipo}/buscar`, { params: { term: searchTerm } }).pipe(
      map(res => res.map(item => ({ id: item.id_refaccion || item.id_insumo, nombre: item.nombre, marca: item.marca || 'N/A', tipo: tipo === 'refacciones' ? 'Refacción' : 'Insumo' }))),
      catchError(() => of([]))
    );
  }

  displayFn(item: any): string { return item ? `${item.nombre} ${item.marca !== 'N/A' ? '('+item.marca+')' : ''}` : ''; }
  displayFnBusRep(bus: any): string { return bus && bus.economico ? `Bus ${bus.economico}` : ''; }

  agregarBusLista(event: any) {
    const bus = event.option.value;
    const yaExiste = this.busesSeleccionados.some(b => b.id === bus.id_autobus);
    if (!yaExiste) this.busesSeleccionados.push({ id: bus.id_autobus, economico: bus.economico });
    else this.mostrarNotificacion('Duplicado', 'Este autobús ya está en la lista.', 'advertencia');
    this.busReporteControl.setValue('');
  }
  eliminarBusLista(index: number) { this.busesSeleccionados.splice(index, 1); }

  agregarItemLista(event: MatAutocompleteSelectedEvent, tipo: 'Refacción' | 'Insumo') {
    const item = event.option.value;
    const yaExiste = this.itemsSeleccionados.some(i => i.id === item.id && i.tipo === tipo);
    if (!yaExiste) this.itemsSeleccionados.push(item);
    else this.mostrarNotificacion('Duplicado', `Este artículo ya está en la lista de auditoría.`, 'advertencia');
    if (tipo === 'Refacción') this.refaccionControl.setValue(''); else this.insumoControl.setValue('');
  }
  eliminarItemLista(index: number) { this.itemsSeleccionados.splice(index, 1); }

  get tituloReporte(): string { return this.reportesConfig[this.tipoReporteSeleccionado]?.titulo || 'Reporte'; }
  get descripcionReporte(): string { return this.reportesConfig[this.tipoReporteSeleccionado]?.descripcion || ''; }
  get requiereFechas(): boolean { return this.reportesConfig[this.tipoReporteSeleccionado]?.requiereFecha || false; }
  get requiereListaArticulos(): boolean { return this.reportesConfig[this.tipoReporteSeleccionado]?.requiereListaArticulos || false; }
  get requiereListaBuses(): boolean { return this.reportesConfig[this.tipoReporteSeleccionado]?.requiereListaBuses || false; }
  get mostrarTotalGeneral(): boolean { return this.tipoReporteSeleccionado === 'gastos-totales' && this.totalGeneral > 0; }

  generarReporte() {
    if (!this.tipoReporteSeleccionado) { this.mostrarNotificacion('Selección Requerida', 'Por favor, selecciona un tipo de reporte.'); return; }
    if (this.requiereFechas && (!this.fechaInicio || !this.fechaFin)) { this.mostrarNotificacion('Filtro Requerido', 'Este reporte requiere un rango de fechas.'); return; }
    if (this.requiereListaArticulos && this.itemsSeleccionados.length === 0) { this.mostrarNotificacion('Lista Vacía', 'Busca y agrega al menos un artículo a la lista.'); return; }
    if (this.requiereListaBuses && this.busesSeleccionados.length === 0) { this.mostrarNotificacion('Lista Vacía', 'Agrega al menos un vehículo a la lista.'); return; }
    
    this.isLoading = true; this.reporteData = []; this.totalGeneral = 0;
    
    let params = new HttpParams();
    if (this.fechaInicio) params = params.set('fechaInicio', this.fechaInicio);
    if (this.fechaFin) params = params.set('fechaFin', this.fechaFin);
    
    if (this.tipoReporteSeleccionado === 'historial-por-refaccion') {
      const idsRefacciones = this.itemsSeleccionados.filter(i => i.tipo === 'Refacción').map(i => i.id).join(',');
      const idsInsumos = this.itemsSeleccionados.filter(i => i.tipo === 'Insumo').map(i => i.id).join(',');
      if(idsRefacciones) params = params.set('idsRefacciones', idsRefacciones);
      if(idsInsumos) params = params.set('idsInsumos', idsInsumos);
    }
    if (this.tipoReporteSeleccionado === 'costo-por-autobus-especifico') {
      params = params.set('idsAutobuses', this.busesSeleccionados.map(b => b.id).join(','));
    }

    this.http.get<any>(`${this.apiUrl}/${this.tipoReporteSeleccionado}`, { params }).subscribe({
      next: (data) => {
        if (this.tipoReporteSeleccionado === 'gastos-totales') {
          this.reporteData = data.entradas || [];
          this.totalGeneral = data.totalGeneral || 0;
        } else {
          this.reporteData = Array.isArray(data) ? data : [];
        }
        this.columnasReporte = this.reporteData.length > 0 ? Object.keys(this.reporteData[0]) : [];
        this.isLoading = false;
      },
      error: (err) => {
        this.mostrarNotificacion('Error', `Error al generar el reporte: ${err.error?.message || err.message}`, 'error');
        this.isLoading = false;
      }
    });
  }

  limpiarFiltros() {
    this.tipoReporteSeleccionado = ''; this.fechaInicio = ''; this.fechaFin = '';
    this.itemsSeleccionados = []; this.busesSeleccionados = [];
    this.refaccionControl.setValue(''); this.insumoControl.setValue(''); this.busReporteControl.setValue('');
    this.reporteData = []; this.columnasReporte = []; this.totalGeneral = 0;
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' | 'descargando' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo }; 
    this.mostrarModalNotificacion = true;
  }
  iniciarDescargaAnimada(tipoExportacion: 'pdf' | 'excel') {
    if (this.reporteData.length === 0 && this.movimientosCategoria.length === 0) { 
      this.mostrarNotificacion('Sin Datos', 'No hay datos para exportar.', 'advertencia'); return; 
    }
    this.mostrarNotificacion('Procesando', 'Generando tu reporte, por favor espera...', 'descargando');
    setTimeout(() => {
      try {
        if (tipoExportacion === 'pdf') this.exportarPDF(); else this.exportarExcel();
      } catch (error) { this.mostrarNotificacion('Error', 'Hubo un problema al exportar el archivo.', 'error'); }
    }, 800);
  }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }

  abrirModalDetalles(fila: any) {
    this.busSeleccionado = fila;
    if (typeof this.busSeleccionado.detalles === 'string') { try { this.busSeleccionado.detalles = JSON.parse(this.busSeleccionado.detalles); } catch (e) { this.busSeleccionado.detalles = []; } }
    if (Array.isArray(this.busSeleccionado.detalles)) this.busSeleccionado.detalles = this.busSeleccionado.detalles.map((d: any) => d.value || d);
    this.modalDetallesVisible = true; document.body.style.overflow = 'hidden'; 
  }
  cerrarModalDetalles() { this.modalDetallesVisible = false; this.busSeleccionado = null; document.body.style.overflow = 'auto'; }

  formatearValor(valor: any, columna: string): string {
    if (columna.toLowerCase().includes('valor') || columna.toLowerCase().includes('costo') || columna.toLowerCase().includes('precio')) {
      const numero = parseFloat(valor); if (!isNaN(numero)) return '$' + numero.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (columna.toLowerCase().includes('fecha')) {
      const fecha = new Date(valor); if (!isNaN(fecha.getTime())) return fecha.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    if (typeof valor === 'number') return valor.toLocaleString('es-MX');
    return valor || '-';
  }
  formatearColumna(columna: string): string { return columna.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); }

  // ==========================================
  // EXPORTACIONES A PDF / EXCEL
  // ==========================================
  exportarPDF() {
    const isCategoria = this.tipoReporteSeleccionado === 'movimientos-categoria';
    const dataToExport = isCategoria ? this.movimientosCategoria : this.reporteData;

    if (dataToExport.length === 0) { this.mostrarNotificacion('Sin Datos', 'No hay datos para exportar.'); return; }
    
    const doc = new jsPDF('landscape');
    let startY = 40;

    if (isCategoria) {
      doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(`REPORTE DE MOVIMIENTOS: ${this.categoriaSeleccionada.toUpperCase()}`, 14, 20);
      doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-MX')}`, 14, 28);
      doc.text(`Periodo: ${this.fechaInicioCat} al ${this.fechaFinCat}`, 14, 34);

      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(239, 68, 68);
      doc.text(`Gasto en Salidas: $${this.totalGastadoCategoria.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, startY);
      
      startY += 8; doc.setTextColor(34, 197, 94);
      doc.text(`Inversión en Entradas:$${this.totalInvertidoCategoria.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, startY);
      
      doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); startY += 10;
      const headersCat = [['FECHA', 'MOVIMIENTO', 'ARTÍCULO', 'CANTIDAD', 'DESTINO / ORIGEN', 'COSTO IMPLICADO']];
      const bodyCat = this.movimientosCategoria.map(m => [
        new Date(m.fecha).toLocaleDateString('es-MX'), m.tipo_movimiento, `${m.articulo}\n(${m.tipo_item} | No. Parte: ${m.numero_parte || 'N/A'})`,
        m.tipo_movimiento === 'Entrada' ? `+${m.cantidad}` : `-${m.cantidad}`, m.destino_origen || 'No Especificado', `$${parseFloat(m.costo_total || 0).toLocaleString('es-MX', {minimumFractionDigits:2})}`
      ]);
      autoTable(doc, { startY: startY, head: headersCat, body: bodyCat, headStyles: { fillColor: [68, 128, 211], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 }, styles: { fontSize: 8, cellPadding: 3 }, margin: { top: 10 } });
      doc.save(`Reporte_Categoria_${this.categoriaSeleccionada}_${new Date().getTime()}.pdf`);
      this.mostrarNotificacion('Éxito', 'PDF exportado correctamente.', 'exito');
      return;
    }

    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(this.tituloReporte.toUpperCase(), 14, 20);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-MX')}`, 14, 28);
    if (this.requiereFechas && this.fechaInicio && this.fechaFin) doc.text(`Periodo: ${this.fechaInicio} al ${this.fechaFin}`, 14, 34);

    // Ajuste "Flota Administrativa" para reporte de Costos
    if (this.tipoReporteSeleccionado === 'costo-autobus' || this.tipoReporteSeleccionado === 'costo-por-autobus-especifico') {
      const bodyBus: any[] = [];
      this.reporteData.forEach(item => {
        const marcaModelo = `${item.marca || item.marca_autobus || ''} ${item.modelo || item.anio || item.modelo_autobus || ''}`.trim();
        const esParticular = item.autobus === 'Flota Admin' || !item.autobus;
        const tituloBus = (esParticular ? 'FLOTA ADMINISTRATIVA' : `BUS ${item.autobus}`) + ` | Empresa: ${item.razon_social || 'S/D'}` + (marcaModelo ? ` (${marcaModelo})` : '');
        bodyBus.push([
          { content: item.id_autobus || '-', styles: { fontStyle: 'bold', fillColor: [220, 235, 255] } },
          { content: tituloBus, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [220, 235, 255] } }, 
          { content: `$${parseFloat(item.costo_total_mantenimiento).toLocaleString('es-MX', {minimumFractionDigits:2})}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [220, 235, 255], textColor: [0, 100, 0] } }
        ]);

        let detallesArray = [];
        try { detallesArray = typeof item.detalles === 'string' ? JSON.parse(item.detalles) : item.detalles; } catch (e) {}
        if (!Array.isArray(detallesArray)) detallesArray = [];

        detallesArray.forEach((rawD: any) => {
          const d = rawD?.value || rawD; if (!d) return;
          bodyBus.push(['', new Date(d.fecha).toLocaleDateString('es-MX'), d.tipo_item || '-', d.nombre || '-', (d.marca && d.marca !== 'N/A') ? d.marca : '-', { content: d.cantidad || '1', halign: 'center' }, { content: `$${parseFloat(d.costo_total).toLocaleString('es-MX', {minimumFractionDigits:2})}`, halign: 'right' }]);
        });
      });
      autoTable(doc, { startY: startY, head: [['ID', 'FECHA / VEHÍCULO', 'TIPO', 'ARTÍCULO / DESC.', 'MARCA / PROV.', 'CANT.', 'SUBTOTAL']], body: bodyBus, headStyles: { fillColor: [68, 128, 211], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 }, styles: { fontSize: 8, cellPadding: 3 }, margin: { top: 10 } });
      doc.save(`Reporte_Vehiculos_${new Date().getTime()}.pdf`);
      this.mostrarNotificacion('Éxito', 'PDF exportado correctamente.', 'exito');
      return; 
    }

    if (this.tipoReporteSeleccionado === 'compras-razon-social' || this.tipoReporteSeleccionado === 'gastos-razon-social') {
      const isCompras = this.tipoReporteSeleccionado === 'compras-razon-social';
      const customHeaders = isCompras ? ['FECHA / RAZÓN SOCIAL', 'DOCUMENTO / FACT.', 'PROVEEDOR', 'SUBTOTAL'] : ['FECHA / RAZÓN SOCIAL', 'VEHÍCULO / ORIGEN', 'TIPO / DESC.', 'SUBTOTAL'];
      const bodyRS: any[] = [];
      
      this.reporteData.forEach(item => {
        bodyRS.push([
          { content: item.razon_social, colSpan: 3, styles: { fontStyle: 'bold', fillColor: [220, 235, 255] } },
          { content: `$${parseFloat(item.costo_total_general).toLocaleString('es-MX', {minimumFractionDigits:2})}`, styles: { fontStyle: 'bold', halign: 'right', fillColor: [220, 235, 255], textColor: [0, 100, 0] } }
        ]);
        
        let detallesArray = [];
        try { detallesArray = typeof item.detalles === 'string' ? JSON.parse(item.detalles) : item.detalles; } catch (e) {}
        if (!Array.isArray(detallesArray)) detallesArray = [];

        detallesArray.forEach((rawD: any) => {
          const d = rawD?.value || rawD; if (!d) return;
          if (isCompras) {
            bodyRS.push(['', new Date(d.fecha).toLocaleDateString('es-MX'), d.documento || '-', d.proveedor || '-', { content: `$${parseFloat(d.costo_total).toLocaleString('es-MX', {minimumFractionDigits:2})}`, halign: 'right' }]);
          } else {
            // Ajuste "Flota Administrativa" para reporte de Gastos
            const vehiculoText = d.autobus === 'Flota Admin' || !d.autobus ? 'Flota Admin' : `BUS ${d.autobus}`;
            bodyRS.push(['', new Date(d.fecha).toLocaleDateString('es-MX'), vehiculoText, `${d.tipo}: ${d.descripcion}`, { content: `$${parseFloat(d.costo_total).toLocaleString('es-MX', {minimumFractionDigits:2})}`, halign: 'right' }]);
          }
        });
      });
      autoTable(doc, { startY: startY, head: [customHeaders], body: bodyRS, headStyles: { fillColor: [68, 128, 211], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 }, styles: { fontSize: 8, cellPadding: 3 }, margin: { top: 10 } });
      doc.save(`Reporte_RazonSocial_${new Date().getTime()}.pdf`);
      this.mostrarNotificacion('Éxito', 'PDF exportado correctamente.', 'exito');
      return;
    }

    if (this.tipoReporteSeleccionado === 'gastos-totales' && this.totalGeneral > 0) {
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(76, 175, 80);
      doc.text(`TOTAL GENERAL: $${this.totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, startY);
      doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); startY = 48;
    }

    const columnasVisibles = this.columnasReporte.filter(col => col !== 'detalles');
    const headers = columnasVisibles.map(col => this.formatearColumna(col));
    const body: any[] = [];
    const reportesConDesglose = ['gastos-totales', 'movimientos-refaccion', 'historial-por-refaccion'];

    this.reporteData.forEach(item => {
      const filaPrincipal = columnasVisibles.map(col => this.formatearValor(item[col], col));
      let detallesArray = [];
      try { detallesArray = typeof item.detalles === 'string' ? JSON.parse(item.detalles) : item.detalles; } catch (e) {}
      if (!Array.isArray(detallesArray)) detallesArray = [];

      if (reportesConDesglose.includes(this.tipoReporteSeleccionado) && detallesArray.length > 0) {
        body.push(filaPrincipal.map(val => ({ content: val, styles: { fontStyle: 'bold', fillColor: [235, 245, 255] } })));
        
        if (this.tipoReporteSeleccionado === 'gastos-totales') {
          body.push([{ content: '', styles: { fillColor: [255, 255, 255] } }, { content: 'TIPO', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } }, { content: 'ARTÍCULO / SERVICIO', colSpan: 2, styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } }, { content: 'PROV. / MARCA', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } }, { content: 'CANT.', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'center' } }, { content: 'COSTO U.', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'right' } }, { content: 'SUBTOTAL', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'right' } }]);
        } else {
          body.push([{ content: '', styles: { fillColor: [255, 255, 255] } }, { content: 'FECHA', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } }, { content: 'MOVIMIENTO', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } }, { content: 'ORIGEN / DESTINO', colSpan: 2, styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } }, { content: 'CANT.', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'center' } }, { content: 'COSTO TOTAL', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'right' } }]);
        }

        detallesArray.forEach((rawD: any) => {
          const d = rawD?.value || rawD; if (!d || Object.keys(d).length === 0) return; 
          const cantidadStr = (d.cantidad !== undefined && d.cantidad !== null) ? d.cantidad.toString() : '0';
          const costoUnitario = parseFloat(d.costo_unitario) || 0;
          const costoTotal = parseFloat(d.costo_total) || 0;

          if (this.tipoReporteSeleccionado === 'gastos-totales') {
            body.push([{ content: '', styles: { fillColor: [255, 255, 255] } }, { content: d.tipo_item || '-', styles: { fontSize: 8, textColor: [100,100,100] } }, { content: d.nombre || '-', colSpan: 2, styles: { fontSize: 8, textColor: [100,100,100] } }, { content: d.marca || 'N/A', styles: { fontSize: 8, textColor: [100,100,100] } }, { content: cantidadStr, styles: { fontSize: 8, textColor: [100,100,100], halign: 'center' } }, { content: `$${costoUnitario.toFixed(2)}`, styles: { fontSize: 8, textColor: [100,100,100], halign: 'right' } }, { content: `$${costoTotal.toFixed(2)}`, styles: { fontSize: 8, textColor: [100,100,100], halign: 'right' } }]);
          } else {
            const colorTexto = d.tipo_movimiento === 'Entrada' ? [46, 204, 113] : [231, 76, 60];
            body.push([{ content: '', styles: { fillColor: [255, 255, 255] } }, { content: new Date(d.fecha).toLocaleDateString('es-MX'), styles: { fontSize: 8, textColor: [100,100,100] } }, { content: d.tipo_movimiento || '-', styles: { fontSize: 8, fontStyle: 'bold', textColor: colorTexto } }, { content: d.documento || '-', colSpan: 2, styles: { fontSize: 8, textColor: [100,100,100] } }, { content: cantidadStr, styles: { fontSize: 8, textColor: [100,100,100], halign: 'center' } }, { content: `$${costoTotal.toFixed(2)}`, styles: { fontSize: 8, textColor: [100,100,100], halign: 'right' } }]);
          }
        });
      } else { body.push(filaPrincipal); }
    });

    autoTable(doc, { startY: startY, head: [headers], body: body, headStyles: { fillColor: [68, 128, 211], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 }, styles: { fontSize: 9, cellPadding: 3 }, alternateRowStyles: { fillColor: [245, 245, 245] }, margin: { top: 10 } });
    doc.save(`Reporte_${this.tipoReporteSeleccionado}_${new Date().getTime()}.pdf`);
    this.mostrarNotificacion('Éxito', 'PDF exportado correctamente', 'exito');
  }

  exportarExcel() {
    const isCategoria = this.tipoReporteSeleccionado === 'movimientos-categoria';
    const dataToExport = isCategoria ? this.movimientosCategoria : this.reporteData;

    if (dataToExport.length === 0) { this.mostrarNotificacion('Sin Datos', 'No hay datos para exportar.'); return; }

    if (isCategoria) {
      const datosExcelCat: any[][] = [];
      datosExcelCat.push([`REPORTE DE MOVIMIENTOS: ${this.categoriaSeleccionada.toUpperCase()}`]);
      datosExcelCat.push([`Periodo: ${this.fechaInicioCat} al ${this.fechaFinCat}`]);
      datosExcelCat.push([`Gasto en Salidas: $${this.totalGastadoCategoria.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
      datosExcelCat.push([`Inversión en Entradas:$${this.totalInvertidoCategoria.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
      datosExcelCat.push([]);

      datosExcelCat.push(['FECHA', 'MOVIMIENTO', 'TIPO ITEM', 'ARTÍCULO', 'NO. PARTE', 'CANTIDAD', 'DESTINO / ORIGEN', 'COSTO IMPLICADO']);
      this.movimientosCategoria.forEach(m => {
        datosExcelCat.push([new Date(m.fecha).toLocaleDateString('es-MX'), m.tipo_movimiento, m.tipo_item, m.articulo, m.numero_parte || 'N/A', m.tipo_movimiento === 'Entrada' ? m.cantidad : -m.cantidad, m.destino_origen || 'No Especificado', `$${parseFloat(m.costo_total || 0).toLocaleString('es-MX', {minimumFractionDigits:2})}`]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(datosExcelCat);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Categoría');
      worksheet['!cols'] = [ { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 25 }, { wch: 15 } ];
      XLSX.writeFile(workbook, `Reporte_Categoria_${this.categoriaSeleccionada}_${new Date().getTime()}.xlsx`);
      this.mostrarNotificacion('Éxito', 'Excel exportado correctamente', 'exito');
      return;
    }

    const columnasVisibles = this.columnasReporte.filter(col => col !== 'detalles');
    const headers = columnasVisibles.map(col => this.formatearColumna(col));
    const datosExcel: any[][] = [];
    datosExcel.push(headers);

    const reportesConDesglose = ['costo-autobus', 'costo-por-autobus-especifico', 'gastos-totales', 'movimientos-refaccion', 'historial-por-refaccion', 'compras-razon-social', 'gastos-razon-social'];

    this.reporteData.forEach(fila => {
      const filaPrincipal = columnasVisibles.map(header => {
        const colOriginal = this.columnasReporte.find(c => this.formatearColumna(c) === header) || header;
        return this.formatearValor(fila[colOriginal], colOriginal);
      });
      datosExcel.push(filaPrincipal);

      let detallesArray = [];
      try { detallesArray = typeof fila.detalles === 'string' ? JSON.parse(fila.detalles) : fila.detalles; } catch (e) {}
      if (!Array.isArray(detallesArray)) detallesArray = [];

      if (reportesConDesglose.includes(this.tipoReporteSeleccionado) && detallesArray.length > 0) {
        
        if (this.tipoReporteSeleccionado === 'costo-autobus' || this.tipoReporteSeleccionado === 'costo-por-autobus-especifico') {
          const marcaModelo = `${fila.marca || fila.marca_autobus || ''} ${fila.modelo || fila.anio || fila.modelo_autobus || ''}`.trim();
          const vehiculoTitulo = fila.autobus === 'Flota Admin' || !fila.autobus ? 'Flota Administrativa' : `Autobús: ${fila.autobus}`;
          datosExcel.push(['', `${vehiculoTitulo} | Empresa: ${fila.razon_social || 'S/D'}`, `Marca/Mod: ${marcaModelo}`, '', '', '', '', '']);
          datosExcel.push(['', '--> FECHA', 'TIPO', 'ARTÍCULO / DESCRIPCIÓN', 'MARCA / PROVEEDOR', 'CANTIDAD', 'COSTO UNIT.', 'SUBTOTAL']);
          detallesArray.forEach((rawD: any) => {
            const d = rawD?.value || rawD; if (!d || Object.keys(d).length === 0) return;
            datosExcel.push(['', new Date(d.fecha).toLocaleDateString('es-MX'), d.tipo_item || '-', d.nombre || '-', d.marca || 'N/A', d.cantidad || 0, `$${(parseFloat(d.costo_unitario) || 0).toFixed(2)}`, `$${(parseFloat(d.costo_total) || 0).toFixed(2)}`]);
          });
        } else if (this.tipoReporteSeleccionado === 'compras-razon-social') {
          datosExcel.push(['', '--> FECHA', 'DOCUMENTO', 'PROVEEDOR', 'SUBTOTAL']);
          detallesArray.forEach((rawD: any) => {
            const d = rawD?.value || rawD; if (!d || Object.keys(d).length === 0) return;
            datosExcel.push(['', new Date(d.fecha).toLocaleDateString('es-MX'), d.documento || '-', d.proveedor || '-', `$${(parseFloat(d.costo_total) || 0).toFixed(2)}`]);
          });
        } else if (this.tipoReporteSeleccionado === 'gastos-razon-social') {
          datosExcel.push(['', '--> FECHA', 'VEHÍCULO', 'TIPO', 'DESCRIPCIÓN', 'SUBTOTAL']);
          detallesArray.forEach((rawD: any) => {
            const d = rawD?.value || rawD; if (!d || Object.keys(d).length === 0) return;
            const vehiculoText = d.autobus === 'Flota Admin' || !d.autobus ? 'Flota Admin' : `BUS ${d.autobus}`;
            datosExcel.push(['', new Date(d.fecha).toLocaleDateString('es-MX'), vehiculoText, d.tipo || '-', d.descripcion || '-', `$${(parseFloat(d.costo_total) || 0).toFixed(2)}`]);
          });
        } else if (this.tipoReporteSeleccionado === 'gastos-totales') {
          datosExcel.push(['', '--> TIPO', 'ARTÍCULO / SERVICIO', 'PROV. / MARCA', 'CANTIDAD', 'COSTO UNIT.', 'SUBTOTAL']);
          detallesArray.forEach((rawD: any) => {
            const d = rawD?.value || rawD; if (!d || Object.keys(d).length === 0) return;
            datosExcel.push(['', d.tipo_item || '-', d.nombre || '-', d.marca || 'N/A', d.cantidad || 0, `$${(parseFloat(d.costo_unitario) || 0).toFixed(2)}`, `$${(parseFloat(d.costo_total) || 0).toFixed(2)}`]);
          });
        } else if (this.tipoReporteSeleccionado === 'movimientos-refaccion' || this.tipoReporteSeleccionado === 'historial-por-refaccion') {
          datosExcel.push(['', '--> FECHA', 'MOVIMIENTO', 'ORIGEN / DESTINO', 'CANTIDAD', 'COSTO TOTAL']);
          detallesArray.forEach((rawD: any) => {
            const d = rawD?.value || rawD; if (!d || Object.keys(d).length === 0) return;
            datosExcel.push(['', new Date(d.fecha).toLocaleDateString('es-MX'), d.tipo_movimiento || '-', d.documento || '-', d.cantidad || 0, `$${(parseFloat(d.costo_total) || 0).toFixed(2)}`]);
          });
        }
        datosExcel.push([]); 
      }
    });

    if (this.tipoReporteSeleccionado === 'gastos-totales' && this.totalGeneral > 0) {
      const filaTotales = new Array(headers.length).fill('');
      filaTotales[headers.length - 1] = `TOTAL:$${this.totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      datosExcel.push(filaTotales);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(datosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
    worksheet['!cols'] = [ { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 } ];
    XLSX.writeFile(workbook, `Reporte_${this.tipoReporteSeleccionado}_${new Date().getTime()}.xlsx`);
    this.mostrarNotificacion('Éxito', 'Excel exportado correctamente', 'exito');
  }
}