import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import * as Papa from 'papaparse';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';

export interface Refaccion {
  id_refaccion: number;
  Nombre: string;
  Numero_Parte: string;
  Categoria: string;
  Marca: string;
  Unidad_Medida: string;
  Ubicacion_Almacen: string;
  Stock_Actual: number;
  Stock_Minimo: number;
  Stock_Maximo: number | null;
  Precio_Costo: number;
  Fecha_Ultima_Entrada: string | null;
  Proveedor_Principal_ID: number | null;
  Descripcion?: string;
}

@Component({
  selector: 'app-refacciones',
  standalone: false,
  templateUrl: './refacciones.component.html',
  styleUrls: ['./refacciones.component.css']
})
export class RefaccionesComponent implements OnInit {

  refacciones: Refaccion[] = [];
  refaccionesFiltradas: Refaccion[] = [];
  private apiUrl = `${environment.apiUrl}/refacciones`;
  private movimientosApiUrl = `${environment.apiUrl}/movimientos`;

  terminoBusqueda: string = '';
  filtroCategoria: string = '';
  filtroMarca: string = '';
  categoriasUnicas: string[] = [];
  marcasUnicas: string[] = [];
  
  mostrarModalAgregar = false;
  mostrarModalEditar = false;
  mostrarModalBorrar = false;
  mostrarModalSalida = false;
  mostrarModalHistorial = false;
  
  nuevaRefaccion: Partial<Refaccion> = {
    Nombre: '',
    Unidad_Medida: 'Pieza',
    Stock_Minimo: 0,
    Descripcion: ''
  };
  refaccionAEditar: Refaccion | null = null;
  datosEditados: { Stock_Actual?: number; Stock_Minimo?: number; Stock_Maximo?: number; Precio_Costo?: number } = {};
  refaccionABorrar: Refaccion | null = null;
  refaccionParaSalida: Refaccion | null = null;
  datosSalida = {
    cantidad: null as number | null,
    motivo: ''
  };
  historialSeleccionado: any[] = [];
  refaccionSeleccionadaNombre: string | null = null;

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(
    private http: HttpClient, 
    private location: Location,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.obtenerRefacciones();
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }

  obtenerRefacciones() {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: data => {
        this.refacciones = data.map(item => ({
          id_refaccion: item.id_refaccion,
          Nombre: item.nombre,
          Numero_Parte: item.numero_parte,
          Categoria: item.categoria,
          Marca: item.marca,
          Unidad_Medida: item.unidad_medida,
          Ubicacion_Almacen: item.ubicacion_almacen,
          Stock_Actual: item.stock_actual,
          Stock_Minimo: item.stock_minimo,
          Stock_Maximo: item.stock_maximo,
          Precio_Costo: item.precio_costo,
          Fecha_Ultima_Entrada: item.fecha_ultima_entrada,
          Proveedor_Principal_ID: item.proveedor_principal_id,
          Descripcion: item.descripcion
        }));
        this.generarFiltrosUnicos();
        this.aplicarFiltros();
      },
      error: err => console.error('Error al cargar refacciones', err)
    });
  }
  
  generarFiltrosUnicos() {
    const categorias = new Set(this.refacciones.map(r => r.Categoria).filter(Boolean));
    const marcas = new Set(this.refacciones.map(r => r.Marca).filter(Boolean));
    this.categoriasUnicas = [...categorias].sort();
    this.marcasUnicas = [...marcas].sort();
  }

  aplicarFiltros() {
    let refaccionesTemp = [...this.refacciones];
    const busqueda = this.terminoBusqueda.toLowerCase();
    if (this.terminoBusqueda) {
      refaccionesTemp = refaccionesTemp.filter(refaccion =>
        refaccion.Nombre.toLowerCase().includes(busqueda) ||
        (refaccion.Numero_Parte && refaccion.Numero_Parte.toLowerCase().includes(busqueda))
      );
    }
    if (this.filtroCategoria) {
      refaccionesTemp = refaccionesTemp.filter(refaccion => refaccion.Categoria === this.filtroCategoria);
    }
    if (this.filtroMarca) {
      refaccionesTemp = refaccionesTemp.filter(refaccion => refaccion.Marca === this.filtroMarca);
    }
    this.refaccionesFiltradas = refaccionesTemp;
  }

  abrirModalAgregar(): void {
    this.nuevaRefaccion = { Nombre: '', Numero_Parte: '', Categoria: '', Marca: '', Stock_Actual: 0, Stock_Minimo: 0, Precio_Costo: 0, Descripcion: '' };
    this.mostrarModalAgregar = true;
  }
  cerrarModalAgregar(): void { this.mostrarModalAgregar = false; }

  guardarNuevaRefaccion(): void {
    if (!this.nuevaRefaccion.Nombre) {
      this.mostrarNotificacion('Campo Requerido', 'El nombre de la refacción es obligatorio.');
      return;
    }
    this.http.post<Refaccion>(this.apiUrl, this.nuevaRefaccion).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Refacción creada exitosamente.', 'exito');
        this.obtenerRefacciones();
        this.cerrarModalAgregar();
      },
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo crear la refacción.', 'error')
    });
  }

  abrirModalEditar(refaccion: Refaccion): void {
    this.refaccionAEditar = { ...refaccion };
    this.mostrarModalEditar = true;
  }

  cerrarModalEditar(): void { this.mostrarModalEditar = false; this.refaccionAEditar = null; }
  
  guardarCambiosRefaccion(): void {
    if (!this.refaccionAEditar) return;
    const url = `${this.apiUrl}/${this.refaccionAEditar.id_refaccion}`; 

    this.http.put(url, this.refaccionAEditar).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Refacción actualizada exitosamente.', 'exito');
        this.obtenerRefacciones();
        this.cerrarModalEditar();
      },
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo actualizar la refacción.', 'error')
    });
  }

  abrirModalBorrar(refaccion: Refaccion): void {
    this.refaccionABorrar = refaccion;
    this.mostrarModalBorrar = true;
  }
  cerrarModalBorrar(): void {
    this.mostrarModalBorrar = false;
    this.refaccionABorrar = null;
  }

  confirmarEliminacion(): void {
    if (!this.refaccionABorrar) return;
    const url = `${this.apiUrl}/nombre/${this.refaccionABorrar.Nombre}`;
    this.http.delete(url).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Refacción eliminada exitosamente.', 'exito');
        this.obtenerRefacciones();
        this.cerrarModalBorrar();
      },
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'No se pudo eliminar la refacción.', 'error')
    });
  }

  abrirModalSalida(refaccion: Refaccion): void {
    this.refaccionParaSalida = refaccion;
    this.datosSalida = { cantidad: null, motivo: '' };
    this.mostrarModalSalida = true;
  }
  cerrarModalSalida(): void {
    this.mostrarModalSalida = false;
    this.refaccionParaSalida = null;
  }

  guardarSalida(): void {
    if (!this.refaccionParaSalida || !this.datosSalida.cantidad || this.datosSalida.cantidad <= 0) {
      this.mostrarNotificacion('Datos Inválidos', 'Por favor, ingresa una cantidad válida.');
      return;
    }
    if (this.datosSalida.cantidad > this.refaccionParaSalida.Stock_Actual) {
      this.mostrarNotificacion('Stock Insuficiente', 'La cantidad de salida no puede ser mayor al stock actual.');
      return;
    }
    const payload = {
      refaccion_id: this.refaccionParaSalida.id_refaccion,
      empleado_id: this.authService.getCurrentUser()?.id || 1,
      tipo_movimiento: 'Salida',
      cantidad: this.datosSalida.cantidad,
      motivo: this.datosSalida.motivo
    };
    this.http.post(this.movimientosApiUrl, payload).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Salida registrada exitosamente.', 'exito');
        this.obtenerRefacciones();
        this.cerrarModalSalida();
      },
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'Error desconocido.', 'error')
    });
  }
  
  verHistorial(refaccion: Refaccion) {
    this.refaccionSeleccionadaNombre = refaccion.Nombre;
    this.http.get<any[]>(`${this.movimientosApiUrl}/${refaccion.id_refaccion}`).subscribe({
      next: (historial) => {
        this.historialSeleccionado = historial;
        this.mostrarModalHistorial = true;
      },
      error: (err) => this.mostrarNotificacion('Error', 'No se pudo cargar el historial.', 'error')
    });
  }
  cerrarModalHistorial() {
    this.mostrarModalHistorial = false;
    this.historialSeleccionado = [];
    this.refaccionSeleccionadaNombre = null;
  }

  exportarACSV() {
    if (this.refaccionesFiltradas.length === 0) {
      this.mostrarNotificacion('Sin Datos', 'No hay datos para exportar.');
      return;
    }
    const dataParaExportar = this.refaccionesFiltradas.map(refaccion => ({
      'Nombre': refaccion.Nombre,
      'Numero de Parte': refaccion.Numero_Parte,
      'Categoria': refaccion.Categoria,
      'Marca': refaccion.Marca,
      'Stock Actual': refaccion.Stock_Actual,
      'Stock Minimo': refaccion.Stock_Minimo,
      'Ubicacion': refaccion.Ubicacion_Almacen,
      'Precio de Costo': refaccion.Precio_Costo
    }));
    const csv = Papa.unparse(dataParaExportar);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'reporte_refacciones.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}