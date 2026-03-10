import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
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
      state('closed', style({ maxHeight: '0', opacity: '0', padding: '0' })),
      state('open', style({ maxHeight: '400px', opacity: '1', padding: '16px' })),
      transition('closed <=> open', [animate('0.3s ease-in-out')])
    ])
  ]
})
export class HistorialCombustibleComponent implements OnInit, OnDestroy {

  private apiUrl = `${environment.apiUrl}/cargas-combustible`;
  cargas: any[] = [];
  rutas: Ruta[] = [];

  currentPage: number = 1;
  itemsPerPage: number = 15;
  totalItems: number = 0;
  terminoBusqueda: string = '';

  filtroRutasIds: number[] = [];
  filtroFechaDesde: string = '';
  filtroFechaHasta: string = '';

  rutasDropdownOpen: boolean = false;
  tipoCalculo: 'dias' | 'vueltas' = 'vueltas';

  // VARIABLES DE ESTADO Y CONTROL
  cargandoPagina: boolean = false;
  private searchSubject: Subject<string> = new Subject<string>();
  private searchSubscription?: Subscription;
  private peticionHttpActual?: Subscription; // Control para evitar la condición de carrera

  exportando: boolean = false;
  exportandoExcel: boolean = false;

  modalEditarVisible: boolean = false;
  cargaEditando: any = null;
  cargandoEdicion: boolean = false;
  guardandoEdicion: boolean = false;

  fechaMaxima: string = '';
  cargaOriginal: any = null;

  modalInfoVisible: boolean = false;
  cargaInfo: any = null;
  cargandoInfo: boolean = false;

  formEdicion = {
    fecha_operacion: '',
    km_inicial: 0,
    km_final: 0,
    litros_cargados: 0,
    id_ruta: null as number | null
  };

  constructor(private http: HttpClient, public authService: AuthService) {
    const ahora = new Date();
    this.fechaMaxima = ahora.toISOString().slice(0, 16);
  }

  ngOnInit(): void {
    this.cargarRutas();

    // Suscripción inteligente: Espera 300ms y no repite búsquedas idénticas
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerCargas();
    });

    this.obtenerCargas();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.peticionHttpActual?.unsubscribe();
  }

  cargarRutas(): void {
    this.http.get<Ruta[]>(`${environment.apiUrl}/rutas/lista-simple`).subscribe({
      next: (data) => this.rutas = data,
      error: (err) => {
        console.error("❌ Error al cargar rutas:", err);
        this.rutas = [];
      }
    });
  }

  private construirParametros(page: number = 1, limit?: number): HttpParams {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit ? limit.toString() : this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim())
      .set('tipo_calculo', this.tipoCalculo);

    if (this.tipoCalculo === 'vueltas' && this.filtroRutasIds.length > 0) {
      params = params.set('id_rutas', this.filtroRutasIds.join(','));
    }
    if (this.filtroFechaDesde) params = params.set('fecha_desde', this.filtroFechaDesde);
    if (this.filtroFechaHasta) params = params.set('fecha_hasta', this.filtroFechaHasta);

    return params;
  }

  obtenerCargas(): void {
    this.cargandoPagina = true;
    const params = this.construirParametros(this.currentPage);

    if (this.peticionHttpActual) {
      this.peticionHttpActual.unsubscribe();
    }

    this.peticionHttpActual = this.http.get<{ total: number, data: any[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.cargas = response.data || [];
        this.totalItems = response.total || 0;
        this.cargandoPagina = false;
      },
      error: (err) => {
        console.error("❌ Error al obtener historial de cargas:", err);
        this.cargas = [];
        this.totalItems = 0;
        this.cargandoPagina = false;
      }
    });
  }

  dispararFiltro(): void {
    const estadoFiltros = JSON.stringify({
      s: this.terminoBusqueda,
      r: this.filtroRutasIds,
      d: this.filtroFechaDesde,
      h: this.filtroFechaHasta,
      c: this.tipoCalculo
    });
    this.searchSubject.next(estadoFiltros);
  }

  cambiarTipoCalculo(tipo: 'dias' | 'vueltas'): void {
    if (this.tipoCalculo === tipo) return;
    this.tipoCalculo = tipo;
    if (tipo === 'dias') this.filtroRutasIds = [];
    this.dispararFiltro();
  }

  onSearchChange(): void { this.dispararFiltro(); }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerCargas();
  }

  toggleRutasDropdown(): void { this.rutasDropdownOpen = !this.rutasDropdownOpen; }

  onRutaToggle(rutaId: number, event: any): void {
    event.stopPropagation();
    const isChecked = event.target.checked;

    if (this.tipoCalculo === 'dias') {
      alert('El filtro por ruta no está disponible en cálculo por días');
      event.target.checked = false;
      return;
    }

    let nuevasRutas: number[];
    if (isChecked) {
      nuevasRutas = this.filtroRutasIds.includes(rutaId) ? this.filtroRutasIds : [...this.filtroRutasIds, rutaId];
    } else {
      nuevasRutas = this.filtroRutasIds.filter(id => id !== rutaId);
    }

    if (JSON.stringify(nuevasRutas) !== JSON.stringify(this.filtroRutasIds)) {
      this.filtroRutasIds = nuevasRutas;
      this.dispararFiltro();
    }
  }

  isRutaSeleccionada(rutaId: number): boolean { return this.filtroRutasIds.includes(rutaId); }

  onFechaChange(): void {
    if (this.filtroFechaDesde && this.filtroFechaHasta) {
      if (new Date(this.filtroFechaDesde) > new Date(this.filtroFechaHasta)) {
        alert('La fecha "Desde" no puede ser mayor que la fecha "Hasta"');
        this.filtroFechaHasta = '';
        return;
      }
    }
    this.dispararFiltro();
  }

  limpiarFiltros(): void {
    this.terminoBusqueda = '';
    this.filtroRutasIds = [];
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.currentPage = 1;
    this.obtenerCargas();
  }

  public obtenerTodasLasCargas(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const params = this.construirParametros(1, 999999);
      this.http.get<{ total: number, data: any[] }>(this.apiUrl, { params }).subscribe({
        next: (response) => resolve(response.data || []),
        error: (err) => reject(err)
      });
    });
  }

  abrirModalEditar(carga: any): void {
    if (!carga || carga.id_carga === undefined) {
      alert('Error: No se puede identificar esta carga para editarla.');
      return;
    }
    this.cargaEditando = carga;
    this.modalEditarVisible = true;
    this.cargandoEdicion = true;
    this.cargaOriginal = null;
    document.body.style.overflow = 'hidden';

    this.http.get<any>(`${this.apiUrl}/detalle/${carga.id_carga}`).subscribe({
      next: (datosCarga) => {
        this.cargaOriginal = { ...datosCarga };
        this.formEdicion.fecha_operacion = this.formatearFechaParaInput(datosCarga.fecha_operacion);
        this.formEdicion.km_inicial = this.obtenerNumero(datosCarga.km_inicial);
        this.formEdicion.km_final = this.obtenerNumero(datosCarga.km_final);
        this.formEdicion.litros_cargados = this.obtenerNumero(datosCarga.litros_cargados);
        this.formEdicion.id_ruta = datosCarga.id_ruta_principal || null;
        this.cargandoEdicion = false;
      },
      error: () => {
        alert('Error al cargar los datos para editar. Intente de nuevo.');
        this.cerrarModalEditar();
      }
    });
  }

  cerrarModalEditar(): void {
    this.modalEditarVisible = false;
    this.cargaEditando = null;
    this.cargaOriginal = null;
    this.cargandoEdicion = false;
    this.guardandoEdicion = false;
    document.body.style.overflow = 'auto';
    this.formEdicion = { fecha_operacion: '', km_inicial: 0, km_final: 0, litros_cargados: 0, id_ruta: null };
  }

  detectarCambios(): boolean {
    if (!this.cargaOriginal) return false;
    const fechaOriginal = this.formatearFechaParaInput(this.cargaOriginal.fecha_operacion);
    return this.formEdicion.fecha_operacion !== fechaOriginal ||
      this.formEdicion.km_inicial !== this.obtenerNumero(this.cargaOriginal.km_inicial) ||
      this.formEdicion.km_final !== this.obtenerNumero(this.cargaOriginal.km_final) ||
      this.formEdicion.litros_cargados !== this.obtenerNumero(this.cargaOriginal.litros_cargados) ||
      this.formEdicion.id_ruta !== (this.cargaOriginal.id_ruta || null);
  }

  obtenerResumenCambios(): string[] {
    if (!this.cargaOriginal) return [];
    const cambios: string[] = [];
    const fechaOriginal = this.formatearFechaParaInput(this.cargaOriginal.fecha_operacion);
    if (this.formEdicion.fecha_operacion !== fechaOriginal) cambios.push(`Fecha: Modificada`);
    if (this.formEdicion.km_inicial !== this.obtenerNumero(this.cargaOriginal.km_inicial)) cambios.push(`KM Inicial modificado`);
    if (this.formEdicion.km_final !== this.obtenerNumero(this.cargaOriginal.km_final)) cambios.push(`KM Final modificado`);
    if (this.formEdicion.litros_cargados !== this.obtenerNumero(this.cargaOriginal.litros_cargados)) cambios.push(`Litros modificados`);
    if (this.formEdicion.id_ruta !== (this.cargaOriginal.id_ruta || null)) cambios.push(`Ruta modificada`);
    return cambios;
  }

  calcularKmRecorridos(): number { return Math.max(0, this.formEdicion.km_final - this.formEdicion.km_inicial); }

  calcularRendimientoEstimado(): number {
    const kmRecorridos = this.calcularKmRecorridos();
    return this.formEdicion.litros_cargados <= 0 ? 0 : kmRecorridos / this.formEdicion.litros_cargados;
  }

  obtenerNombreRuta(idRuta: number | null): string {
    if (!idRuta) return 'Sin ruta (Cálculo por días)';
    const ruta = this.rutas.find(r => r.id_ruta === idRuta);
    return ruta ? ruta.nombre_ruta : 'Ruta no encontrada';
  }

  esSuperUsuario(): boolean { return this.authService.hasRole(['SuperUsuario']); }

  guardarEdicion(): void {
    if (!this.cargaEditando || !this.cargaEditando.id_carga) return;
    if (this.formEdicion.km_final <= this.formEdicion.km_inicial) { alert('El KM Final debe ser mayor que el KM Inicial.'); return; }
    if (this.formEdicion.litros_cargados <= 0) { alert('Los litros cargados deben ser mayores a 0.'); return; }

    this.guardandoEdicion = true;
    const datosAActualizar = {
      fecha_operacion: new Date(this.formEdicion.fecha_operacion).toISOString(),
      km_inicial: this.formEdicion.km_inicial,
      km_final: this.formEdicion.km_final,
      litros_cargados: this.formEdicion.litros_cargados,
      id_ruta: this.formEdicion.id_ruta
    };

    this.http.put(`${this.apiUrl}/${this.cargaEditando.id_carga}`, datosAActualizar).subscribe({
      next: () => {
        this.guardandoEdicion = false;
        alert('Carga actualizada exitosamente.');
        this.cerrarModalEditar();
        this.obtenerCargas();
      },
      error: (err) => {
        this.guardandoEdicion = false;
        alert(`Error al guardar: ${err.error?.message || 'Error desconocido'}`);
      }
    });
  }

  public formatearFechaParaInput(fecha: string): string {
    if (!fecha) return new Date().toISOString().slice(0, 16);
    try {
      const d = new Date(fecha);
      const offset = d.getTimezoneOffset() * 60000;
      const localDate = new Date(d.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
    } catch { return new Date().toISOString().slice(0, 16); }
  }

  private registrarAuditoriaExportacion(tipo: 'PDF' | 'EXCEL', totalRegistros: number): void {
    const detalles = { total_registros: totalRegistros, filtros_aplicados: { busqueda: this.terminoBusqueda, tipo_calculo: this.tipoCalculo, fecha_desde: this.filtroFechaDesde, fecha_hasta: this.filtroFechaHasta, rutas_ids: this.filtroRutasIds } };
    this.http.post(`${environment.apiUrl}/superAdmin/registrar-evento`, { tipo_accion: `EXPORTAR_${tipo}`, modulo: 'HISTORIAL_COMBUSTIBLE', detalles: detalles }).subscribe();
  }

  async exportarAPDF(): Promise<void> {
    this.exportando = true;
    try {
      const todasLasCargas = await this.obtenerTodasLasCargas();
      if (!todasLasCargas || todasLasCargas.length === 0) { alert('No hay datos para exportar'); this.exportando = false; return; }

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;

      doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(33, 150, 243);
      doc.text('HISTORIAL DE CARGAS DE COMBUSTIBLE', 148.5, 15, { align: 'center' });

      doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
      doc.text(this.tipoCalculo === 'vueltas' ? 'Cálculo por: Vueltas' : 'Cálculo por: Días', 148.5, 22, { align: 'center' });

      let yPos = 27; doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      if (this.filtroFechaDesde || this.filtroFechaHasta) { doc.text(`Período: ${this.filtroFechaDesde || 'Inicio'} a ${this.filtroFechaHasta || 'Actual'}`, 148.5, yPos, { align: 'center' }); yPos += 4; }
      if (this.filtroRutasIds.length > 0) { doc.text(`Rutas seleccionadas.`, 148.5, yPos, { align: 'center' }); yPos += 4; }
      doc.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 148.5, yPos, { align: 'center' });

      const columnas = this.tipoCalculo === 'vueltas' ? ['Fecha', 'Bus', 'Marca/Mod.', 'Operador', 'KM Ini', 'KM Fin', 'Recorr.', 'Litros', 'Rend.', 'Calif.', 'Desv.', 'Motivo', 'Rutas'] : ['Fecha', 'Bus', 'Marca/Mod.', 'Operador', 'KM Ini', 'KM Fin', 'Recorr.', 'Litros', 'Rend.', 'Calif.', 'Desv.', 'Motivo', 'Despachador'];

      const filas = todasLasCargas.map(carga => {
        const clasificacion = carga.clasificacion_rendimiento || this.clasificarRendimiento(this.obtenerNumero(carga.rendimiento_calculado), carga.rendimiento_excelente, carga.rendimiento_bueno, carga.rendimiento_regular);
        const kmInicial = this.obtenerNumero(carga.km_inicial || carga.km_anterior);
        const kmFinal = this.obtenerNumero(carga.km_final || carga.km_actual);
        const desviacion = this.obtenerNumero(carga.desviacion_km);
        const marcaModelo = `${carga.marca || carga.marca_autobus || ''} ${carga.modelo || carga.anio || carga.modelo_autobus || ''}`.trim() || '-';

        const fila = [
          this.formatearFecha(carga.fecha_operacion),
          carga.economico || '-', marcaModelo, carga.nombre_completo || carga.nombre_operador || '-',
          kmInicial.toLocaleString('en-US'), kmFinal.toLocaleString('en-US'),
          this.obtenerNumero(carga.km_recorridos).toLocaleString('en-US'),
          this.obtenerNumero(carga.litros_cargados).toFixed(2), this.obtenerNumero(carga.rendimiento_calculado).toFixed(2),
          clasificacion, desviacion !== 0 ? desviacion.toLocaleString('en-US') : '0', carga.motivo_desviacion || '-'
        ];
        if (this.tipoCalculo === 'vueltas') fila.push(carga.rutas_y_vueltas || carga.rutas_info || '-'); else fila.push(carga.nombre_despachador || '-');
        return fila;
      });

      const totalLitros = todasLasCargas.reduce((acc, c) => acc + this.obtenerNumero(c.litros_cargados), 0);
      const totalKm = todasLasCargas.reduce((acc, c) => acc + this.obtenerNumero(c.km_recorridos), 0);
      const promedioRendimiento = totalLitros > 0 ? totalKm / totalLitros : 0;

      autoTable(doc, {
        head: [columnas], body: filas, startY: yPos + 5, theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 1.5, overflow: 'linebreak', halign: 'left', valign: 'middle', textColor: [40, 40, 40], lineColor: [200, 200, 200], lineWidth: 0.1 },
        headStyles: { fillColor: [33, 150, 243], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center', cellPadding: 2 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: { 0: { cellWidth: 19, halign: 'center' }, 1: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 28, halign: 'left' }, 4: { cellWidth: 14, halign: 'right' }, 5: { cellWidth: 14, halign: 'right' }, 6: { cellWidth: 13, halign: 'right' }, 7: { cellWidth: 12, halign: 'right' }, 8: { cellWidth: 11, halign: 'center' }, 9: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }, 10: { cellWidth: 12, halign: 'right', textColor: [239, 68, 68] }, 11: { cellWidth: 30, halign: 'left' }, 12: { cellWidth: 'auto', halign: 'left' } },
        margin: { left: 10, right: 10 },
        didDrawCell: (data: any) => {
          if (data.column.index === 9 && data.section === 'body') {
            const clasificacion = data.cell.raw; let color: [number, number, number] = [100, 100, 100];
            if (clasificacion === 'Excelente') color = [76, 175, 80]; else if (clasificacion === 'Bueno') color = [33, 150, 243]; else if (clasificacion === 'Regular') color = [255, 193, 7]; else if (clasificacion === 'Malo') color = [244, 67, 54];
            doc.setFillColor(color[0], color[1], color[2]); doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
            doc.setTextColor(255, 255, 255); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.text(clasificacion || '-', data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1.5, { align: 'center' });
          }
        },
        didDrawPage: (data: any) => {
          const pageHeight = doc.internal.pageSize.height; doc.setDrawColor(200, 200, 200); doc.line(10, pageHeight - 15, 287, pageHeight - 15);
          doc.setFontSize(8); doc.setTextColor(120, 120, 120); doc.text(`Página ${data.pageNumber} de ${(doc.internal as any).getNumberOfPages()}`, 148.5, pageHeight - 10, { align: 'center' });
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY || 100; const pageHeight = doc.internal.pageSize.height;
      if (pageHeight - finalY < 35) doc.addPage();
      const actualY = pageHeight - finalY < 35 ? 20 : finalY + 8;

      doc.setFillColor(240, 248, 255); doc.rect(10, actualY, 277, 25, 'F');
      doc.setDrawColor(33, 150, 243); doc.setLineWidth(0.5); doc.rect(10, actualY, 277, 25);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(33, 150, 243);
      doc.text(`Total Registros: ${todasLasCargas.length}`, 15, actualY + 8); doc.text(`Total Litros: ${totalLitros.toFixed(2)} L`, 90, actualY + 8);
      doc.text(`Total KM: ${totalKm.toFixed(0)} km`, 180, actualY + 8); doc.text(`Rendimiento Promedio: ${promedioRendimiento.toFixed(2)} km/L`, 15, actualY + 18);

      doc.save(`Historial_Combustible_${new Date().getTime()}.pdf`);
      this.registrarAuditoriaExportacion('PDF', todasLasCargas.length);
    } catch (error) { alert('Error al exportar a PDF'); } finally { this.exportando = false; }
  }

  async exportarAExcel(): Promise<void> {
    this.exportandoExcel = true;
    try {
      const todasLasCargas = await this.obtenerTodasLasCargas();
      if (!todasLasCargas || todasLasCargas.length === 0) { alert('No hay datos para exportar'); this.exportandoExcel = false; return; }

      const datosExcel = todasLasCargas.map(carga => {
        const clasificacion = carga.clasificacion_rendimiento || this.clasificarRendimiento(this.obtenerNumero(carga.rendimiento_calculado), carga.rendimiento_excelente, carga.rendimiento_bueno, carga.rendimiento_regular);
        const marcaModelo = `${carga.marca || carga.marca_autobus || ''} ${carga.modelo || carga.anio || carga.modelo_autobus || ''}`.trim() || '-';
        return {
          'Fecha': this.formatearFecha(carga.fecha_operacion), 'Autobús': carga.economico || '-', 'Marca/Modelo': marcaModelo,
          'Operador': carga.nombre_operador || carga.nombre_completo || '-', 'KM Inicial': this.obtenerNumero(carga.km_inicial || carga.km_anterior),
          'KM Final': this.obtenerNumero(carga.km_final || carga.km_actual), 'KM Recorridos': this.obtenerNumero(carga.km_recorridos),
          'Litros': this.obtenerNumero(carga.litros_cargados), 'Rendimiento (KM/L)': this.obtenerNumero(carga.rendimiento_calculado),
          'Calificación': clasificacion, 'Desviación (KM)': this.obtenerNumero(carga.desviacion_km), 'Motivo Desviación': carga.motivo_desviacion || '-',
          ...(this.tipoCalculo === 'vueltas' ? { 'Rutas': carga.rutas_info || carga.rutas_y_vueltas || '-' } : { 'Despachador': carga.nombre_despachador || '-' })
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(datosExcel);
      const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial');
      worksheet['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 35 }, { wch: 25 }];

      const rr = datosExcel.length + 2;
      worksheet[`A${rr}`] = { v: 'RESUMEN', t: 's', s: { font: { bold: true } } };
      worksheet[`A${rr + 1}`] = { v: 'Total Registros:', t: 's' }; worksheet[`B${rr + 1}`] = { v: datosExcel.length, t: 'n' };
      worksheet[`A${rr + 2}`] = { v: 'Total Litros:', t: 's' }; worksheet[`B${rr + 2}`] = { v: parseFloat(datosExcel.reduce((acc, d) => acc + this.obtenerNumero(d['Litros']), 0).toFixed(2)), t: 'n' };
      worksheet[`A${rr + 3}`] = { v: 'Total KM:', t: 's' }; worksheet[`B${rr + 3}`] = { v: parseInt(datosExcel.reduce((acc, d) => acc + this.obtenerNumero(d['KM Recorridos']), 0).toFixed(0)), t: 'n' };

      XLSX.writeFile(workbook, `Historial_Combustible_${new Date().getTime()}.xlsx`);
      this.registrarAuditoriaExportacion('EXCEL', todasLasCargas.length);
    } catch (error) { alert('Error al exportar a Excel.'); } finally { this.exportandoExcel = false; }
  }

  public formatearFecha(fecha: string): string {
    if (!fecha) return '-';
    try { return new Date(fecha).toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return '-'; }
  }

  public obtenerNumero(valor: any): number { return isNaN(parseFloat(valor)) ? 0 : parseFloat(valor); }

  public clasificarRendimiento(rendimiento: number, excelente?: number, bueno?: number, regular?: number): string {
    if (!excelente || !bueno || !regular) return '-';
    if (rendimiento >= excelente) return 'Excelente';
    if (rendimiento >= bueno) return 'Bueno';
    if (rendimiento >= regular) return 'Regular';
    return 'Malo';
  }

  abrirModalInfo(carga: any): void {
    if (!carga || carga.id_carga === undefined) return;
    this.modalInfoVisible = true; this.cargandoInfo = true; this.cargaInfo = null; document.body.style.overflow = 'hidden';
    this.http.get<any>(`${this.apiUrl}/detalle/${carga.id_carga}`).subscribe({
      next: (datos) => {
        if (!datos.clasificacion_rendimiento && datos.rendimiento_calculado) datos.clasificacion_rendimiento = this.clasificarRendimiento(this.obtenerNumero(datos.rendimiento_calculado), datos.rendimiento_excelente, datos.rendimiento_bueno, datos.rendimiento_regular);
        this.cargaInfo = datos; this.cargandoInfo = false;
      },
      error: () => this.cerrarModalInfo()
    });
  }

  cerrarModalInfo(): void { this.modalInfoVisible = false; this.cargaInfo = null; this.cargandoInfo = false; document.body.style.overflow = 'auto'; }

  calcularDesviacion(carga: any): number {
    if (!carga) return 0;
    if (carga.desviacion_km !== undefined && carga.desviacion_km !== null) return this.obtenerNumero(carga.desviacion_km);
    const kmEsperados = this.obtenerNumero(carga.km_esperados) || this.obtenerNumero(carga.km_esperados_ruta);
    if (kmEsperados === 0) return 0;
    return this.obtenerNumero(carga.km_recorridos) - kmEsperados;
  }

  tieneDesviacionSignificativa(carga: any): boolean { return Math.abs(this.calcularDesviacion(carga)) > 15; }

  obtenerColorClasificacion(clasificacion: string): string {
    switch (clasificacion) {
      case 'Excelente': return 'text-green-600 bg-green-50'; case 'Bueno': return 'text-blue-600 bg-blue-50';
      case 'Regular': return 'text-yellow-600 bg-yellow-50'; case 'Malo': return 'text-red-600 bg-red-50'; default: return 'text-gray-600 bg-gray-50';
    }
  }
}