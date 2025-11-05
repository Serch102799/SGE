import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface Insumo {
  id_insumo: number;
  nombre: string;
  marca: string;
  tipo_insumo: string;
  unidad_medida: string;
  stock_actual: number;
  stock_minimo: number;
  costo_unitario_promedio: number;
}

@Component({
  selector: 'app-insumos',
  standalone: false,
  templateUrl: './insumos.component.html',
  styleUrls: ['./insumos.component.css']
})
export class InsumosComponent implements OnInit, OnDestroy {

  insumos: Insumo[] = [];
  private apiUrl = `${environment.apiUrl}/insumos`;

  // --- Estado de la Tabla ---
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;
  sortField: string = 'nombre';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // --- Filtros ---
  terminoBusqueda: string = '';
  filtroTipo: string = ''; 
  tiposDeInsumo: string[] = ['Fluido', 'Consumible de Taller', 'Limpieza', 'Seguridad', 'Otro'];
  private searchSubject: Subject<void> = new Subject<void>();
  private searchSubscription?: Subscription;
  
  // --- Modales ---
  mostrarModal = false;
  modoEdicion = false;
  insumoSeleccionado: Partial<Insumo> = {};
  
  mostrarModalBorrar = false;
  insumoABorrar: Insumo | null = null;

  // --- Modal de Edición de Costo ---
  mostrarModalCosto = false;
  insumoEditarCosto: Insumo | null = null;
  nuevoCosto: number = 0;

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit(): void {
    this.obtenerInsumos();
    
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(400)
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerInsumos();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  obtenerInsumos() {
    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('limit', this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim())
      .set('sortBy', this.sortField)
      .set('sortOrder', this.sortDirection);

    if (this.filtroTipo) {
      params = params.set('tipo', this.filtroTipo);
    }

    this.http.get<{ total: number, data: Insumo[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.insumos = response.data || [];
        this.totalItems = response.total || 0;
      },
      error: (err) => {
        console.error('Error al obtener insumos', err);
        this.insumos = [];
        this.totalItems = 0;
      }
    });
  }

  onFiltroChange(): void {
    this.searchSubject.next();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerInsumos();
  }

  onSort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.obtenerInsumos();
  }

  abrirModal(modo: 'agregar' | 'editar', insumo?: Insumo) {
    this.modoEdicion = (modo === 'editar');
    if (modo === 'editar' && insumo) {
      this.insumoSeleccionado = { ...insumo };
    } else {
      this.insumoSeleccionado = { 
        nombre: '', 
        unidad_medida: 'Pieza', 
        tipo_insumo: 'Consumible de Taller',
        costo_unitario_promedio: 0 
      };
    }
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
  }

  guardarInsumo() {
    if (!this.insumoSeleccionado.nombre || !this.insumoSeleccionado.unidad_medida || !this.insumoSeleccionado.tipo_insumo) {
      this.mostrarNotificacion('Campos Requeridos', 'Nombre, Unidad de Medida y Tipo son requeridos.');
      return;
    }

    const request$ = this.modoEdicion
      ? this.http.put(`${this.apiUrl}/${this.insumoSeleccionado.id_insumo}`, this.insumoSeleccionado)
      : this.http.post(this.apiUrl, this.insumoSeleccionado);

    request$.subscribe({
      next: () => this.postGuardado(`Insumo ${this.modoEdicion ? 'actualizado' : 'creado'} exitosamente.`),
      error: (err) => this.mostrarNotificacion('Error', err.error.message || `No se pudo ${this.modoEdicion ? 'actualizar' : 'agregar'} el insumo.`, 'error')
    });
  }

  // --- Métodos para Editar Costo Unitario ---
  abrirModalEditarCosto(insumo: Insumo) {
    this.insumoEditarCosto = insumo;
    this.nuevoCosto = insumo.costo_unitario_promedio || 0;
    this.mostrarModalCosto = true;
  }

  cerrarModalCosto() {
    this.mostrarModalCosto = false;
    this.insumoEditarCosto = null;
    this.nuevoCosto = 0;
  }

  guardarCosto() {
    if (!this.insumoEditarCosto) return;
    
    if (this.nuevoCosto < 0) {
      this.mostrarNotificacion('Error', 'El costo no puede ser negativo.', 'error');
      return;
    }

    const url = `${this.apiUrl}/${this.insumoEditarCosto.id_insumo}/costo`;
    this.http.patch(url, { costo_unitario_promedio: this.nuevoCosto }).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Costo actualizado exitosamente.', 'exito');
        this.obtenerInsumos();
        this.cerrarModalCosto();
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error.message || 'No se pudo actualizar el costo.', 'error');
      }
    });
  }

  abrirModalBorrar(insumo: Insumo) {
    this.insumoABorrar = insumo;
    this.mostrarModalBorrar = true;
  }

  cerrarModalBorrar() {
    this.mostrarModalBorrar = false;
    this.insumoABorrar = null;
  }

  confirmarEliminacion() {
    if (!this.insumoABorrar) return;
    const url = `${this.apiUrl}/${this.insumoABorrar.id_insumo}`;
    this.http.delete(url).subscribe({
      next: () => this.postGuardado('Insumo eliminado exitosamente.'),
      error: (err) => this.mostrarNotificacion('Error', err.error.message || 'No se pudo eliminar el insumo.', 'error')
    });
  }
  
  private postGuardado(mensaje: string) {
    this.mostrarNotificacion('Éxito', mensaje, 'exito');
    this.obtenerInsumos();
    this.cerrarModal();
    this.cerrarModalBorrar();
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }

  // Método auxiliar para formatear moneda
  formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN' 
    }).format(valor || 0);
  }
}