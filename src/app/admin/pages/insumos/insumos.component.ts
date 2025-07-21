import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';

export interface Insumo {
  id_insumo: number;
  nombre: string;
  marca: string;
  tipo: string;
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
export class InsumosComponent implements OnInit {

  insumos: Insumo[] = [];
  insumosFiltrados: Insumo[] = [];
  private apiUrl = 'http://localhost:3000/api/insumos';

  terminoBusqueda: string = '';
  
  mostrarModal = false;
  modoEdicion = false;
  insumoSeleccionado: Partial<Insumo> = {};
  
  mostrarModalBorrar = false;
  insumoABorrar: Insumo | null = null;

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit(): void {
    this.obtenerInsumos();
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }

  obtenerInsumos() {
    this.http.get<Insumo[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.insumos = data;
        this.insumosFiltrados = data;
      },
      error: (err) => console.error('Error al obtener insumos', err)
    });
  }

  aplicarFiltros() {
    const busqueda = this.terminoBusqueda.toLowerCase();
    this.insumosFiltrados = this.insumos.filter(i =>
      i.nombre.toLowerCase().includes(busqueda) ||
      (i.marca && i.marca.toLowerCase().includes(busqueda)) ||
      (i.tipo && i.tipo.toLowerCase().includes(busqueda))
    );
  }

  abrirModal(modo: 'agregar' | 'editar', insumo?: Insumo) {
    this.modoEdicion = (modo === 'editar');
    if (modo === 'editar' && insumo) {
      this.insumoSeleccionado = { ...insumo };
    } else {
      this.insumoSeleccionado = { nombre: '', unidad_medida: 'Litros' };
    }
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
  }

  guardarInsumo() {
    if (!this.insumoSeleccionado.nombre || !this.insumoSeleccionado.unidad_medida) {
      this.mostrarNotificacion('Campos Requeridos', 'Nombre y Unidad de Medida son requeridos.');
      return;
    }

    if (this.modoEdicion) {
      const url = `${this.apiUrl}/${this.insumoSeleccionado.id_insumo}`;
      this.http.put(url, { stock_minimo: this.insumoSeleccionado.stock_minimo }).subscribe({
        next: () => this.postGuardado('Insumo actualizado exitosamente.'),
        error: (err) => this.mostrarNotificacion('Error', err.error.message || 'No se pudo actualizar el insumo.', 'error')
      });
    } else {
      this.http.post(this.apiUrl, this.insumoSeleccionado).subscribe({
        next: () => this.postGuardado('Insumo creado exitosamente.'),
        error: (err) => this.mostrarNotificacion('Error', err.error.message || 'No se pudo agregar el insumo.', 'error')
      });
    }
  }

  abrirModalBorrar(insumo: Insumo) {
    this.insumoABorrar = insumo;
    this.mostrarModalBorrar = true;
  }

  cerrarModalBorrar() {
    this.mostrarModalBorrar = false;
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
}