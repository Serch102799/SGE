import { Component } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { environment } from '../../../../environments/environments';

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
    
    const doc = new jsPDF('landscape'); // Modo horizontal para más espacio
    const titulo = this.tituloReporte.toUpperCase();
    
    // Encabezado
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(titulo, 14, 20);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-MX')}`, 14, 28);

    // Añadir periodo si hay fechas
    if (this.requiereFechas && this.fechaInicio && this.fechaFin) {
      doc.text(`Periodo: ${this.fechaInicio} al ${this.fechaFin}`, 14, 34);
    }

    // Si es reporte de gastos totales, agregar el total destacado
    let startY = 40;
    if (this.tipoReporteSeleccionado === 'gastos-totales' && this.totalGeneral > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(76, 175, 80); // Verde
      doc.text(
        `TOTAL GENERAL: ${this.totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
        14, 
        startY
      );
      doc.setTextColor(0, 0, 0); // Restablecer a negro
      doc.setFont('helvetica', 'normal');
      startY = 48;
    }

    // Preparar datos de la tabla
    const headers = this.columnasReporte.map(col => this.formatearColumna(col));
    const body = this.reporteData.map(item => 
      this.columnasReporte.map(col => this.formatearValor(item[col], col))
    );

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

    // Preparar datos
    const datosExportar = this.reporteData.map(item => {
      const fila: any = {};
      this.columnasReporte.forEach(col => {
        fila[this.formatearColumna(col)] = this.formatearValor(item[col], col);
      });
      return fila;
    });

    // Si es gastos totales, agregar fila de total
    if (this.tipoReporteSeleccionado === 'gastos-totales' && this.totalGeneral > 0) {
      const filaTotales: any = {};
      this.columnasReporte.forEach((col, index) => {
        if (index === this.columnasReporte.length - 1) {
          filaTotales[this.formatearColumna(col)] = `TOTAL: ${this.totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
          filaTotales[this.formatearColumna(col)] = '';
        }
      });
      datosExportar.push(filaTotales);
    }

    // Convertir a CSV
    const headers = this.columnasReporte.map(col => this.formatearColumna(col));
    let csv = headers.join(',') + '\n';
    
    datosExportar.forEach(fila => {
      const valores = headers.map(header => {
        const valor = fila[header] || '';
        // Escapar valores que contengan comas
        return typeof valor === 'string' && valor.includes(',') ? `"${valor}"` : valor;
      });
      csv += valores.join(',') + '\n';
    });

    // Crear blob y descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_${this.tipoReporteSeleccionado}_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.mostrarNotificacion('Éxito', 'Excel exportado correctamente', 'exito');
  }
}