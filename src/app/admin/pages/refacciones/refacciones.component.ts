import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Location } from '@angular/common';
import * as Papa from 'papaparse';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import * as XLSX from 'xlsx';

export interface Refaccion {
  id_refaccion: number;
  Nombre: string;
  Numero_Parte: string;
  Categoria: string;
  Marca: string;
  Unidad_Medida: string;
  Ubicacion_Almacen: string;
  Stock_Actual: number;
  ultimo_costo: number | null;
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
  sortField: string = '';
  sortDirection: string = 'asc';
  
  // --- Modales y Notificaciones (sin cambios) ---
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
    // CAMBIO: Se ajusta la petición para que funcione con el backend mejorado.
    // Se pide un límite muy alto para traer todos los registros, manteniendo la lógica de filtros en el frontend.
    const params = new HttpParams().set('limit', '9999');

    this.http.get<{ total: number, data: any[] }>(this.apiUrl, { params }).subscribe({
      next: response => {
        // Se mapea la respuesta para que coincida con la interfaz, incluyendo el nuevo campo 'ultimo_costo'
        this.refacciones = response.data.map(item => ({
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
          Descripcion: item.descripcion,
          ultimo_costo: item.ultimo_costo // Se recibe y mapea el nuevo dato
        }));
        this.generarFiltrosUnicos();
        this.aplicarFiltros(); // Se llama a tu filtro del frontend como antes
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

  // --- El resto de los métodos para modales, guardado y eliminación no necesitan cambios ---
  
  abrirModalAgregar(): void {
    this.nuevaRefaccion = { Nombre: '', Numero_Parte: '', Categoria: '', Marca: '', Unidad_Medida: 'Pieza', Ubicacion_Almacen: '', Stock_Minimo: 0 };
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
    const url = `${this.apiUrl}/${this.refaccionABorrar.id_refaccion}`;
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

  exportarAExcel() {
  this.mostrarNotificacion('Generando...', 'Preparando archivo Excel, por favor espere...', 'exito');

  // 1. Preparar parámetros para pedir TODO (sin paginación)
  let params = new HttpParams()
    .set('page', '1')
    .set('limit', '100000') // Límite alto para traer todo
    .set('search', this.terminoBusqueda)
    .set('sortBy', this.sortField)
    .set('sortOrder', this.sortDirection);

  if (this.filtroCategoria) params = params.set('filtroCategoria', this.filtroCategoria);
  if (this.filtroMarca) params = params.set('filtroMarca', this.filtroMarca);

  // 2. Solicitar datos al backend
  this.http.get<{ data: any[] }>(this.apiUrl, { params }).subscribe({
    next: (response) => {
      const datosCompletos = response.data;

      if (!datosCompletos || datosCompletos.length === 0) {
        this.mostrarNotificacion('Sin Datos', 'No hay registros para exportar con los filtros actuales.', 'advertencia');
        return;
      }

      // 3. Mapear datos para el Excel (Columnas bonitas)
      const datosExcel = datosCompletos.map(ref => ({
        'Nombre': ref.nombre,
        'N° Parte': ref.numero_parte,
        'Categoría': ref.categoria,
        'Marca': ref.marca,
        'Stock Actual': ref.stock_actual,
        'Stock Mínimo': ref.stock_minimo,
        'Ubicación': ref.ubicacion_almacen,
        'Último Costo': ref.ultimo_costo ? `$${Number(ref.ultimo_costo).toFixed(2)}` : 'N/A'
      }));

      // 4. Crear Hoja de Trabajo (Worksheet)
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(datosExcel);

      // (Opcional) Ajustar ancho de columnas
      const wscols = [
        { wch: 30 }, // Nombre
        { wch: 15 }, // N Parte
        { wch: 15 }, // Categoria
        { wch: 15 }, // Marca
        { wch: 10 }, // Stock
        { wch: 10 }, // Minimo
        { wch: 15 }, // Ubicacion
        { wch: 12 }  // Costo
      ];
      ws['!cols'] = wscols;

      // 5. Crear Libro (Workbook) y guardar
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Refacciones');

      // Nombre del archivo con fecha
      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Inventario_Refacciones_${fecha}.xlsx`);

      this.mostrarNotificacion('Éxito', 'Archivo Excel descargado correctamente.', 'exito');
    },
    error: (err) => {
      console.error(err);
      this.mostrarNotificacion('Error', 'No se pudieron descargar los datos para el reporte.', 'error');
    }
  });
  }}