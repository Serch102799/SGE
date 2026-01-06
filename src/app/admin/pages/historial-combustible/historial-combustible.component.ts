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
  
  // Filtros
  filtroRutasIds: number[] = [];
  filtroFechaDesde: string = '';
  filtroFechaHasta: string = '';
  
  // Control del dropdown de rutas
  rutasDropdownOpen: boolean = false;
  
  // Tipo de cálculo
  tipoCalculo: 'dias' | 'vueltas' = 'vueltas';
  
  // ⭐ MODIFICADO: Control de carga más granular
  private cargandoPagina: boolean = false;
  private ultimaLlamada: number = 0;
  private readonly DELAY_MINIMO = 100; // ms entre llamadas
  
  private searchSubject: Subject<string> = new Subject<string>();
  private searchSubscription?: Subscription;

  // Estado de exportación
  exportando: boolean = false;
  exportandoExcel: boolean = false;

  // Estado de edición (Solo SuperUsuario)
  modalEditarVisible: boolean = false;
  cargaEditando: any = null;
  cargandoEdicion: boolean = false;
  guardandoEdicion: boolean = false;
  
  fechaMaxima: string = '';
  cargaOriginal: any = null;

  modalInfoVisible: boolean = false;
  cargaInfo: any = null;
  cargandoInfo: boolean = false;

  // Datos del formulario de edición
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
    
    // ⭐ MODIFICADO: Usar distinctUntilChanged para evitar duplicados
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerCargas();
    });
    
    // Carga inicial
    this.obtenerCargas();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  cargarRutas(): void {
    this.http.get<Ruta[]>(`${environment.apiUrl}/rutas/lista-simple`).subscribe({
      next: (data) => {
        this.rutas = data;
        console.log('✅ Rutas cargadas:', this.rutas.length);
      },
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

  // ⭐ REDISEÑADO: Mejor control de llamadas simultáneas
  obtenerCargas(): void {
    const ahora = Date.now();
    
    // Si hay una carga en proceso y no ha pasado el tiempo mínimo, ignorar
    if (this.cargandoPagina && (ahora - this.ultimaLlamada) < this.DELAY_MINIMO) {
      console.log('⏳ Esperando a que termine la carga anterior...');
      return;
    }

    this.cargandoPagina = true;
    this.ultimaLlamada = ahora;
    
    const params = this.construirParametros(this.currentPage);
    
    console.log('🔍 Parámetros enviados:', params.toString());

    this.http.get<{ total: number, data: any[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.cargas = response.data || [];
        this.totalItems = response.total || 0;
        this.cargandoPagina = false;
        console.log('✅ Cargas recibidas:', this.cargas.length, 'registros de', this.totalItems, 'totales');
      },
      error: (err) => {
        console.error("❌ Error al obtener historial de cargas:", err);
        this.cargas = [];
        this.totalItems = 0;
        this.cargandoPagina = false;
      }
    });
  }

  public obtenerTodasLasCargas(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const params = this.construirParametros(1, 999999);
      
      this.http.get<{ total: number, data: any[] }>(this.apiUrl, { params }).subscribe({
        next: (response) => {
          console.log(`📊 Obtenidos ${response.data.length} registros para exportación`);
          resolve(response.data || []);
        },
        error: (err) => {
          console.error("❌ Error al obtener datos para exportación:", err);
          reject(err);
        }
      });
    });
  }

  cambiarTipoCalculo(tipo: 'dias' | 'vueltas'): void {
    console.log('🔄 Cambio de tipo de cálculo:', tipo);
    
    if (this.tipoCalculo === tipo) {
      console.log('⚠️ Mismo tipo de cálculo, ignorando');
      return;
    }
    
    this.tipoCalculo = tipo;
    
    if (tipo === 'dias') {
      this.filtroRutasIds = [];
      console.log('🗑️ Filtro de rutas limpiado (modo días)');
    }
    
    this.currentPage = 1;
    this.obtenerCargas();
  }

  onSearchChange(): void {
    console.log('🔍 Búsqueda cambiada:', this.terminoBusqueda);
    // ⭐ MODIFICADO: Enviar un valor único cada vez
    this.searchSubject.next(Date.now().toString());
  }

  onPageChange(page: number): void {
    console.log('📄 Cambio de página:', page);
    this.currentPage = page;
    this.obtenerCargas();
  }

  toggleRutasDropdown(): void {
    this.rutasDropdownOpen = !this.rutasDropdownOpen;
    console.log('🔽 Dropdown rutas:', this.rutasDropdownOpen ? 'abierto' : 'cerrado');
  }

  // ⭐ COMPLETAMENTE REDISEÑADO: Mejor manejo de checkboxes
  onRutaToggle(rutaId: number, event: any): void {
    // Prevenir el comportamiento predeterminado
    event.stopPropagation();
    
    const isChecked = event.target.checked;
    console.log('🔄 Toggle ruta:', rutaId, 'checked:', isChecked);
    
    if (this.tipoCalculo === 'dias') {
      alert('El filtro por ruta no está disponible en cálculo por días');
      event.target.checked = false;
      return;
    }

    // Crear nuevo array sin mutación
    let nuevasRutas: number[];
    
    if (isChecked) {
      // Agregar ruta si no existe
      if (!this.filtroRutasIds.includes(rutaId)) {
        nuevasRutas = [...this.filtroRutasIds, rutaId];
      } else {
        nuevasRutas = this.filtroRutasIds;
      }
    } else {
      // Remover ruta
      nuevasRutas = this.filtroRutasIds.filter(id => id !== rutaId);
    }
    
    // Solo actualizar si hay cambios
    if (JSON.stringify(nuevasRutas) !== JSON.stringify(this.filtroRutasIds)) {
      this.filtroRutasIds = nuevasRutas;
      console.log('📋 Rutas seleccionadas actualizadas:', this.filtroRutasIds);
      
      // ⭐ MODIFICADO: Enviar señal única
      this.searchSubject.next(Date.now().toString());
    } else {
      console.log('⚠️ Sin cambios en las rutas seleccionadas');
    }
  }

  isRutaSeleccionada(rutaId: number): boolean {
    return this.filtroRutasIds.includes(rutaId);
  }

  limpiarFiltros(): void {
    console.log('🧹 Limpiando todos los filtros');
    
    this.terminoBusqueda = '';
    this.filtroRutasIds = [];
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.currentPage = 1;
    
    this.obtenerCargas();
  }

  onFechaChange(): void {
    console.log('📅 Fechas cambiadas:', this.filtroFechaDesde, '->', this.filtroFechaHasta);
    
    if (this.filtroFechaDesde && this.filtroFechaHasta) {
      if (new Date(this.filtroFechaDesde) > new Date(this.filtroFechaHasta)) {
        alert('La fecha "Desde" no puede ser mayor que la fecha "Hasta"');
        this.filtroFechaHasta = '';
        return;
      }
    }
    
    // ⭐ MODIFICADO: Enviar señal única
    this.searchSubject.next(Date.now().toString());
  }

  abrirModalEditar(carga: any): void {
    if (!carga || carga.id_carga === undefined) {
      console.error('❌ La carga no tiene id_carga, no se puede editar.');
      alert('Error: No se puede identificar esta carga para editarla.');
      return;
    }

    console.log('✏️ Abriendo modal de edición para carga:', carga.id_carga);

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
        console.log('✅ Datos de carga cargados para edición');
      },
      error: (err) => {
        console.error("❌ Error al obtener detalle de la carga:", err);
        alert('Error al cargar los datos para editar. Intente de nuevo.');
        this.cerrarModalEditar();
      }
    });
  }

  cerrarModalEditar(): void {
    console.log('❌ Cerrando modal de edición');
    
    this.modalEditarVisible = false;
    this.cargaEditando = null;
    this.cargaOriginal = null;
    this.cargandoEdicion = false;
    this.guardandoEdicion = false;
    
    document.body.style.overflow = 'auto';
    
    this.formEdicion = {
      fecha_operacion: '',
      km_inicial: 0,
      km_final: 0,
      litros_cargados: 0,
      id_ruta: null
    };
  }

  detectarCambios(): boolean {
    if (!this.cargaOriginal) return false;

    const fechaOriginal = this.formatearFechaParaInput(this.cargaOriginal.fecha_operacion);
    const cambioFecha = this.formEdicion.fecha_operacion !== fechaOriginal;
    const cambioKmInicial = this.formEdicion.km_inicial !== this.obtenerNumero(this.cargaOriginal.km_inicial);
    const cambioKmFinal = this.formEdicion.km_final !== this.obtenerNumero(this.cargaOriginal.km_final);
    const cambioLitros = this.formEdicion.litros_cargados !== this.obtenerNumero(this.cargaOriginal.litros_cargados);
    const cambioRuta = this.formEdicion.id_ruta !== (this.cargaOriginal.id_ruta || null);

    return cambioFecha || cambioKmInicial || cambioKmFinal || cambioLitros || cambioRuta;
  }

  obtenerResumenCambios(): string[] {
    if (!this.cargaOriginal) return [];
    
    const cambios: string[] = [];

    const fechaOriginal = this.formatearFechaParaInput(this.cargaOriginal.fecha_operacion);
    if (this.formEdicion.fecha_operacion !== fechaOriginal) {
      cambios.push(`Fecha: ${this.formatearFecha(this.cargaOriginal.fecha_operacion)} → ${this.formatearFecha(this.formEdicion.fecha_operacion)}`);
    }

    if (this.formEdicion.km_inicial !== this.obtenerNumero(this.cargaOriginal.km_inicial)) {
      cambios.push(`KM Inicial: ${this.cargaOriginal.km_inicial} → ${this.formEdicion.km_inicial}`);
    }

    if (this.formEdicion.km_final !== this.obtenerNumero(this.cargaOriginal.km_final)) {
      const kmRecorridosAntes = this.obtenerNumero(this.cargaOriginal.km_recorridos);
      const kmRecorridosDespues = this.formEdicion.km_final - this.formEdicion.km_inicial;
      cambios.push(`KM Final: ${this.cargaOriginal.km_final} → ${this.formEdicion.km_final}`);
      cambios.push(`  → KM Recorridos: ${kmRecorridosAntes} km → ${kmRecorridosDespues} km`);
    }

    if (this.formEdicion.litros_cargados !== this.obtenerNumero(this.cargaOriginal.litros_cargados)) {
      cambios.push(`Litros: ${this.cargaOriginal.litros_cargados} L → ${this.formEdicion.litros_cargados} L`);
    }

    const rutaOriginalId = this.cargaOriginal.id_ruta || null;
    if (this.formEdicion.id_ruta !== rutaOriginalId) {
      const rutaAntes = rutaOriginalId 
        ? (this.rutas.find(r => r.id_ruta === rutaOriginalId)?.nombre_ruta || 'Ruta desconocida')
        : 'Sin ruta (Cálculo por días)';
      const rutaDespues = this.formEdicion.id_ruta 
        ? (this.rutas.find(r => r.id_ruta === this.formEdicion.id_ruta)?.nombre_ruta || 'Ruta desconocida')
        : 'Sin ruta (Cálculo por días)';
      cambios.push(`Ruta: ${rutaAntes} → ${rutaDespues}`);
    }

    return cambios;
  }

  calcularKmRecorridos(): number {
    const kmRecorridos = this.formEdicion.km_final - this.formEdicion.km_inicial;
    return Math.max(0, kmRecorridos);
  }

  calcularRendimientoEstimado(): number {
    const kmRecorridos = this.calcularKmRecorridos();
    if (this.formEdicion.litros_cargados <= 0) return 0;
    return kmRecorridos / this.formEdicion.litros_cargados;
  }

  obtenerNombreRuta(idRuta: number | null): string {
    if (!idRuta) return 'Sin ruta (Cálculo por días)';
    const ruta = this.rutas.find(r => r.id_ruta === idRuta);
    return ruta ? ruta.nombre_ruta : 'Ruta no encontrada';
  }

  esSuperUsuario(): boolean {
    return this.authService.hasRole(['SuperUsuario']);
  }

  guardarEdicion(): void {
    if (!this.cargaEditando || !this.cargaEditando.id_carga) {
      alert('No hay una carga seleccionada para guardar.');
      return;
    }
    
    if (this.formEdicion.km_final <= this.formEdicion.km_inicial) {
       alert('El KM Final debe ser mayor que el KM Inicial.');
       return;
    }
    if (this.formEdicion.litros_cargados <= 0) {
       alert('Los litros cargados deben ser mayores a 0.');
       return;
    }
    if (this.formEdicion.id_ruta && !this.formEdicion.id_ruta) {
       alert('Debe seleccionar una ruta.');
       return;
    }

    console.log('💾 Guardando edición de carga:', this.cargaEditando.id_carga);

    this.guardandoEdicion = true;
    
    const idCarga = this.cargaEditando.id_carga;
    
    const datosAActualizar = {
       fecha_operacion: new Date(this.formEdicion.fecha_operacion).toISOString(),
       km_inicial: this.formEdicion.km_inicial,
       km_final: this.formEdicion.km_final,
       litros_cargados: this.formEdicion.litros_cargados,
       id_ruta: this.formEdicion.id_ruta
    };

    this.http.put(`${this.apiUrl}/${idCarga}`, datosAActualizar).subscribe({
      next: (response) => {
        this.guardandoEdicion = false;
        alert('Carga actualizada exitosamente. Los datos se han recalculado.');
        console.log('✅ Carga actualizada correctamente');
        this.cerrarModalEditar();
        
        this.obtenerCargas(); 
      },
      error: (err) => {
        this.guardandoEdicion = false;
        console.error("❌ Error al guardar la edición:", err);
        alert(`Error al guardar: ${err.error?.message || 'Error desconocido'}`);
      }
    });
  }

  public formatearFechaParaInput(fecha: string): string {
    if (!fecha) {
      return new Date().toISOString().slice(0, 16);
    }
    try {
      const d = new Date(fecha);
      const offset = d.getTimezoneOffset() * 60000;
      const localDate = new Date(d.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
    } catch (e) {
      console.error("❌ Error formateando fecha:", e);
      return new Date().toISOString().slice(0, 16);
    }
  }

  private registrarAuditoriaExportacion(tipo: 'PDF' | 'EXCEL', totalRegistros: number): void {
    const detalles = {
      total_registros: totalRegistros,
      filtros_aplicados: {
        busqueda: this.terminoBusqueda,
        tipo_calculo: this.tipoCalculo,
        fecha_desde: this.filtroFechaDesde,
        fecha_hasta: this.filtroFechaHasta,
        rutas_ids: this.filtroRutasIds
      }
    };

    this.http.post(`${environment.apiUrl}/superAdmin/registrar-evento`, {
      tipo_accion: `EXPORTAR_${tipo}`,
      modulo: 'HISTORIAL_COMBUSTIBLE',
      detalles: detalles
    }).subscribe({
      next: () => console.log(`✅ Auditoría de exportación ${tipo} registrada.`),
      error: (err) => console.warn('⚠️ No se pudo registrar la auditoría de exportación', err)
    });
  }

  async exportarAPDF(): Promise<void> {
    this.exportando = true;
    console.log('📄 Iniciando exportación a PDF...');

    try {
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

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 150, 243);
      doc.text('HISTORIAL DE CARGAS DE COMBUSTIBLE', 148.5, 15, { align: 'center' });

      const subtitulo = this.tipoCalculo === 'vueltas' ? 'Cálculo por: Vueltas' : 'Cálculo por: Días';
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(subtitulo, 148.5, 22, { align: 'center' });

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

      const totalLitros = todasLasCargas.reduce((acc, c) => acc + this.obtenerNumero(c.litros_cargados), 0);
      const totalKm = todasLasCargas.reduce((acc, c) => acc + this.obtenerNumero(c.km_recorridos), 0);
      const promedioRendimiento = totalLitros > 0 ? totalKm / totalLitros : 0;

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
      this.registrarAuditoriaExportacion('PDF', todasLasCargas.length);
      console.log('✅ PDF generado exitosamente con', todasLasCargas.length, 'registros');
    } catch (error) {
      console.error('❌ Error al exportar a PDF:', error);
      alert('Error al exportar a PDF: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      this.exportando = false;
    }
  }

  async exportarAExcel(): Promise<void> {
    this.exportandoExcel = true;
    console.log('📊 Iniciando exportación a Excel...');

    try {
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
      this.registrarAuditoriaExportacion('EXCEL', todasLasCargas.length);
      console.log('✅ Excel generado exitosamente con', todasLasCargas.length, 'registros');
    } catch (error) {
      console.error('❌ Error detallado al exportar Excel:', error);
      alert('Error al exportar a Excel. Revisa la consola para más detalles.');
    } finally {
      this.exportandoExcel = false;
    }
  }

  public formatearFecha(fecha: string): string {
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

  public obtenerNumero(valor: any): number {
    if (valor === null || valor === undefined) return 0;
    const num = parseFloat(valor);
    return isNaN(num) ? 0 : num;
  }

  public clasificarRendimiento(
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
  
  abrirModalInfo(carga: any): void {
    if (!carga || carga.id_carga === undefined) {
      console.error('❌ La carga no tiene id_carga');
      alert('Error: No se puede obtener la información de esta carga.');
      return;
    }

    console.log('ℹ️ Abriendo modal de información para carga:', carga.id_carga);

    this.modalInfoVisible = true;
    this.cargandoInfo = true;
    this.cargaInfo = null;

    document.body.style.overflow = 'hidden';

    this.http.get<any>(`${this.apiUrl}/detalle/${carga.id_carga}`).subscribe({
      next: (datos) => {
        console.log('✅ Datos recibidos del detalle:', datos);
        
        if (!datos.clasificacion_rendimiento && datos.rendimiento_calculado) {
          datos.clasificacion_rendimiento = this.clasificarRendimiento(
            this.obtenerNumero(datos.rendimiento_calculado),
            datos.rendimiento_excelente,
            datos.rendimiento_bueno,
            datos.rendimiento_regular
          );
        }
        
        this.cargaInfo = datos;
        this.cargandoInfo = false;
      },
      error: (err) => {
        console.error("❌ Error al obtener detalle de la carga:", err);
        alert('Error al cargar la información. Intente de nuevo.');
        this.cerrarModalInfo();
      }
    });
  }

  cerrarModalInfo(): void {
    console.log('❌ Cerrando modal de información');
    
    this.modalInfoVisible = false;
    this.cargaInfo = null;
    this.cargandoInfo = false;
    
    document.body.style.overflow = 'auto';
  }

  calcularDesviacion(carga: any): number {
    if (!carga) return 0;

    if (carga.desviacion_km !== undefined && carga.desviacion_km !== null) {
      return this.obtenerNumero(carga.desviacion_km);
    }
    
    const kmEsperados = this.obtenerNumero(carga.km_esperados) || this.obtenerNumero(carga.km_esperados_ruta);
    
    if (kmEsperados === 0) return 0;
    
    const kmRecorridos = this.obtenerNumero(carga.km_recorridos);
    const desviacion = kmRecorridos - kmEsperados;
    
    return desviacion;
  }

  tieneDesviacionSignificativa(carga: any): boolean {
    if (!carga) return false;
    
    const desviacion = this.calcularDesviacion(carga);
    const valorAbsoluto = Math.abs(desviacion);
    const esSignificativa = valorAbsoluto > 15;
    
    if (esSignificativa) {
       console.log('⚠️ Desviación significativa detectada:', {
          id: carga.id_carga,
          desviacion: desviacion,
          motivo: carga.motivo_desviacion
       });
    }
    
    return esSignificativa;
  }

  obtenerColorClasificacion(clasificacion: string): string {
    switch(clasificacion) {
      case 'Excelente': return 'text-green-600 bg-green-50';
      case 'Bueno': return 'text-blue-600 bg-blue-50';
      case 'Regular': return 'text-yellow-600 bg-yellow-50';
      case 'Malo': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  }
}