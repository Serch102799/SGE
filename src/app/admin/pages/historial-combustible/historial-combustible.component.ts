import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';
import { AuthService } from '../../../services/auth.service';
import { trigger, state, style, transition, animate } from '@angular/animations';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  styleUrls: ['./historial-combustible.component.css'],
  animations: [
    trigger('slideDown', [
      state('closed', style({
        maxHeight: '0',
        opacity: '0',
        padding: '0'
      })),
      state('open', style({
        maxHeight: '400px',
        opacity: '1',
        padding: '16px'
      })),
      transition('closed <=> open', [
        animate('0.3s ease-in-out')
      ])
    ])
  ]
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
  
  // NUEVOS FILTROS
  filtroRutasIds: number[] = []; // Array para múltiples rutas
  filtroFechaDesde: string = '';
  filtroFechaHasta: string = '';
  
  // Control del dropdown de rutas
  rutasDropdownOpen: boolean = false;
  
  // Tipo de cálculo
  tipoCalculo: 'dias' | 'vueltas' = 'vueltas';
  
  private searchSubject: Subject<void> = new Subject<void>();
  private searchSubscription?: Subscription;

  // Estado de exportación
  exportando: boolean = false;
  exportandoExcel: boolean = false;

  // Estado de edición (Solo SuperUsuario)
  modalEditarVisible: boolean = false;
  cargaEditando: any = null;
  fechaMaxima: string = '';

  constructor(private http: HttpClient, public authService: AuthService) {
    // Establecer fecha máxima (hoy)
    const ahora = new Date();
    this.fechaMaxima = ahora.toISOString().slice(0, 16);
  }

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

  
  // Método para construir parámetros de filtrado
  private construirParametros(page: number = 1, limit?: number): HttpParams {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit ? limit.toString() : this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim())
      .set('tipo_calculo', this.tipoCalculo);

    // Filtro de rutas (solo en modo vueltas)
    if (this.tipoCalculo === 'vueltas' && this.filtroRutasIds.length > 0) {
      params = params.set('id_rutas', this.filtroRutasIds.join(','));
    }

    // Filtro de fechas
    if (this.filtroFechaDesde) {
      params = params.set('fecha_desde', this.filtroFechaDesde);
    }
    if (this.filtroFechaHasta) {
      params = params.set('fecha_hasta', this.filtroFechaHasta);
    }

    return params;
  }

  obtenerCargas(): void {
    const params = this.construirParametros(this.currentPage);
    
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

  // NUEVO: Obtener TODOS los datos filtrados para exportación
  private obtenerTodasLasCargas(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // Solicitar TODAS las páginas (limit muy alto o sin límite según tu backend)
      const params = this.construirParametros(1, 999999);
      
      this.http.get<{ total: number, data: any[] }>(this.apiUrl, { params }).subscribe({
        next: (response) => {
          console.log(`Obtenidos ${response.data.length} registros para exportación`);
          resolve(response.data || []);
        },
        error: (err) => {
          console.error("Error al obtener datos para exportación:", err);
          reject(err);
        }
      });
    });
  }

  cambiarTipoCalculo(tipo: 'dias' | 'vueltas'): void {
    this.tipoCalculo = tipo;
    if (tipo === 'dias') {
      this.filtroRutasIds = [];
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

  // NUEVO: Toggle del dropdown de rutas
  toggleRutasDropdown(): void {
    this.rutasDropdownOpen = !this.rutasDropdownOpen;
  }

  // NUEVO: Manejo de selección múltiple de rutas
  onRutaToggle(rutaId: number, event: any): void {
    console.log('onRutaToggle llamado:', rutaId, event.target.checked);
    
    if (this.tipoCalculo === 'dias') {
      alert('El filtro por ruta no está disponible en cálculo por días');
      event.target.checked = false;
      return;
    }

    if (event.target.checked) {
      if (!this.filtroRutasIds.includes(rutaId)) {
        this.filtroRutasIds.push(rutaId);
      }
    } else {
      this.filtroRutasIds = this.filtroRutasIds.filter(id => id !== rutaId);
    }
    
    console.log('filtroRutasIds actualizado:', this.filtroRutasIds);
    
    // IMPORTANTE: Disparar el searchSubject para actualizar la búsqueda
    this.searchSubject.next();
  }

  // NUEVO: Verificar si una ruta está seleccionada
  isRutaSeleccionada(rutaId: number): boolean {
    return this.filtroRutasIds.includes(rutaId);
  }

  // NUEVO: Limpiar filtros
  limpiarFiltros(): void {
    this.terminoBusqueda = '';
    this.filtroRutasIds = [];
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.searchSubject.next();
  }

  // NUEVO: Aplicar filtros de fecha
  onFechaChange(): void {
    // Validar que fecha desde no sea mayor que fecha hasta
    if (this.filtroFechaDesde && this.filtroFechaHasta) {
      if (new Date(this.filtroFechaDesde) > new Date(this.filtroFechaHasta)) {
        alert('La fecha "Desde" no puede ser mayor que la fecha "Hasta"');
        this.filtroFechaHasta = '';
        return;
      }
    }
    this.searchSubject.next();
  }

  // MODIFICADO: Exportar PDF con TODOS los datos filtrados
  async exportarAPDF(): Promise<void> {
    this.exportando = true;

    try {
      // Obtener TODOS los registros filtrados
      const todasLasCargas = await this.obtenerTodasLasCargas();

      if (!todasLasCargas || todasLasCargas.length === 0) {
        alert('No hay datos para exportar');
        this.exportando = false;
        return;
      }

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

      // Mostrar filtros aplicados
      let yPos = 27;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      
      if (this.filtroFechaDesde || this.filtroFechaHasta) {
        const textoFechas = `Período: ${this.filtroFechaDesde || 'Inicio'} a ${this.filtroFechaHasta || 'Actual'}`;
        doc.text(textoFechas, 148.5, yPos, { align: 'center' });
        yPos += 4;
      }
      
      if (this.filtroRutasIds.length > 0) {
        const rutasSeleccionadas = this.rutas
          .filter(r => this.filtroRutasIds.includes(r.id_ruta))
          .map(r => r.nombre_ruta)
          .join(', ');
        doc.text(`Rutas: ${rutasSeleccionadas}`, 148.5, yPos, { align: 'center' });
        yPos += 4;
      }

      doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 148.5, yPos, { align: 'center' });

      // Preparar columnas y filas
      const columnas = this.tipoCalculo === 'vueltas'
        ? ['Fecha', 'Autobús', 'Operador', 'KM', 'Litros', 'Rend.', 'Calific.', 'Rutas']
        : ['Fecha', 'Autobús', 'Operador', 'KM', 'Litros', 'Rend.', 'Calific.', 'Despachador'];

      const filas = todasLasCargas.map(carga => {
        const clasificacion = carga.clasificacion_rendimiento || this.clasificarRendimiento(
          this.obtenerNumero(carga.rendimiento_calculado),
          carga.rendimiento_excelente,
          carga.rendimiento_bueno,
          carga.rendimiento_regular
        );

        const fila = [
          this.formatearFecha(carga.fecha_operacion),
          carga.economico || '-',
          carga.nombre_completo || carga.nombre_operador || '-',
          this.obtenerNumero(carga.km_recorridos) + ' km',
          this.obtenerNumero(carga.litros_cargados).toFixed(2) + ' L',
          this.obtenerNumero(carga.rendimiento_calculado).toFixed(2),
          clasificacion
        ];

        if (this.tipoCalculo === 'vueltas') {
          fila.push(carga.rutas_y_vueltas || carga.rutas_info || '-');
        } else {
          fila.push(carga.nombre_despachador || '-');
        }

        return fila;
      });

      // Totales
      const totalLitros = todasLasCargas.reduce((acc, c) => acc + this.obtenerNumero(c.litros_cargados), 0);
      const totalKm = todasLasCargas.reduce((acc, c) => acc + this.obtenerNumero(c.km_recorridos), 0);
      const promedioRendimiento = totalLitros > 0 ? totalKm / totalLitros : 0;

      // Tabla con autoTable
      autoTable(doc, {
        head: [columnas],
        body: filas,
        startY: yPos + 5,
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
          0: { cellWidth: 35, halign: 'center' },
          1: { cellWidth: 21, halign: 'center' },
          2: { cellWidth: 40, halign: 'left' },
          3: { cellWidth: 20, halign: 'right' },
          4: { cellWidth: 20, halign: 'right' },
          5: { cellWidth: 18, halign: 'center' },
          6: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
          7: { cellWidth: 'auto', halign: 'left' }
        },
        margin: { left: 10, right: 10 },
        didDrawCell: (data: any) => {
          if (data.column.index === 6 && data.section === 'body') {
            const clasificacion = data.cell.raw;
            let color: [number, number, number] = [100, 100, 100];
            
            if (clasificacion === 'Excelente') color = [76, 175, 80];
            else if (clasificacion === 'Bueno') color = [33, 150, 243];
            else if (clasificacion === 'Regular') color = [255, 193, 7];
            else if (clasificacion === 'Malo') color = [244, 67, 54];
            
            doc.setFillColor(color[0], color[1], color[2]);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(
              clasificacion || '-',
              data.cell.x + data.cell.width / 2,
              data.cell.y + data.cell.height / 2 + 1.5,
              { align: 'center' }
            );
          }
        },
        didDrawPage: (data: any) => {
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

      if (espacioDisponible > 35) {
        doc.setFillColor(240, 248, 255);
        doc.rect(10, finalY + 8, 277, 25, 'F');
        doc.setDrawColor(33, 150, 243);
        doc.setLineWidth(0.5);
        doc.rect(10, finalY + 8, 277, 25);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 150, 243);
        doc.text(`Total de Registros: ${todasLasCargas.length}`, 15, finalY + 16);
        doc.text(`Total Litros: ${totalLitros.toFixed(2)} L`, 90, finalY + 16);
        doc.text(`Total KM: ${totalKm.toFixed(0)} km`, 180, finalY + 16);
        doc.text(`Rendimiento Promedio: ${promedioRendimiento.toFixed(2)} km/L`, 15, finalY + 26);
      } else {
        doc.addPage();
        doc.setFillColor(240, 248, 255);
        doc.rect(10, 20, 277, 25, 'F');
        doc.setDrawColor(33, 150, 243);
        doc.setLineWidth(0.5);
        doc.rect(10, 20, 277, 25);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 150, 243);
        doc.text(`Total de Registros: ${todasLasCargas.length}`, 15, 28);
        doc.text(`Total Litros: ${totalLitros.toFixed(2)} L`, 90, 28);
        doc.text(`Total KM: ${totalKm.toFixed(0)} km`, 180, 28);
        doc.text(`Rendimiento Promedio: ${promedioRendimiento.toFixed(2)} km/L`, 15, 38);
      }

      const nombreArchivo = `Historial_Combustible_${new Date().getTime()}.pdf`;
      doc.save(nombreArchivo);
      console.log('PDF generado exitosamente con', todasLasCargas.length, 'registros');
    } catch (error) {
      console.error('Error al exportar a PDF:', error);
      alert('Error al exportar a PDF: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      this.exportando = false;
    }
  }

  // MODIFICADO: Exportar Excel con TODOS los datos filtrados
  async exportarAExcel(): Promise<void> {
    this.exportandoExcel = true;

    try {
      // Obtener TODOS los registros filtrados
      const todasLasCargas = await this.obtenerTodasLasCargas();

      if (!todasLasCargas || todasLasCargas.length === 0) {
        alert('No hay datos para exportar');
        this.exportandoExcel = false;
        return;
      }

      const datosExcel = todasLasCargas.map(carga => {
        const clasificacion = carga.clasificacion_rendimiento || this.clasificarRendimiento(
          this.obtenerNumero(carga.rendimiento_calculado),
          carga.rendimiento_excelente,
          carga.rendimiento_bueno,
          carga.rendimiento_regular
        );

        return {
          'Fecha': this.formatearFecha(carga.fecha_operacion),
          'Autobús': carga.economico || '-',
          'Operador': carga.nombre_operador || carga.nombre_completo || '-',
          'KM Recorridos': this.obtenerNumero(carga.km_recorridos),
          'Litros': this.obtenerNumero(carga.litros_cargados),
          'Rendimiento (KM/L)': this.obtenerNumero(carga.rendimiento_calculado),
          'Calificación': clasificacion,
          ...(this.tipoCalculo === 'vueltas' ? {
            'Rutas': carga.rutas_info || carga.rutas_y_vueltas || '-'
          } : {
            'Despachador': carga.nombre_despachador || '-'
          })
        };
      });

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
        { wch: 14 },
        { wch: 25 }
      ];
      worksheet['!cols'] = colWidths;

      const resumenRow = datosExcel.length + 2;
      worksheet[`A${resumenRow}`] = { v: 'RESUMEN', t: 's', s: { font: { bold: true } } };
      worksheet[`A${resumenRow + 1}`] = { v: 'Total de Registros:', t: 's' };
      worksheet[`B${resumenRow + 1}`] = { v: datosExcel.length, t: 'n' };
      worksheet[`A${resumenRow + 2}`] = { v: 'Total Litros:', t: 's' };
      worksheet[`B${resumenRow + 2}`] = { 
        v: parseFloat(datosExcel.reduce((acc, d) => acc + this.obtenerNumero(d['Litros']), 0).toFixed(2)), 
        t: 'n' 
      };
      worksheet[`A${resumenRow + 3}`] = { v: 'Total KM:', t: 's' };
      worksheet[`B${resumenRow + 3}`] = { 
        v: parseInt(datosExcel.reduce((acc, d) => acc + this.obtenerNumero(d['KM Recorridos']), 0).toFixed(0)), 
        t: 'n' 
      };

      const nombreArchivo = `Historial_Combustible_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(workbook, nombreArchivo);

      console.log('Excel generado exitosamente con', todasLasCargas.length, 'registros');
    } catch (error) {
      console.error('Error detallado al exportar Excel:', error);
      alert('Error al exportar a Excel. Revisa la consola para más detalles.');
    } finally {
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

  private clasificarRendimiento(
    rendimiento: number,
    excelente?: number,
    bueno?: number,
    regular?: number
  ): string {
    if (!excelente || !bueno || !regular) {
      return '-';
    }
    
    if (rendimiento >= excelente) return 'Excelente';
    if (rendimiento >= bueno) return 'Bueno';
    if (rendimiento >= regular) return 'Regular';
    return 'Malo';
  }
}