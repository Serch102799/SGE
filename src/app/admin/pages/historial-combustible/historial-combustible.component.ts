import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';
import { AuthService } from '../../../services/auth.service';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';


interface Ruta {
  id_ruta: number;
  nombre_ruta: string;
}

@Component({
  selector: 'app-historial-combustible',
  standalone: false,
  templateUrl: './historial-combustible.component.html',
  styleUrls: ['./historial-combustible.component.css']
})
export class HistorialCombustibleComponent implements OnInit, OnDestroy {

  private apiUrl = `${environment.apiUrl}/cargas-combustible`;
  cargas: any[] = [];
  rutas: Ruta[] = [];

  // Paginación y Búsqueda
  currentPage: number = 1;
  itemsPerPage: number = 15;
  totalItems: number = 0;
  terminoBusqueda: string = '';
  filtroRutaId: string = '';
  private searchSubject: Subject<void> = new Subject<void>();
  private searchSubscription?: Subscription;

  // Estado de exportación
  exportando: boolean = false;
  exportandoExcel: boolean = false;

  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit(): void {
    this.cargarRutas();
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      startWith(undefined)
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerCargas();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  cargarRutas(): void {
    this.http.get<Ruta[]>(`${environment.apiUrl}/rutas/lista-simple`).subscribe({
      next: (data) => {
        this.rutas = data;
      },
      error: (err) => {
        console.error("Error al cargar rutas:", err);
        this.rutas = [];
      }
    });
  }

  obtenerCargas(): void {
    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('limit', this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim());

    if (this.filtroRutaId) {
      params = params.set('id_ruta', this.filtroRutaId);
    }

    this.http.get<{ total: number, data: any[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.cargas = response.data || [];
        this.totalItems = response.total || 0;
      },
      error: (err) => {
        console.error("Error al obtener historial de cargas:", err);
        this.cargas = [];
        this.totalItems = 0;
      }
    });
  }

  onSearchChange(): void {
    this.searchSubject.next();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerCargas();
  }

  // --- EXPORTAR A PDF ---
  exportarAPDF(): void {
    if (!this.cargas || this.cargas.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    this.exportando = true;

    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Título
      doc.setFontSize(18);
      doc.setTextColor(33, 150, 243);
      doc.text('Historial de Cargas de Combustible', 14, 15);

      // Fecha de reporte
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Reporte generado: ${new Date().toLocaleString()}`, 14, 22);

      // Preparar datos para la tabla
      const columnas = ['Fecha', 'Autobús', 'Operador', 'KM Recorridos', 'Litros', 'Rendimiento', 'Rutas'];
      const filas = this.cargas.map(carga => [
        this.formatearFecha(carga.fecha_operacion),
        carga.economico || '-',
        carga.nombre_completo || carga.nombre_operador || '-',
        `${this.obtenerNumero(carga.km_recorridos)}`,
        `${this.obtenerNumero(carga.litros_cargados).toFixed(2)}`,
        `${this.obtenerNumero(carga.rendimiento_calculado).toFixed(2)} km/l`,
        carga.rutas_y_vueltas || carga.rutas_info || '-'
      ]);

      // Crear tabla
      try {
        const docWithTable = doc as any;
        if (docWithTable.autoTable && typeof docWithTable.autoTable === 'function') {
          docWithTable.autoTable({
            head: [columnas],
            body: filas,
            startY: 30,
            theme: 'grid',
            styles: {
              fontSize: 9,
              cellPadding: 5,
              textColor: [50, 50, 50],
              lineColor: [200, 200, 200]
            },
            headStyles: {
              fillColor: [33, 150, 243],
              textColor: [255, 255, 255],
              fontStyle: 'bold'
            },
            alternateRowStyles: {
              fillColor: [245, 245, 245]
            },
            columnStyles: {
              3: { halign: 'right' },
              4: { halign: 'right' },
              5: { halign: 'right' }
            }
          });
        } else {
          throw new Error('autoTable no está disponible');
        }
      } catch (tableError) {
        console.warn('Usando tabla manual:', tableError);
        this.dibujarTablaManual(doc, columnas, filas);
      }

      // Agregar resumen al pie
      const pageCount = (doc as any).internal.getNumberOfPages();
      const pageSize = (doc as any).internal.pageSize;
      const pageHeight = pageSize.height || pageSize.getHeight?.() || 297;
      const pageWidth = pageSize.width || pageSize.getWidth?.() || 210;

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      
      const totalLitros = this.cargas.reduce((acc, c) => acc + this.obtenerNumero(c.litros_cargados), 0);
      const totalKm = this.cargas.reduce((acc, c) => acc + this.obtenerNumero(c.km_recorridos), 0);

      doc.text(`Total de Registros: ${this.cargas.length}`, 14, pageHeight - 15);
      doc.text(`Total Litros: ${totalLitros.toFixed(2)}`, 80, pageHeight - 15);
      doc.text(`Total KM: ${totalKm.toFixed(0)}`, 150, pageHeight - 15);

      // Pie de página
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
      }

      // Descargar
      const nombreArchivo = `Historial_Combustible_${new Date().getTime()}.pdf`;
      doc.save(nombreArchivo);

      this.exportando = false;
    } catch (error) {
      console.error('Error detallado al exportar PDF:', error);
      alert('Error al exportar a PDF. Revisa la consola para más detalles.');
      this.exportando = false;
    }
  }

  // --- EXPORTAR A EXCEL ---
  exportarAExcel(): void {
    if (!this.cargas || this.cargas.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    this.exportandoExcel = true;

    try {
      // Preparar datos
      const datosExcel = this.cargas.map(carga => ({
        'Fecha': this.formatearFecha(carga.fecha_operacion),
        'Autobús': carga.economico || '-',
        'Operador': carga.nombre_operador || carga.nombre_completo || '-',
        'KM Recorridos': this.obtenerNumero(carga.km_recorridos),
        'Litros': this.obtenerNumero(carga.litros_cargados),
        'Rendimiento (KM/L)': this.obtenerNumero(carga.rendimiento_calculado),
        'Rutas': carga.rutas_info || carga.rutas_y_vueltas || '-',
        'Despachador': carga.nombre_despachador || '-'
      }));

      // Crear workbook
      const worksheet = XLSX.utils.json_to_sheet(datosExcel);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial');

      // Ajustar ancho de columnas
      const colWidths = [
        { wch: 18 },  // Fecha
        { wch: 12 },  // Autobús
        { wch: 20 },  // Operador
        { wch: 15 },  // KM Recorridos
        { wch: 12 },  // Litros
        { wch: 16 },  // Rendimiento
        { wch: 25 },  // Rutas
        { wch: 18 }   // Despachador
      ];
      worksheet['!cols'] = colWidths;

      // Agregar resumen
      const resumenRow = 10 + datosExcel.length;
      worksheet[`A${resumenRow}`] = 'RESUMEN';
      worksheet[`A${resumenRow + 1}`] = 'Total de Registros:';
      worksheet[`B${resumenRow + 1}`] = datosExcel.length;
      worksheet[`A${resumenRow + 2}`] = 'Total Litros:';
      worksheet[`B${resumenRow + 2}`] = datosExcel.reduce((acc, d) => acc + this.obtenerNumero(d['Litros']), 0).toFixed(2);
      worksheet[`A${resumenRow + 3}`] = 'Total KM:';
      worksheet[`B${resumenRow + 3}`] = datosExcel.reduce((acc, d) => acc + this.obtenerNumero(d['KM Recorridos']), 0).toFixed(0);

      // Descargar
      const nombreArchivo = `Historial_Combustible_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(workbook, nombreArchivo);

      this.exportandoExcel = false;
    } catch (error) {
      console.error('Error detallado al exportar Excel:', error);
      alert('Error al exportar a Excel. Revisa la consola para más detalles.');
      this.exportandoExcel = false;
    }
  }

  private formatearFecha(fecha: string): string {
    if (!fecha) return '-';
    try {
      return new Date(fecha).toLocaleString('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  }

  private obtenerNumero(valor: any): number {
    if (valor === null || valor === undefined) return 0;
    const num = parseFloat(valor);
    return isNaN(num) ? 0 : num;
  }

  private dibujarTablaManual(doc: jsPDF, columnas: string[], filas: string[][]): void {
    const margenIzq = 14;
    const anchoColumna = (210 - 28) / columnas.length;
    let y = 30;
    const alturaFila = 8;

    // Encabezado
    doc.setFillColor(33, 150, 243);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');

    columnas.forEach((col, i) => {
      doc.text(col, margenIzq + i * anchoColumna + 2, y + 5);
    });

    y += alturaFila;

    // Filas
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    filas.forEach((fila, indexFila) => {
      if (indexFila % 2 === 1) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margenIzq, y - 2, 210 - 28, alturaFila, 'F');
      }

      doc.setDrawColor(200, 200, 200);
      doc.rect(margenIzq, y - 2, 210 - 28, alturaFila);

      fila.forEach((celda, i) => {
        const alineacion = i >= 3 ? 'right' : 'left';
        const x = alineacion === 'right' 
          ? margenIzq + (i + 1) * anchoColumna - 2 
          : margenIzq + i * anchoColumna + 2;
        doc.text(celda, x, y + 5, { align: alineacion as any });
      });

      y += alturaFila;
    });
  }
}