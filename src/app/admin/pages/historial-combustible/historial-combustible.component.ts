import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';
import { AuthService } from '../../../services/auth.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
      }) as jsPDFWithAutoTable;

      // Encabezado
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 150, 243);
      doc.text('HISTORIAL DE CARGAS DE COMBUSTIBLE', 148.5, 15, { align: 'center' });

      const subtitulo = this.tipoCalculo === 'vueltas' ? 'Cálculo por: Vueltas' : 'Cálculo por: Días';
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(subtitulo, 148.5, 22, { align: 'center' });

      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 148.5, 27, { align: 'center' });

      // Preparar columnas y filas
      const columnas = this.tipoCalculo === 'vueltas'
        ? ['Fecha', 'Autobús', 'Operador', 'KM', 'Litros', 'Rend.', 'Rutas']
        : ['Fecha', 'Autobús', 'Operador', 'KM', 'Litros', 'Rend.', 'Despachador'];

      const filas = this.cargas.map(carga => {
        const fila = [
          this.formatearFecha(carga.fecha_operacion),
          carga.economico || '-',
          carga.nombre_completo || carga.nombre_operador || '-',
          this.obtenerNumero(carga.km_recorridos) + ' km',
          this.obtenerNumero(carga.litros_cargados).toFixed(2) + ' L',
          this.obtenerNumero(carga.rendimiento_calculado).toFixed(2)
        ];

        if (this.tipoCalculo === 'vueltas') {
          fila.push(carga.rutas_y_vueltas || carga.rutas_info || '-');
        } else {
          fila.push(carga.nombre_despachador || '-');
        }

        return fila;
      });

      // Totales
      const totalLitros = this.cargas.reduce((acc, c) => acc + this.obtenerNumero(c.litros_cargados), 0);
      const totalKm = this.cargas.reduce((acc, c) => acc + this.obtenerNumero(c.km_recorridos), 0);
      const promedioRendimiento = totalLitros > 0 ? totalKm / totalLitros : 0;

      // Tabla con autoTable
      autoTable(doc, {
        head: [columnas],
        body: filas,
        startY: 32,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          overflow: 'linebreak',
          halign: 'left',
          valign: 'middle',
          textColor: [40, 40, 40],
          lineColor: [200, 200, 200],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [33, 150, 243],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
          cellPadding: 3
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        columnStyles: {
          0: { cellWidth: 32, halign: 'center' },  // Fecha
          1: { cellWidth: 25, halign: 'center' },  // Autobús
          2: { cellWidth: 48, halign: 'left' },    // Operador
          3: { cellWidth: 22, halign: 'right' },   // KM
          4: { cellWidth: 22, halign: 'right' },   // Litros
          5: { cellWidth: 20, halign: 'center' },  // Rendimiento
          6: { cellWidth: 'auto', halign: 'left' } // Rutas/Despachador
        },
        margin: { left: 10, right: 10 },
        didDrawPage: (data: any) => {
          // Pie de página en cada página
          const pageHeight = doc.internal.pageSize.height;
          doc.setDrawColor(200, 200, 200);
          doc.line(10, pageHeight - 15, 287, pageHeight - 15);
          doc.setFontSize(8);
          doc.setTextColor(120, 120, 120);
          const pageNum = (doc.internal as any).getNumberOfPages();
          doc.text(`Página ${data.pageNumber} de ${pageNum}`, 148.5, pageHeight - 10, { align: 'center' });
        }
      });

      // Resumen final
      const finalY = doc.lastAutoTable.finalY || 100;
      const pageHeight = doc.internal.pageSize.height;
      const espacioDisponible = pageHeight - finalY;

      // Si hay espacio suficiente, agregar resumen en la misma página
      if (espacioDisponible > 35) {
        doc.setFillColor(240, 248, 255);
        doc.rect(10, finalY + 8, 277, 25, 'F');
        doc.setDrawColor(33, 150, 243);
        doc.setLineWidth(0.5);
        doc.rect(10, finalY + 8, 277, 25);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 150, 243);
        doc.text(`Total de Registros: ${this.cargas.length}`, 15, finalY + 16);
        doc.text(`Total Litros: ${totalLitros.toFixed(2)} L`, 90, finalY + 16);
        doc.text(`Total KM: ${totalKm.toFixed(0)} km`, 180, finalY + 16);
        doc.text(`Rendimiento Promedio: ${promedioRendimiento.toFixed(2)} km/L`, 15, finalY + 26);
      } else {
        // Si no hay espacio, agregar en nueva página
        doc.addPage();
        doc.setFillColor(240, 248, 255);
        doc.rect(10, 20, 277, 25, 'F');
        doc.setDrawColor(33, 150, 243);
        doc.setLineWidth(0.5);
        doc.rect(10, 20, 277, 25);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 150, 243);
        doc.text(`Total de Registros: ${this.cargas.length}`, 15, 28);
        doc.text(`Total Litros: ${totalLitros.toFixed(2)} L`, 90, 28);
        doc.text(`Total KM: ${totalKm.toFixed(0)} km`, 180, 28);
        doc.text(`Rendimiento Promedio: ${promedioRendimiento.toFixed(2)} km/L`, 15, 38);
      }

      const nombreArchivo = `Historial_Combustible_${new Date().getTime()}.pdf`;
      doc.save(nombreArchivo);
      this.exportando = false;
      console.log('PDF generado exitosamente');
    } catch (error) {
      console.error('Error al exportar a PDF:', error);
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