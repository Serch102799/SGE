import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';
import { AuthService } from '../../../services/auth.service';
import { Location } from '@angular/common';

// --- Interfaces ---
interface Empleado {
  id_empleado: number;
  nombre_completo: string;
}

interface Refaccion {
  id_refaccion: number;
  nombre_refaccion: string;
  descripcion: string;
}

interface Insumo {
  id_insumo: number;
  nombre_insumo: string;
  stock_actual: number;
}

interface LoteRefaccion {
  id_lote_refaccion: number; // Asegúrate que el backend devuelva este nombre
  cantidad_disponible: number;
  costo_unitario_final: number;
}

interface AjusteInventario {
  id_ajuste: number;
  id_empleado: number;
  tipo_ajuste: string;
  motivo: string;
  fecha_creacion: string; // Asumo que el backend la renombra
  nombre_empleado?: string;
  total_detalles?: number;
}

// Interfaz para el detalle en el frontend
interface DetalleAjusteEditable {
  id_detalle?: number;
  id_refaccion?: number | null;
  id_insumo?: number | null;
  id_lote?: number | null;
  cantidad: number;
  costo_ajuste: number;
  nombre_item?: string;
  tipo_item?: 'refaccion' | 'insumo'; 
}


@Component({
  selector: 'app-ajuste-inventario',
  standalone: false,
  templateUrl: './ajuste-inventario.component.html',
  styleUrls: ['./ajuste-inventario.component.css']
})
export class AjusteInventarioComponent implements OnInit, OnDestroy {

  // URL base de la API
  private apiUrlBase = environment.apiUrl;
  
  // Listados
  ajustes: AjusteInventario[] = [];
  empleados: Empleado[] = [];
  refacciones: Refaccion[] = [];
  insumos: Insumo[] = [];
  lotesDisponibles: LoteRefaccion[] = [];

  // Paginación y búsqueda
  currentPage: number = 1;
  itemsPerPage: number = 15;
  totalItems: number = 0;
  terminoBusqueda: string = '';
  
  // Filtros
  filtroTipoAjuste: string = '';
  filtroFechaDesde: string = '';
  filtroFechaHasta: string = '';
  
  private searchSubject: Subject<void> = new Subject<void>();
  private searchSubscription?: Subscription;

  // Modal y Estado de Edición/Creación
  modalEditarVisible: boolean = false;
  // 'ajusteEditando' guarda el ajuste actual. Si tiene 'id_ajuste', es Edición. Si no, es Creación.
  ajusteEditando: Partial<AjusteInventario> = {}; 
  cargandoEdicion: boolean = false;
  guardandoEdicion: boolean = false;
  ajusteOriginal: any = null; // Para detectar cambios

  // Formulario del modal
  formEdicionMaestro = {
    id_empleado: null as number | null,
    tipo_ajuste: '',
    motivo: ''
  };

  detallesEdicion: DetalleAjusteEditable[] = [];

  // Tipos de ajuste
  tiposAjuste = [
    { value: 'ENTRADA', label: 'Entrada (Suma stock)' },
    { value: 'SALIDA', label: 'Salida (Resta stock)' },
    { value: 'REVALORIZACION', label: 'Revalorización (Ajusta costo)' }
  ];

  // Notificaciones
  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };

  constructor(
    private http: HttpClient, 
    public authService: AuthService,
    private location: Location
  ) { }

  ngOnInit(): void {
    this.cargarEmpleados();
    this.cargarRefacciones();
    this.cargarInsumos();
    
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      startWith(undefined)
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerAjustes();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    document.body.style.overflow = 'auto'; // Restaurar scroll
  }

  // ============================================
  // MÉTODOS DE CARGA DE DATOS
  // ============================================

  cargarEmpleados(): void {
    this.http.get<Empleado[]>(`${this.apiUrlBase}/empleados`).subscribe({
      next: (data) => this.empleados = data,
      error: (err) => console.error("Error al cargar empleados:", err)
    });
  }

  cargarRefacciones(): void {
    this.http.get<Refaccion[]>(`${this.apiUrlBase}/refacciones/buscar`).subscribe({
      next: (data) => this.refacciones = data,
      error: (err) => console.error("Error al cargar refacciones:", err)
    });
  }

  cargarInsumos(): void {
    this.http.get<Insumo[]>(`${this.apiUrlBase}/insumos/buscar`).subscribe({
      next: (data) => this.insumos = data,
      error: (err) => console.error("Error al cargar insumos:", err)
    });
  }

  cargarLotesRefaccion(idRefaccion: number): Promise<LoteRefaccion[]> {
    // Devuelve una promesa para poder esperar a que carguen los lotes
    return new Promise((resolve, reject) => {
      this.http.get<LoteRefaccion[]>(`${this.apiUrlBase}/lotes-refaccion/por-refaccion/${idRefaccion}`).subscribe({
        next: (data) => {
          this.lotesDisponibles = data;
          resolve(data);
        },
        error: (err) => {
          console.error("Error al cargar lotes:", err);
          this.lotesDisponibles = [];
          reject(err);
        }
      });
    });
  }

  // ============================================
  // MÉTODOS DE LISTADO Y FILTRADO
  // ============================================

  private construirParametros(page: number = 1): HttpParams {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim());

    if (this.filtroTipoAjuste) params = params.set('tipo_ajuste', this.filtroTipoAjuste);
    if (this.filtroFechaDesde) params = params.set('fecha_desde', this.filtroFechaDesde);
    if (this.filtroFechaHasta) params = params.set('fecha_hasta', this.filtroFechaHasta);

    return params;
  }

  obtenerAjustes(): void {
    const params = this.construirParametros(this.currentPage);
    
    this.http.get<{ total: number, data: AjusteInventario[] }>(`${this.apiUrlBase}/ajuste-inventario`, { params }).subscribe({
      next: (response) => {
        this.ajustes = response.data || [];
        this.totalItems = response.total || 0;
      },
      error: (err) => {
        console.error("Error al obtener ajustes:", err);
        this.ajustes = [];
        this.totalItems = 0;
      }
    });
  }

  onSearchChange(): void {
    this.searchSubject.next();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerAjustes();
  }

  limpiarFiltros(): void {
    this.terminoBusqueda = '';
    this.filtroTipoAjuste = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.searchSubject.next();
  }

  // ============================================
  // GESTIÓN DEL MODAL (CREAR Y EDITAR)
  // ============================================

  /**
   * Abre el modal en modo CREACIÓN.
   */
  abrirModalCrear(): void {
    this.modalEditarVisible = true;
    this.cargandoEdicion = false;
    this.guardandoEdicion = false;
    this.ajusteEditando = {}; // Objeto vacío indica MODO CREACIÓN
    this.ajusteOriginal = null;
    this.lotesDisponibles = [];
    document.body.style.overflow = 'hidden';

    // Resetear formulario
    this.formEdicionMaestro = {
      id_empleado: this.authService.getCurrentUser()?.id || null, // Asignar usuario actual
      tipo_ajuste: '',
      motivo: ''
    };
    this.detallesEdicion = [];
  }

  /**
   * Abre el modal en modo EDICIÓN.
   */
  abrirModalEditar(ajuste: AjusteInventario): void {
    if (!this.esSuperUsuarioOAdmin()) {
      this.mostrarNotificacion('Acceso Denegado', 'Solo Administradores y SuperUsuarios pueden editar ajustes.', 'advertencia');
      return;
    }

    this.modalEditarVisible = true;
    this.cargandoEdicion = true;
    this.ajusteEditando = { ...ajuste }; // Con ID, indica MODO EDICIÓN
    this.ajusteOriginal = null;
    this.lotesDisponibles = [];
    document.body.style.overflow = 'hidden';

    // Obtener detalle completo del ajuste
    this.http.get<any>(`${this.apiUrlBase}/ajuste-inventario/detalle/${ajuste.id_ajuste}`).subscribe({
      next: (datosAjuste) => {
        // Copia profunda para detectar cambios
        this.ajusteOriginal = JSON.parse(JSON.stringify(datosAjuste)); 
        
        this.formEdicionMaestro = {
          id_empleado: datosAjuste.id_empleado,
          tipo_ajuste: datosAjuste.tipo_ajuste,
          motivo: datosAjuste.motivo
        };

        this.detallesEdicion = datosAjuste.detalles.map((det: any): DetalleAjusteEditable => ({
          id_detalle: det.id_detalle,
          id_refaccion: det.id_refaccion || null,
          id_insumo: det.id_insumo || null,
          id_lote: det.id_lote_refaccion || null,
          cantidad: det.cantidad,
          costo_ajuste: det.costo_ajuste || 0,
          nombre_item: det.nombre_item, // Asumo que el API de detalle lo trae
          tipo_item: det.id_refaccion ? 'refaccion' : 'insumo'
        }));

        this.cargandoEdicion = false;
      },
      error: (err) => {
        console.error("Error al obtener detalle del ajuste:", err);
        this.mostrarNotificacion('Error', 'Error al cargar los datos del ajuste. Intente de nuevo.', 'error');
        this.cerrarModalEditar();
      }
    });
  }

  cerrarModalEditar(): void {
    this.modalEditarVisible = false;
    this.ajusteEditando = {};
    this.ajusteOriginal = null;
    this.cargandoEdicion = false;
    this.guardandoEdicion = false;
    this.lotesDisponibles = [];
    document.body.style.overflow = 'auto';
    
    // Resetear formularios
    this.formEdicionMaestro = { id_empleado: null, tipo_ajuste: '', motivo: '' };
    this.detallesEdicion = [];
  }

  /**
   * Guarda los cambios (sea Creación o Edición)
   */
  guardarAjuste(): void {
    if (!this.validarFormulario()) {
      return; // La validación ya muestra la notificación
    }

    const esModoEdicion = this.ajusteEditando && this.ajusteEditando.id_ajuste;

    if (esModoEdicion && !this.detectarCambios()) {
      this.mostrarNotificacion('Sin Cambios', 'No se detectaron cambios para guardar.', 'advertencia');
      return;
    }

    const mensajeConfirmacion = esModoEdicion 
      ? `¿Está seguro de guardar los cambios en este ajuste?`
      : `¿Crear este nuevo ajuste de inventario?\n\n⚠️ Esta acción afectará el stock y/o costos del inventario.`;

    if (!confirm(mensajeConfirmacion)) return;

    this.guardandoEdicion = true;

    // Preparar el payload
    const payload = {
      maestro: this.formEdicionMaestro,
      detalles: this.detallesEdicion.map(det => ({
        id_detalle: det.id_detalle, // (null o undefined si es nuevo)
        id_refaccion: det.id_refaccion,
        id_insumo: det.id_insumo,
        id_lote: det.id_lote, // El backend debe llamarlo 'id_lote_refaccion'
        cantidad: det.cantidad,
        costo_ajuste: det.costo_ajuste
      }))
    };

    // Decidir si llamar a POST (Crear) o PUT (Actualizar)
    if (esModoEdicion) {
      this.actualizarAjuste(this.ajusteEditando.id_ajuste!, payload);
    } else {
      this.crearAjuste(payload);
    }
  }

  /**
   * Lógica de CREACIÓN (POST)
   */
  private crearAjuste(payload: any): void {
    this.http.post(`${this.apiUrlBase}/ajuste-inventario`, payload).subscribe({
      next: () => {
        this.guardandoEdicion = false;
        this.mostrarNotificacion('Éxito', 'Ajuste creado exitosamente.', 'exito');
        this.cerrarModalEditar();
        this.obtenerAjustes(); // Recargar la lista
      },
      error: (error) => {
        this.guardandoEdicion = false;
        const mensaje = error.error?.message || 'Error desconocido al crear el ajuste.';
        this.mostrarNotificacion('Error', mensaje, 'error');
      }
    });
  }

  /**
   * Lógica de ACTUALIZACIÓN (PUT)
   */
  private actualizarAjuste(idAjuste: number, payload: any): void {
    this.http.put(`${this.apiUrlBase}/ajuste-inventario/${idAjuste}`, payload).subscribe({
      next: () => {
        this.guardandoEdicion = false;
        this.mostrarNotificacion('Éxito', 'Ajuste actualizado exitosamente.', 'exito');
        this.cerrarModalEditar();
        this.obtenerAjustes(); // Recargar la lista
      },
      error: (error) => {
        this.guardandoEdicion = false;
        const mensaje = error.error?.message || 'Error desconocido al actualizar.';
        this.mostrarNotificacion('Error', mensaje, 'error');
      }
    });
  }

  // ============================================
  // VALIDACIONES Y DETECCIÓN DE CAMBIOS
  // ============================================

  validarFormulario(): boolean {
    if (!this.formEdicionMaestro.id_empleado) {
      this.mostrarNotificacion('Dato Faltante', 'Debe seleccionar un empleado.');
      return false;
    }

    if (!this.formEdicionMaestro.tipo_ajuste) {
      this.mostrarNotificacion('Dato Faltante', 'Debe seleccionar un tipo de ajuste.');
      return false;
    }

    if (!this.formEdicionMaestro.motivo || this.formEdicionMaestro.motivo.trim() === '') {
      this.mostrarNotificacion('Dato Faltante', 'El campo "Motivo" es obligatorio.');
      return false;
    }

    if (this.detallesEdicion.length === 0) {
      this.mostrarNotificacion('Detalles Vacíos', 'Debe agregar al menos un ítem al ajuste.');
      return false;
    }

    for (const [index, detalle] of this.detallesEdicion.entries()) {
      const numDetalle = index + 1;
      
      if (!detalle.id_refaccion && !detalle.id_insumo) {
        this.mostrarNotificacion(`Detalle ${numDetalle} Incompleto`, 'Debe seleccionar una refacción o un insumo.');
        return false;
      }

      const tipo = this.formEdicionMaestro.tipo_ajuste;

      if (tipo === 'ENTRADA' && detalle.cantidad <= 0) {
        this.mostrarNotificacion(`Detalle ${numDetalle}`, 'Para ENTRADA, la cantidad debe ser positiva (mayor a 0).');
        return false;
      }
      
      if (tipo === 'SALIDA' && detalle.cantidad >= 0) {
        this.mostrarNotificacion(`Detalle ${numDetalle}`, 'Para SALIDA, la cantidad debe ser negativa (menor a 0).');
        return false;
      }

      if (tipo === 'REVALORIZACION' && detalle.cantidad !== 0) {
        this.mostrarNotificacion(`Detalle ${numDetalle}`, 'Para REVALORIZACIÓN, la cantidad debe ser 0. Solo se ajusta el costo.');
        return false;
      }

      if (detalle.id_refaccion && (tipo === 'SALIDA' || tipo === 'REVALORIZACION') && !detalle.id_lote) {
        this.mostrarNotificacion(`Detalle ${numDetalle}`, `Para ${tipo} de refacción, debe seleccionar un Lote específico.`);
        return false;
      }
    }

    return true;
  }

  detectarCambios(): boolean {
    if (!this.ajusteOriginal) return false;

    try {
      // Cambios en maestro
      if (
        this.formEdicionMaestro.id_empleado !== this.ajusteOriginal.id_empleado ||
        this.formEdicionMaestro.tipo_ajuste !== this.ajusteOriginal.tipo_ajuste ||
        this.formEdicionMaestro.motivo !== this.ajusteOriginal.motivo
      ) {
        return true;
      }

      // Cambios en detalles
      if (this.detallesEdicion.length !== this.ajusteOriginal.detalles.length) {
        return true;
      }

      // Comparar cada detalle
      for (const detalleActual of this.detallesEdicion) {
        // Buscar el detalle original
        const detalleOriginal = this.ajusteOriginal.detalles.find((d: any) => d.id_detalle === detalleActual.id_detalle);
        
        // Si es un detalle nuevo (no tiene id_detalle) o no lo encuentra, hay cambios
        if (!detalleOriginal) return true; 

        if (
          detalleActual.cantidad !== detalleOriginal.cantidad ||
          detalleActual.costo_ajuste !== (detalleOriginal.costo_ajuste || 0) ||
          detalleActual.id_refaccion !== (detalleOriginal.id_refaccion || null) ||
          detalleActual.id_insumo !== (detalleOriginal.id_insumo || null) ||
          detalleActual.id_lote !== (detalleOriginal.id_lote_refaccion || null)
        ) {
          return true;
        }
      }
    } catch (e) {
      console.error("Error detectando cambios", e);
      return true; // Si falla la detección, mejor asumir que hay cambios
    }

    return false;
  }

  // ============================================
  // GESTIÓN DE DETALLES EN EL MODAL
  // ============================================

  agregarDetalle(): void {
    this.detallesEdicion.push({
      tipo_item: 'refaccion',
      id_refaccion: null,
      id_insumo: null,
      id_lote: null,
      cantidad: 0,
      costo_ajuste: 0,
    });
  }

  eliminarDetalle(index: number): void {
    if (confirm('¿Está seguro de eliminar este detalle?')) {
      this.detallesEdicion.splice(index, 1);
    }
  }

  onTipoItemChange(detalle: DetalleAjusteEditable): void {
    // Limpiar el otro campo
    if (detalle.tipo_item === 'refaccion') {
      detalle.id_insumo = null;
    } else {
      detalle.id_refaccion = null;
      detalle.id_lote = null;
      this.lotesDisponibles = []; // Limpiar lotes si cambia a insumo
    }
  }

  async onRefaccionChange(detalle: DetalleAjusteEditable): Promise<void> {
    detalle.id_lote = null; // Resetear lote
    if (detalle.id_refaccion) {
      try {
        await this.cargarLotesRefaccion(detalle.id_refaccion);
        // Si es Revalorización o Salida y solo hay un lote, auto-seleccionarlo
        const tipo = this.formEdicionMaestro.tipo_ajuste;
        if ((tipo === 'SALIDA' || tipo === 'REVALORIZACION') && this.lotesDisponibles.length === 1) {
          detalle.id_lote = this.lotesDisponibles[0].id_lote_refaccion;
        }
      } catch (error) {
        this.mostrarNotificacion('Error', 'No se pudieron cargar los lotes para esta refacción.', 'error');
      }
    } else {
      this.lotesDisponibles = [];
    }
  }

  /**
   * Deshabilita campos en el detalle según el tipo de ajuste
   */
  esCampoDetalleDeshabilitado(detalle: DetalleAjusteEditable, campo: 'cantidad' | 'costo' | 'lote'): boolean {
    const tipo = this.formEdicionMaestro.tipo_ajuste;
    
    if (!tipo) return true; // Deshabilitado si no hay tipo

    if (campo === 'cantidad') {
      return tipo === 'REVALORIZACION';
    }
    
    if (campo === 'costo') {
      return tipo === 'SALIDA';
    }

    if (campo === 'lote') {
      // Solo se habilita para refacciones en Salida o Revalorización
      if (!detalle.id_refaccion) return true;
      return !(tipo === 'SALIDA' || tipo === 'REVALORIZACION');
    }

    return false;
  }

  // ============================================
  // MÉTODOS DE AYUDA (Notificación y Formato)
  // ============================================

  esSuperUsuarioOAdmin(): boolean {
    return this.authService.hasRole(['SuperUsuario', 'Admin']);
  }

  formatearFecha(fecha: string | undefined): string {
    if (!fecha) return '-';
    try {
      return new Date(fecha).toLocaleString('es-MX', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return fecha;
    }
  }

  obtenerBadgeTipoAjuste(tipo: string): string {
    switch(tipo) {
      case 'ENTRADA': return 'badge-entrada';
      case 'SALIDA': return 'badge-salida';
      case 'REVALORIZACION': return 'badge-revalorizacion';
      default: return 'badge-default';
    }
  }

  obtenerNombreEmpleado(idEmpleado: number | null): string {
    if (!idEmpleado) return 'Sin asignar';
    const empleado = this.empleados.find(e => e.id_empleado === idEmpleado);
    return empleado ? empleado.nombre_completo : `ID ${idEmpleado} no encontrado`;
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }

  regresar(): void {
    this.location.back();
  }
}