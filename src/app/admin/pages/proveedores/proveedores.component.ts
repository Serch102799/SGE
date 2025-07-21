import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';

export interface Proveedor {
  id_proveedor: number;
  nombre_proveedor: string;
  contacto: string;
  telefono: string;
  correo: string;
  direccion: string;
  rfc: string;
}

@Component({
  selector: 'app-proveedores',
  standalone: false,
  templateUrl: './proveedores.component.html',
  styleUrls: ['./proveedores.component.css']
})
export class ProveedoresComponent implements OnInit {

  proveedores: Proveedor[] = [];
  proveedoresFiltrados: Proveedor[] = [];
  private apiUrl = 'http://localhost:3000/api/proveedores';

  terminoBusqueda: string = '';

  mostrarModal = false;
  modoEdicion = false;
  proveedorSeleccionado: Partial<Proveedor> = {};
  
  mostrarModalBorrar = false;
  proveedorABorrar: Proveedor | null = null;
  
  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit(): void {
    this.obtenerProveedores();
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }

  obtenerProveedores() {
    this.http.get<Proveedor[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.proveedores = data;
        this.proveedoresFiltrados = data;
      },
      error: (err) => console.error('Error al obtener proveedores', err)
    });
  }

  aplicarFiltros() {
    const busqueda = this.terminoBusqueda.toLowerCase();
    this.proveedoresFiltrados = this.proveedores.filter(p =>
      p.nombre_proveedor.toLowerCase().includes(busqueda) ||
      (p.contacto && p.contacto.toLowerCase().includes(busqueda)) ||
      (p.rfc && p.rfc.toLowerCase().includes(busqueda))
    );
  }

  abrirModal(modo: 'agregar' | 'editar', proveedor?: Proveedor) {
    this.modoEdicion = (modo === 'editar');
    if (modo === 'editar' && proveedor) {
      this.proveedorSeleccionado = { ...proveedor };
    } else {
      this.proveedorSeleccionado = { nombre_proveedor: '' };
    }
    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
  }

  guardarProveedor() {
    if (!this.proveedorSeleccionado.nombre_proveedor) {
      this.mostrarNotificacion('Campo Requerido', 'El nombre del proveedor es obligatorio.');
      return;
    }

    const payload = {
      Nombre_Proveedor: this.proveedorSeleccionado.nombre_proveedor,
      Contacto: this.proveedorSeleccionado.contacto,
      Telefono: this.proveedorSeleccionado.telefono,
      Correo: this.proveedorSeleccionado.correo,
      Direccion: this.proveedorSeleccionado.direccion,
      RFC: this.proveedorSeleccionado.rfc
    };

    if (this.modoEdicion) {
      const url = `${this.apiUrl}/nombre/${this.proveedorSeleccionado.nombre_proveedor}`;
      this.http.put(url, payload).subscribe({
        next: () => this.postGuardado('Proveedor actualizado exitosamente.'),
        error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo actualizar.', 'error')
      });
    } else {
      this.http.post(this.apiUrl, payload).subscribe({
        next: () => this.postGuardado('Proveedor agregado exitosamente.'),
        error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo agregar.', 'error')
      });
    }
  }

  abrirModalBorrar(proveedor: Proveedor) {
    this.proveedorABorrar = proveedor;
    this.mostrarModalBorrar = true;
  }

  cerrarModalBorrar() {
    this.mostrarModalBorrar = false;
    this.proveedorABorrar = null;
  }

  confirmarEliminacion() {
    if (!this.proveedorABorrar) return;
    const url = `${this.apiUrl}/nombre/${this.proveedorABorrar.nombre_proveedor}`;
    this.http.delete(url).subscribe({
      next: () => this.postGuardado('Proveedor eliminado exitosamente.'),
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo eliminar.', 'error')
    });
  }
  
  private postGuardado(mensaje: string) {
    this.mostrarNotificacion('Éxito', mensaje, 'exito');
    this.obtenerProveedores();
    this.cerrarModal();
    this.cerrarModalBorrar();
  }
}