import { Component } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
export class ReportesComponent {
  
  tipoReporteSeleccionado: string = 'stock-bajo';
  fechaInicio: string = '';
  fechaFin: string = '';

  reporteData: any[] = [];
  columnasReporte: string[] = [];
  totalGeneral: number = 0;
  isLoading = false;

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };
  
  private apiUrl = `${environment.apiUrl}/reportes`;

  // Configuración de reportes con títulos y descripciones
  reportesConfig: { [key: string]: { titulo: string, descripcion: string, requiereFecha: boolean } } = {
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
      titulo: 'Movimientos por Refacción',
      descripcion: 'Historial completo de movimientos de una refacción específica',
      requiereFecha: true
    }
  };

  constructor(private http: HttpClient) { }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }

  get tituloReporte(): string {
    return this.reportesConfig[this.tipoReporteSeleccionado]?.titulo || 'Reporte';
  }

  get descripcionReporte(): string {
    return this.reportesConfig[this.tipoReporteSeleccionado]?.descripcion || '';
  }

  get requiereFechas(): boolean {
    return this.reportesConfig[this.tipoReporteSeleccionado]?.requiereFecha || false;
  }

  generarReporte() {
    if (!this.tipoReporteSeleccionado) {
      this.mostrarNotificacion('Selección Requerida', 'Por favor, selecciona un tipo de reporte.');
      return;
    }

    if (this.requiereFechas && (!this.fechaInicio || !this.fechaFin)) {
      this.mostrarNotificacion('Filtro Requerido', 'Este reporte requiere un rango de fechas.');
      return;
    }

    this.isLoading = true;
    this.reporteData = [];
    this.totalGeneral = 0;
    
    let params = new HttpParams();
    if (this.fechaInicio) params = params.set('fechaInicio', this.fechaInicio);
    if (this.fechaFin) params = params.set('fechaFin', this.fechaFin);

    this.http.get<any>(`${this.apiUrl}/${this.tipoReporteSeleccionado}`, { params }).subscribe({
      next: (data) => {
        // Manejo especial para gastos-totales
        if (this.tipoReporteSeleccionado === 'gastos-totales') {
          this.reporteData = data.entradas || [];
          this.totalGeneral = data.totalGeneral || 0;
        } else {
          // Para otros reportes que devuelven array directamente
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
  get mostrarTotalGeneral(): boolean {
  return this.tipoReporteSeleccionado === 'gastos-totales' && this.totalGeneral > 0;
}

// Variables para el Modal de Detalles
  modalDetallesVisible: boolean = false;
  busSeleccionado: any = null;

  // Funciones para abrir/cerrar el modal
  abrirModalDetalles(bus: any) {
    this.busSeleccionado = bus;
    this.modalDetallesVisible = true;
    document.body.style.overflow = 'hidden'; // Evita el scroll del fondo
  }

  cerrarModalDetalles() {
    this.modalDetallesVisible = false;
    this.busSeleccionado = null;
    document.body.style.overflow = 'auto'; // Restaura el scroll
  }
  formatearValor(valor: any, columna: string): string {
    // Formatear valores monetarios
    if (columna.toLowerCase().includes('valor') || 
        columna.toLowerCase().includes('costo') || 
        columna.toLowerCase().includes('precio')) {
      const numero = parseFloat(valor);
      if (!isNaN(numero)) {
        return '$' + numero.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }
    
    // Formatear fechas
    if (columna.toLowerCase().includes('fecha')) {
      const fecha = new Date(valor);
      if (!isNaN(fecha.getTime())) {
        return fecha.toLocaleDateString('es-MX', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
      }
    }

    // Formatear números grandes con comas
    if (typeof valor === 'number') {
      return valor.toLocaleString('es-MX');
    }

    return valor || '-';
  }

  formatearColumna(columna: string): string {
    return columna
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

exportarPDF() {
    if (this.reporteData.length === 0) {
      this.mostrarNotificacion('Sin Datos', 'No hay datos para exportar.');
      return;
    }
    
    const doc = new jsPDF('landscape'); // Modo horizontal
    const titulo = this.tituloReporte.toUpperCase();
    
    // Encabezado
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

    // Ocultamos la columna detalles de la cabecera principal
    const columnasVisibles = this.columnasReporte.filter(col => col !== 'detalles');
    const headers = columnasVisibles.map(col => this.formatearColumna(col));
    
    // Preparar el cuerpo de la tabla dinámicamente
    const body: any[] = [];

    this.reporteData.forEach(item => {
      // Obtenemos los valores de la fila principal
      const filaPrincipal = columnasVisibles.map(col => this.formatearValor(item[col], col));

      // --- MAGIA PARA EL REPORTE DE COSTO POR AUTOBÚS ---
      if (this.tipoReporteSeleccionado === 'costo-autobus' && item.detalles && item.detalles.length > 0) {
        
        // 1. Fila Maestra (El autobús) - Le damos un fondo azul muy claro para que resalte
        const filaMaestra = filaPrincipal.map(val => ({
          content: val,
          styles: { fontStyle: 'bold', fillColor: [235, 245, 255] }
        }));
        body.push(filaMaestra);

        // 2. Cabecera del Desglose (Alineada perfectamente a las 7 columnas principales)
        body.push([
          { content: '', styles: { fillColor: [255, 255, 255] } }, // Sangría (Celda vacía bajo el ID)
          { content: 'FECHA', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } },
          { content: 'TIPO', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } },
          { content: 'ARTÍCULO', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245] } },
          { content: 'CANT.', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'center' } },
          { content: 'COSTO U.', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'right' } },
          { content: 'SUBTOTAL', styles: { fontStyle: 'bold', fontSize: 8, textColor: [80,80,80], fillColor: [245,245,245], halign: 'right' } }
        ]);

        // 3. Filas de cada refacción/insumo
        item.detalles.forEach((detalle: any) => {
          const articuloTxt = detalle.marca ? `${detalle.nombre} (${detalle.marca})` : detalle.nombre;
          
          body.push([
            { content: '', styles: { fillColor: [255, 255, 255] } }, // Sangría
            { content: new Date(detalle.fecha).toLocaleDateString('es-MX'), styles: { fontSize: 8, textColor: [100,100,100], fillColor: [255, 255, 255] } },
            { content: detalle.tipo_item, styles: { fontSize: 8, textColor: [100,100,100], fillColor: [255, 255, 255] } },
            { content: articuloTxt, styles: { fontSize: 8, textColor: [100,100,100], fillColor: [255, 255, 255] } },
            { content: detalle.cantidad.toString(), styles: { fontSize: 8, textColor: [100,100,100], fillColor: [255, 255, 255], halign: 'center' } },
            { content: `$${detalle.costo_unitario.toFixed(2)}`, styles: { fontSize: 8, textColor: [100,100,100], fillColor: [255, 255, 255], halign: 'right' } },
            { content: `$${detalle.costo_total.toFixed(2)}`, styles: { fontSize: 8, textColor: [100,100,100], fillColor: [255, 255, 255], halign: 'right' } }
          ]);
        });

      } else {
        // --- PARA LOS DEMÁS REPORTES (O si el bus no tiene detalles) ---
        body.push(filaPrincipal);
      }
    });

    // Generar la tabla en el PDF
    autoTable(doc, {
      startY: startY,
      head: [headers],
      body: body,
      headStyles: { 
        fillColor: [68, 128, 211],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { top: 10 }
    });

    doc.save(`reporte_${this.tipoReporteSeleccionado}_${new Date().getTime()}.pdf`);
    this.mostrarNotificacion('Éxito', 'PDF exportado correctamente', 'exito');
  }

  exportarExcel() {
    if (this.reporteData.length === 0) {
      this.mostrarNotificacion('Sin Datos', 'No hay datos para exportar.');
      return;
    }

    // 1. Columnas principales (ocultando 'detalles' para que no salga [object Object])
    const columnasVisibles = this.columnasReporte.filter(col => col !== 'detalles');
    const headers = columnasVisibles.map(col => this.formatearColumna(col));

    // 2. Preparar el arreglo de filas que insertaremos en Excel
    const datosExcel: any[][] = [];
    
    // Insertar la cabecera principal
    datosExcel.push(headers);

    // 3. Recorrer los datos de la tabla
    this.reporteData.forEach(fila => {
      
      // --- FILA MAESTRA (El autobús, la entrada, o la refacción) ---
      const filaPrincipal = columnasVisibles.map(header => {
        const colOriginal = this.columnasReporte.find(c => this.formatearColumna(c) === header) || header;
        // Para Excel es mejor enviar los números crudos si queremos que puedan sumarlos
        // Pero usaremos tu formateador para mantener la consistencia
        return this.formatearValor(fila[colOriginal], colOriginal);
      });
      datosExcel.push(filaPrincipal);

      // --- FILAS DE DESGLOSE (Exclusivo para Costo por Autobús) ---
      if (this.tipoReporteSeleccionado === 'costo-autobus' && fila.detalles && fila.detalles.length > 0) {
        
        // Cabecera del sub-reporte (dejamos la primera celda vacía para "identar" visualmente en Excel)
        datosExcel.push(['', '--> FECHA', 'TIPO', 'ARTÍCULO', 'MARCA', 'CANTIDAD', 'COSTO UNIT.', 'SUBTOTAL']);
        
        fila.detalles.forEach((detalle: any) => {
          const fechaFormat = new Date(detalle.fecha).toLocaleDateString('es-MX');
          
          datosExcel.push([
            '', // Celda vacía para sangría
            fechaFormat,
            detalle.tipo_item,
            detalle.nombre,
            detalle.marca || 'N/A',
            detalle.cantidad,
            `$${detalle.costo_unitario.toFixed(2)}`,
            `$${detalle.costo_total.toFixed(2)}`
          ]);
        });
        
        // Agregar una fila completamente vacía al final del desglose para separar del siguiente autobús
        datosExcel.push([]); 
      }
    });

    // 4. Si es gastos totales, agregar la fila de total general al final
    if (this.tipoReporteSeleccionado === 'gastos-totales' && this.totalGeneral > 0) {
      const filaTotales = new Array(headers.length).fill(''); // Llenar celdas vacías
      filaTotales[headers.length - 1] = `TOTAL: $${this.totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      datosExcel.push(filaTotales);
    }

    // 5. Crear el libro de Excel y la hoja
    const worksheet = XLSX.utils.aoa_to_sheet(datosExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');

    // Opcional: Ajustar el ancho de las columnas un poco
    const wscols = [
      { wch: 20 }, // Ancho columna 1
      { wch: 15 }, // Ancho columna 2
      { wch: 25 }, // Ancho columna 3
      { wch: 25 }, // Ancho columna 4
      { wch: 15 }, // Ancho columna 5
      { wch: 15 }  // Ancho columna 6
    ];
    worksheet['!cols'] = wscols;

    // 6. Descargar el archivo nativo .xlsx
    const nombreArchivo = `Reporte_${this.tipoReporteSeleccionado}_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(workbook, nombreArchivo);

    this.mostrarNotificacion('Éxito', 'Excel exportado correctamente', 'exito');
  }
}