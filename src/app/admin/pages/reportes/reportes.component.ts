import { Component } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-reportes',
  standalone: false,
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css']
})
export class ReportesComponent {
  
  // --- Filtros ---
  tipoReporteSeleccionado: string = 'stock-bajo';
  fechaInicio: string = '';
  fechaFin: string = '';

  // --- Resultados ---
  reporteData: any[] = [];
  columnasReporte: string[] = [];
  isLoading = false;

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };
  
  private apiUrl = 'http://localhost:3000/api/reportes';

  constructor(private http: HttpClient) { }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
  generarReporte() {
    if (!this.tipoReporteSeleccionado) {
      this.mostrarNotificacion('Selección Requerida', 'Por favor, selecciona un tipo de reporte.');
      return;
    }

    if (this.tipoReporteSeleccionado === 'menos-utilizadas' && (!this.fechaInicio || !this.fechaFin)) {
      this.mostrarNotificacion('Filtro Requerido', 'Para el reporte de refacciones menos utilizadas, debes seleccionar un rango de fechas.');
      return;
    }

    this.isLoading = true;
    this.reporteData = [];
    
    let params = new HttpParams();
    if (this.fechaInicio) params = params.set('fechaInicio', this.fechaInicio);
    if (this.fechaFin) params = params.set('fechaFin', this.fechaFin);

    this.http.get<any[]>(`${this.apiUrl}/${this.tipoReporteSeleccionado}`, { params }).subscribe({
      next: (data) => {
        this.reporteData = data;
        if (data.length > 0) {
          this.columnasReporte = Object.keys(data[0]);
        } else {
          this.columnasReporte = [];
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.mostrarNotificacion('Error', `Error al generar el reporte: ${err.error.message}`, 'error');
        this.isLoading = false;
      }
    });
  }

  exportarPDF() {
    if (this.reporteData.length === 0) {
      this.mostrarNotificacion('Sin Datos', 'No hay datos para exportar.');
      return;
    }
    
    const doc = new jsPDF();
    const titulo = this.tipoReporteSeleccionado.replace(/-/g, ' ').toUpperCase();
    
    doc.text(`Reporte de ${titulo}`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 14, 26);

    autoTable(doc, {
      startY: 32,
      head: [this.columnasReporte.map(col => col.replace(/_/g, ' ').toUpperCase())],
      body: this.reporteData.map(item => this.columnasReporte.map(col => item[col])),
      headStyles: { fillColor: [68, 128, 211] },
    });

    doc.save(`reporte_${this.tipoReporteSeleccionado}.pdf`);
  }
}