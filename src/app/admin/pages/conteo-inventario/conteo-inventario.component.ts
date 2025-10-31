import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';
import { AuthService } from '../../../services/auth.service';

interface Empleado {
  id_empleado: number;
  nombre: string;
}

interface Insumo {
  id_insumo: number;
  nombre: string;
  stock_actual: number;
  costo_promedio?: number;
}

interface DetalleInsumo {
  id_detalle?: number;
  id_insumo: number | null;
  nombre_insumo?: string;
  cantidad_contada: number;
  costo_unitario_asignado: number;
  stock_sistema?: number;
  diferencia?: number;
}

interface ConteoMaestro {
  id_conteo: number;
  id_empleado: number;
  fecha_conteo: string;
  observaciones: string;
  estado: string;
  nombre_empleado?: string;
  total_detalles?: number;
}

@Component({
  selector: 'app-conteo-inventario',
  standalone: false,
  templateUrl: './conteo-inventario.component.html',
  styleUrls: ['./conteo-inventario.component.css']
})
export class ConteoInventarioComponent implements OnInit, OnDestroy {

  private apiUrl = `${environment.apiUrl}/conteo-inventario`;
  
  // Listados
  conteos: ConteoMaestro[] = [];
  empleados: Empleado[] = [];
  insumos: Insumo[] = [];

  // Paginación y búsqueda
  currentPage: number = 1;
  itemsPerPage: number = 15;
  totalItems: number = 0;
  terminoBusqueda: string = '';
  
  // Filtros
  filtroEstado: string = '';
  filtroFechaDesde: string = '';
  filtroFechaHasta: string = '';
  
  private searchSubject: Subject<void> = new Subject<void>();
  private searchSubscription?: Subscription;

  // Modal de creación
  modalNuevoVisible: boolean = false;
  guardandoNuevo: boolean = false;

  formNuevoMaestro = {
    id_empleado: null as number | null,
    observaciones: ''
  };

  detallesNuevo: DetalleInsumo[] = [];

  // Modal de edición
  modalEditarVisible: boolean = false;
  conteoEditando: any = null;
  cargandoEdicion: boolean = false;
  guardandoEdicion: boolean = false;
  conteoOriginal: any = null;

  formEdicionMaestro = {
    id_empleado: null as number | null,
    observaciones: '',
    estado: ''
  };

  detallesEdicion: DetalleInsumo[] = [];

  // Estados posibles
  estados = [
    { value: 'PENDIENTE', label: 'Pendiente' },
    { value: 'EN_PROCESO', label: 'En Proceso' },
    { value: 'COMPLETADO', label: 'Completado' },
    { value: 'CANCELADO', label: 'Cancelado' }
  ];

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarEmpleados();
    this.cargarInsumos();
    
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      startWith(undefined)
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerConteos();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    document.body.style.overflow = 'auto';
  }

  // ============================================
  // MÉTODOS DE CARGA DE DATOS
  // ============================================

  cargarEmpleados(): void {
    // Asumiendo que la API devuelve un objeto { data: [...] }
    this.http.get<{ data: Empleado[] }>(`${environment.apiUrl}/empleados?limit=1000`).subscribe({
      next: (response) => {
        this.empleados = response.data; // <--- CORREGIDO
      },
      error: (err) => {
        console.error("Error al cargar empleados:", err);
        this.empleados = [];
      }
    });
  }

  cargarInsumos(): void {
    // Asumiendo que la API devuelve un objeto { data: [...] }
    this.http.get<{ data: Insumo[] }>(`${environment.apiUrl}/insumos?limit=1000`).subscribe({
      next: (response) => {
        this.insumos = response.data; // <--- CORREGIDO
      },
      error: (err) => {
        console.error("Error al cargar insumos:", err);
        this.insumos = [];
      }
    });
  }

  // ============================================
  // MÉTODOS DE LISTADO Y FILTRADO
  // ============================================

  private construirParametros(page: number = 1, limit?: number): HttpParams {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit ? limit.toString() : this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim());

    if (this.filtroEstado) {
      params = params.set('estado', this.filtroEstado);
    }

    if (this.filtroFechaDesde) {
      params = params.set('fecha_desde', this.filtroFechaDesde);
    }

    if (this.filtroFechaHasta) {
      params = params.set('fecha_hasta', this.filtroFechaHasta);
    }

    return params;
  }

  obtenerConteos(): void {
    const params = this.construirParametros(this.currentPage);
    
    this.http.get<{ total: number, data: ConteoMaestro[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.conteos = response.data || [];
        this.totalItems = response.total || 0;
      },
      error: (err) => {
        console.error("Error al obtener conteos:", err);
        this.conteos = [];
        this.totalItems = 0;
      }
    });
  }

  onSearchChange(): void {
    this.searchSubject.next();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerConteos();
  }

  limpiarFiltros(): void {
    this.terminoBusqueda = '';
    this.filtroEstado = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.searchSubject.next();
  }

  // ============================================
  // MODAL DE CREACIÓN
  // ============================================

  abrirModalNuevo(): void {
    this.modalNuevoVisible = true;
    document.body.style.overflow = 'hidden';
    
    this.formNuevoMaestro = {
      id_empleado: null,
      observaciones: ''
    };
    
    this.detallesNuevo = [];
  }

  cerrarModalNuevo(): void {
    this.modalNuevoVisible = false;
    document.body.style.overflow = 'auto';
    
    this.formNuevoMaestro = {
      id_empleado: null,
      observaciones: ''
    };
    
    this.detallesNuevo = [];
    this.guardandoNuevo = false;
  }

  agregarDetalleNuevo(): void {
    this.detallesNuevo.push({
      id_insumo: null,
      cantidad_contada: 0,
      costo_unitario_asignado: 0
    });
  }

  eliminarDetalleNuevo(index: number): void {
    if (confirm('¿Está seguro de eliminar este detalle?')) {
      this.detallesNuevo.splice(index, 1);
    }
  }

  onInsumoChangeNuevo(detalle: DetalleInsumo): void {
    if (detalle.id_insumo) {
      const insumo = this.insumos.find(i => i.id_insumo === detalle.id_insumo);
      if (insumo) {
        detalle.nombre_insumo = insumo.nombre;
        detalle.stock_sistema = insumo.stock_actual;
        detalle.costo_unitario_asignado = insumo.costo_promedio || 0;
      }
    }
  }

  calcularDiferenciaNuevo(detalle: DetalleInsumo): number {
    if (!detalle.stock_sistema) return 0;
    return detalle.cantidad_contada - detalle.stock_sistema;
  }

  guardarNuevo(): void {
    if (!this.validarFormularioNuevo()) {
      return;
    }

    this.guardandoNuevo = true;

    const datosConteo = {
      maestro: {
        id_empleado: this.formNuevoMaestro.id_empleado,
        observaciones: this.formNuevoMaestro.observaciones
      },
      detalles: this.detallesNuevo.map(det => ({
        id_insumo: det.id_insumo,
        cantidad_contada: det.cantidad_contada,
        costo_unitario_asignado: det.costo_unitario_asignado
      }))
    };

    this.http.post<any>(this.apiUrl, datosConteo).subscribe({
      next: (response) => {
        console.log('Conteo creado exitosamente:', response);
        alert('✅ Conteo de inventario creado exitosamente.');
        this.cerrarModalNuevo();
        this.obtenerConteos();
      },
      error: (error) => {
        console.error('Error al crear conteo:', error);
        const mensaje = error.error?.message || error.message || 'Error desconocido';
        alert(`❌ Error al crear: ${mensaje}`);
        this.guardandoNuevo = false;
      }
    });
  }

  validarFormularioNuevo(): boolean {
    if (!this.formNuevoMaestro.id_empleado) {
      alert('Debe seleccionar un empleado');
      return false;
    }

    if (this.detallesNuevo.length === 0) {
      alert('Debe agregar al menos un detalle');
      return false;
    }

    for (const detalle of this.detallesNuevo) {
      if (!detalle.id_insumo) {
        alert('Todos los detalles deben tener un insumo seleccionado');
        return false;
      }

      if (detalle.cantidad_contada < 0) {
        alert('La cantidad contada no puede ser negativa');
        return false;
      }

      if (detalle.costo_unitario_asignado < 0) {
        alert('El costo unitario no puede ser negativo');
        return false;
      }
    }

    return true;
  }

  // ============================================
  // MODAL DE EDICIÓN
  // ============================================

  abrirModalEditar(conteo: ConteoMaestro): void {
    if (!this.esSuperUsuarioOAdmin()) {
      alert('Solo los Administradores y SuperUsuarios pueden editar conteos');
      return;
    }

    this.conteoEditando = { ...conteo };
    this.modalEditarVisible = true;
    this.cargandoEdicion = true;
    this.conteoOriginal = null;
    
    document.body.style.overflow = 'hidden';

    this.http.get<any>(`${this.apiUrl}/detalle/${conteo.id_conteo}`).subscribe({
      next: (datosConteo) => {
        this.conteoOriginal = { ...datosConteo };
        
        this.formEdicionMaestro = {
          id_empleado: datosConteo.id_empleado,
          observaciones: datosConteo.observaciones,
          estado: datosConteo.estado
        };

        this.detallesEdicion = datosConteo.detalles.map((det: any) => ({
          id_detalle: det.id_detalle,
          id_insumo: det.id_insumo,
          nombre_insumo: det.nombre_insumo,
          cantidad_contada: det.cantidad_contada,
          costo_unitario_asignado: det.costo_unitario_asignado,
          stock_sistema: det.stock_actual,
          diferencia: det.cantidad_contada - det.stock_actual
        }));

        this.cargandoEdicion = false;
      },
      error: (err) => {
        console.error("Error al obtener detalle del conteo:", err);
        alert('Error al cargar los datos del conteo. Intente de nuevo.');
        this.cerrarModalEditar();
      }
    });
  }

  cerrarModalEditar(): void {
    this.modalEditarVisible = false;
    this.conteoEditando = null;
    this.conteoOriginal = null;
    this.cargandoEdicion = false;
    this.guardandoEdicion = false;
    
    document.body.style.overflow = 'auto';
    
    this.formEdicionMaestro = {
      id_empleado: null,
      observaciones: '',
      estado: ''
    };
    
    this.detallesEdicion = [];
  }

  agregarDetalleEdicion(): void {
    this.detallesEdicion.push({
      id_insumo: null,
      cantidad_contada: 0,
      costo_unitario_asignado: 0
    });
  }

  eliminarDetalleEdicion(index: number): void {
    if (confirm('¿Está seguro de eliminar este detalle?')) {
      this.detallesEdicion.splice(index, 1);
    }
  }

  onInsumoChangeEdicion(detalle: DetalleInsumo): void {
    if (detalle.id_insumo) {
      const insumo = this.insumos.find(i => i.id_insumo === detalle.id_insumo);
      if (insumo) {
        detalle.nombre_insumo = insumo.nombre;
        detalle.stock_sistema = insumo.stock_actual;
        if (!detalle.costo_unitario_asignado) {
          detalle.costo_unitario_asignado = insumo.costo_promedio || 0;
        }
        detalle.diferencia = detalle.cantidad_contada - (detalle.stock_sistema || 0);
      }
    }
  }

  recalcularDiferencia(detalle: DetalleInsumo): void {
    detalle.diferencia = detalle.cantidad_contada - (detalle.stock_sistema || 0);
  }

  guardarEdicion(): void {
    if (!this.validarFormularioEdicion()) {
      return;
    }

    if (!this.detectarCambios()) {
      alert('No se detectaron cambios');
      return;
    }

    const resumenCambios = this.obtenerResumenCambios();
    const mensaje = `¿Confirmar los siguientes cambios?\n\n${resumenCambios.join('\n')}`;
    
    if (!confirm(mensaje)) return;

    this.guardandoEdicion = true;

    const datosActualizacion = {
      maestro: {
        id_empleado: this.formEdicionMaestro.id_empleado,
        observaciones: this.formEdicionMaestro.observaciones,
        estado: this.formEdicionMaestro.estado
      },
      detalles: this.detallesEdicion.map(det => ({
        id_detalle: det.id_detalle,
        id_insumo: det.id_insumo,
        cantidad_contada: det.cantidad_contada,
        costo_unitario_asignado: det.costo_unitario_asignado
      }))
    };

    const url = `${this.apiUrl}/${this.conteoEditando.id_conteo}`;
    
    this.http.put<any>(url, datosActualizacion).subscribe({
      next: (response) => {
        console.log('Conteo actualizado exitosamente:', response);
        alert('✅ Conteo actualizado exitosamente.');
        this.cerrarModalEditar();
        this.obtenerConteos();
      },
      error: (error) => {
        console.error('Error al actualizar conteo:', error);
        const mensaje = error.error?.message || error.message || 'Error desconocido';
        alert(`❌ Error al actualizar: ${mensaje}`);
        this.guardandoEdicion = false;
      }
    });
  }

  validarFormularioEdicion(): boolean {
    if (!this.formEdicionMaestro.id_empleado) {
      alert('Debe seleccionar un empleado');
      return false;
    }

    if (!this.formEdicionMaestro.estado) {
      alert('Debe seleccionar un estado');
      return false;
    }

    if (this.detallesEdicion.length === 0) {
      alert('Debe tener al menos un detalle');
      return false;
    }

    for (const detalle of this.detallesEdicion) {
      if (!detalle.id_insumo) {
        alert('Todos los detalles deben tener un insumo');
        return false;
      }

      if (detalle.cantidad_contada < 0) {
        alert('La cantidad contada no puede ser negativa');
        return false;
      }

      if (detalle.costo_unitario_asignado < 0) {
        alert('El costo unitario no puede ser negativo');
        return false;
      }
    }

    return true;
  }

  detectarCambios(): boolean {
    if (!this.conteoOriginal) return false;

    const cambiosMaestro = 
      this.formEdicionMaestro.id_empleado !== this.conteoOriginal.id_empleado ||
      this.formEdicionMaestro.observaciones !== this.conteoOriginal.observaciones ||
      this.formEdicionMaestro.estado !== this.conteoOriginal.estado;

    if (cambiosMaestro) return true;

    if (this.detallesEdicion.length !== this.conteoOriginal.detalles.length) {
      return true;
    }

    for (let i = 0; i < this.detallesEdicion.length; i++) {
      const detalleActual = this.detallesEdicion[i];
      const detalleOriginal = this.conteoOriginal.detalles[i];

      if (
        detalleActual.cantidad_contada !== detalleOriginal.cantidad_contada ||
        detalleActual.costo_unitario_asignado !== detalleOriginal.costo_unitario_asignado ||
        detalleActual.id_insumo !== detalleOriginal.id_insumo
      ) {
        return true;
      }
    }

    return false;
  }

  obtenerResumenCambios(): string[] {
    if (!this.conteoOriginal) return [];
    
    const cambios: string[] = [];

    if (this.formEdicionMaestro.id_empleado !== this.conteoOriginal.id_empleado) {
      const empleadoAntes = this.empleados.find(e => e.id_empleado === this.conteoOriginal.id_empleado)?.nombre|| 'Desconocido';
      const empleadoDespues = this.empleados.find(e => e.id_empleado === this.formEdicionMaestro.id_empleado)?.nombre || 'Desconocido';
      cambios.push(`Empleado: ${empleadoAntes} → ${empleadoDespues}`);
    }

    if (this.formEdicionMaestro.estado !== this.conteoOriginal.estado) {
      cambios.push(`Estado: ${this.conteoOriginal.estado} → ${this.formEdicionMaestro.estado}`);
    }

    if (this.formEdicionMaestro.observaciones !== this.conteoOriginal.observaciones) {
      cambios.push(`Observaciones actualizadas`);
    }

    const cambiosDetalles = this.detallesEdicion.length !== this.conteoOriginal.detalles.length;
    if (cambiosDetalles) {
      cambios.push(`Cantidad de detalles: ${this.conteoOriginal.detalles.length} → ${this.detallesEdicion.length}`);
    }

    return cambios;
  }

  // ============================================
  // ELIMINAR CONTEO
  // ============================================

  eliminarConteo(conteo: ConteoMaestro): void {
    if (!this.esSuperUsuarioOAdmin()) {
      alert('Solo los Administradores y SuperUsuarios pueden eliminar conteos');
      return;
    }

    
    const mensaje = `¿Está seguro de eliminar el conteo #${conteo.id_conteo}?\n\nEmpleado: ${conteo.nombre_empleado}\nFecha: ${this.formatearFecha(conteo.fecha_conteo)}\n\n⚠️ Esta acción no se puede deshacer.`;
    
    if (!confirm(mensaje)) return;

    this.http.delete(`${this.apiUrl}/${conteo.id_conteo}`).subscribe({
      next: () => {
        alert('✅ Conteo eliminado exitosamente');
        this.obtenerConteos();
      },
      error: (error) => {
        console.error('Error al eliminar conteo:', error);
        const mensaje = error.error?.message || 'Error al eliminar el conteo';
        alert(`❌ ${mensaje}`);
      }
    });
  }
  aplicarConteo(conteo: ConteoMaestro): void {
  // Verificación de permisos (aunque el botón esté oculto, es buena práctica)
  if (!this.esSuperUsuarioOAdmin()) {
    alert('Solo los Administradores y SuperUsuarios pueden aplicar conteos');
    return;
  }

  const mensaje = `¿Está seguro de APLICAR el conteo #${conteo.id_conteo}?\n\n` +
                  `ESTA ACCIÓN SOBRESCRIBIRÁ el stock y costo promedio del inventario real ` +
                  `con los datos de este conteo.\n\nEsta acción no se puede deshacer.`;

  if (!confirm(mensaje)) return;

  const url = `${this.apiUrl}/${conteo.id_conteo}/aplicar`;

  // Se usa POST sin body, tal como lo definimos en el endpoint
  this.http.post<any>(url, {}).subscribe({
      next: (response) => {
          alert(`✅ ${response.message || 'Conteo aplicado exitosamente'}`);
          this.obtenerConteos(); // Recargar la lista para ver el estado "APLICADO"
      },
      error: (error) => {
          console.error('Error al aplicar conteo:', error);
          const mensaje = error.error?.message || 'Error desconocido al aplicar';
          alert(`❌ Error: ${mensaje}`);
      }
  });
}

  // ============================================
  // MÉTODOS DE AYUDA
  // ============================================

  esSuperUsuarioOAdmin(): boolean {
    return this.authService.hasRole(['SuperUsuario', 'Admin']);
  }

  formatearFecha(fecha: string): string {
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

  obtenerBadgeEstado(estado: string): string {
    switch(estado) {
      case 'PENDIENTE': return 'badge-pendiente';
      case 'EN_PROCESO': return 'badge-proceso';
      case 'COMPLETADO': return 'badge-completado';
      case 'CANCELADO': return 'badge-cancelado';
      default: return '';
    }
  }

  obtenerNombreEmpleado(idEmpleado: number | null): string {
    if (!idEmpleado) return 'Sin asignar';
    const empleado = this.empleados.find(e => e.id_empleado === idEmpleado);
    return empleado ? empleado.nombre : 'Empleado no encontrado';
  }

  obtenerNombreInsumo(idInsumo: number | null): string {
    if (!idInsumo) return '-';
    const insumo = this.insumos.find(i => i.id_insumo === idInsumo);
    return insumo ? insumo.nombre : 'Insumo no encontrado';
  }
}