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
interface jsPDFWithAutoTable extends jsPDF {
   autoTable: (options: any) => void;
  lastAutoTable: { finalY: number };
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
  
  // Tipo de cálculo (NUEVO)
  tipoCalculo: 'dias' | 'vueltas' = 'vueltas';
  
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
      .set('search', this.terminoBusqueda.trim())
      .set('tipo_calculo', this.tipoCalculo);

    // Solo enviar filtro de ruta si está seleccionado Y es tipo "vueltas"
    if (this.filtroRutaId && this.tipoCalculo === 'vueltas') {
      params = params.set('id_ruta', this.filtroRutaId);
    } else if (this.tipoCalculo === 'dias') {
      // Para cálculo por días, podrías usar otro tipo de filtro
      // Por ejemplo, filtro por rango de fechas
      params = params.set('id_ruta', ''); // Limpiar si existe
    }

    console.log('Parámetros enviados:', params.toString());

    this.http.get<{ total: number, data: any[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.cargas = response.data || [];
        this.totalItems = response.total || 0;
        console.log('Cargas recibidas:', this.cargas);
      },
      error: (err) => {
        console.error("Error al obtener historial de cargas:", err);
        this.cargas = [];
        this.totalItems = 0;
      }
    });
  }

  // Cambiar tipo de cálculo (NUEVO)
  cambiarTipoCalculo(tipo: 'dias' | 'vueltas'): void {
    this.tipoCalculo = tipo;
    
    // Si cambias a "días", limpiar filtro de ruta porque no aplica
    if (tipo === 'dias') {
      this.filtroRutaId = '';
    }
    
    this.searchSubject.next();
  }

  onSearchChange(): void {
    this.searchSubject.next();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerCargas();
  }

  onRutaChange(): void {
    // Solo permitir filtro de ruta en modo "vueltas"
    if (this.tipoCalculo === 'dias') {
      this.filtroRutaId = '';
      alert('El filtro por ruta no está disponible en cálculo por días');
      return;
    }
    this.searchSubject.next();
  }

  // --- EXPORTAR A PDF ---
// IMPORTANTE: Asegúrate de tener estos imports al inicio del archivo:
// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';

exportarAPDF(): void {
  if (!this.cargas || this.cargas.length === 0) {
    alert('No hay datos para exportar');
    return;
  }

  this.exportando = true;

  setTimeout(() => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Título principal
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 150, 243);
      doc.text('HISTORIAL DE CARGAS DE COMBUSTIBLE', 148.5, 15, { align: 'center' });

      // Subtítulo
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const subtitulo = this.tipoCalculo === 'vueltas' ? 'Cálculo por: Vueltas' : 'Cálculo por: Días';
      doc.text(subtitulo, 148.5, 21, { align: 'center' });

      // Fecha de generación
      doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 148.5, 26, { align: 'center' });

      // Preparar datos para la tabla
      const columnas = this.tipoCalculo === 'vueltas'
        ? ['Fecha', 'Autobús', 'Operador', 'KM', 'Litros', 'Rendimiento', 'Rutas']
        : ['Fecha', 'Autobús', 'Operador', 'KM', 'Litros', 'Rendimiento', 'Despachador'];

      const filas = this.cargas.map(carga => {
        const fila = [
          this.formatearFecha(carga.fecha_operacion),
          carga.economico || '-',
          carga.nombre_completo || carga.nombre_operador || '-',
          this.obtenerNumero(carga.km_recorridos).toString() + ' km',
          this.obtenerNumero(carga.litros_cargados).toFixed(2) + ' L',
          this.obtenerNumero(carga.rendimiento_calculado).toFixed(2) + ' km/L'
        ];

        if (this.tipoCalculo === 'vueltas') {
          fila.push(carga.rutas_y_vueltas || carga.rutas_info || '-');
        } else {
          fila.push(carga.nombre_despachador || '-');
        }

        return fila;
      });

      // Calcular totales
      const totalLitros = this.cargas.reduce((acc, c) => 
        acc + this.obtenerNumero(c.litros_cargados), 0
      );
      const totalKm = this.cargas.reduce((acc, c) => 
        acc + this.obtenerNumero(c.km_recorridos), 0
      );
      const promedioRendimiento = totalLitros > 0 ? totalKm / totalLitros : 0;

      // Llamar a autoTable
      const autoTableConfig = {
        head: [columnas],
        body: filas,
        startY: 30,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 4,
          overflow: 'linebreak',
          halign: 'left',
          valign: 'middle',
          textColor: [50, 50, 50],
          lineColor: [220, 220, 220],
          lineWidth: 0.2
        },
        headStyles: {
          fillColor: [33, 150, 243],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'center',
          cellPadding: 5
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250]
        },
        columnStyles: {
          0: { cellWidth: 32, halign: 'center' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 48 },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 28, halign: 'right' },
          6: { cellWidth: 'auto' }
        },
        margin: { left: 10, right: 10 }
      };

      // Aplicar autoTable
      if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable(autoTableConfig);
      } else {
        console.error('autoTable no disponible, usando tabla manual');
        this.dibujarTablaManual(doc, columnas, filas);
      }

      // Obtener posición final
      let finalY = 100;
      if ((doc as any).lastAutoTable && (doc as any).lastAutoTable.finalY) {
        finalY = (doc as any).lastAutoTable.finalY;
      }

      // Agregar resumen
      const pageHeight = 210; // A4 landscape height
      if (pageHeight - finalY > 30) {
        doc.setFillColor(240, 248, 255);
        doc.rect(10, finalY + 5, 277, 20, 'F');
        
        doc.setDrawColor(33, 150, 243);
        doc.setLineWidth(0.5);
        doc.rect(10, finalY + 5, 277, 20);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 150, 243);
        
        doc.text(`Total de Registros: ${this.cargas.length}`, 15, finalY + 12);
        doc.text(`Total Litros: ${totalLitros.toFixed(2)} L`, 85, finalY + 12);
        doc.text(`Total KM: ${totalKm.toFixed(0)} km`, 155, finalY + 12);
        doc.text(`Rendimiento Promedio: ${promedioRendimiento.toFixed(2)} km/L`, 15, finalY + 20);
      }

      // Agregar pie de página
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, 148.5, 205, { align: 'center' });
      }

      // Guardar PDF
      const nombreArchivo = `Historial_Combustible_${new Date().getTime()}.pdf`;
      doc.save(nombreArchivo);

      this.exportando = false;
      console.log('PDF generado exitosamente');
    } catch (error) {
      console.error('Error detallado al exportar PDF:', error);
      if (error instanceof Error) {
        console.error('Mensaje:', error.message);
        console.error('Stack:', error.stack);
      }
      alert('Error al exportar a PDF: ' + (error instanceof Error ? error.message : 'Error desconocido'));
      this.exportando = false;
    }
  }, 100);
}
  // --- EXPORTAR A EXCEL ---
  exportarAExcel(): void {
    if (!this.cargas || this.cargas.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    this.exportandoExcel = true;

    try {
      const datosExcel = this.cargas.map(carga => ({
        'Fecha': this.formatearFecha(carga.fecha_operacion),
        'Autobús': carga.economico || '-',
        'Operador': carga.nombre_operador || carga.nombre_completo || '-',
        'KM Recorridos': this.obtenerNumero(carga.km_recorridos),
        'Litros': this.obtenerNumero(carga.litros_cargados),
        'Rendimiento (KM/L)': this.obtenerNumero(carga.rendimiento_calculado),
        ...(this.tipoCalculo === 'vueltas' ? {
          'Rutas': carga.rutas_info || carga.rutas_y_vueltas || '-'
        } : {
          'Despachador': carga.nombre_despachador || '-'
        })
      }));

      const worksheet = XLSX.utils.json_to_sheet(datosExcel);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial');

      const colWidths = [
        { wch: 18 },
        { wch: 12 },
        { wch: 20 },
        { wch: 15 },
        { wch: 12 },
        { wch: 16 },
        { wch: 25 }
      ];
      worksheet['!cols'] = colWidths;

      const resumenRow = 10 + datosExcel.length;
      worksheet[`A${resumenRow}`] = 'RESUMEN';
      worksheet[`A${resumenRow + 1}`] = 'Total de Registros:';
      worksheet[`B${resumenRow + 1}`] = datosExcel.length;
      worksheet[`A${resumenRow + 2}`] = 'Total Litros:';
      worksheet[`B${resumenRow + 2}`] = datosExcel.reduce((acc, d) => acc + this.obtenerNumero(d['Litros']), 0).toFixed(2);
      worksheet[`A${resumenRow + 3}`] = 'Total KM:';
      worksheet[`B${resumenRow + 3}`] = datosExcel.reduce((acc, d) => acc + this.obtenerNumero(d['KM Recorridos']), 0).toFixed(0);

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
    let y = 35;
    const alturaFila = 8;

    doc.setFillColor(33, 150, 243);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');

    columnas.forEach((col, i) => {
      doc.text(col, margenIzq + i * anchoColumna + 2, y + 5);
    });

    y += alturaFila;

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