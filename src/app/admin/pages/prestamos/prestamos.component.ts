import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';

// --- Interfaces ---
interface PrestamoActivo {
  id_prestamo: number;
  fecha_prestamo: string;
  nombre_solicitante_manual?: string; 
  solicitante?: string; 
  id_detalle_prestamo: number;
  tipo_item: string;
  nombre_item: string;
  cantidad_prestada: number;
  cantidad_devuelta: number;
  pendiente: number;
}

interface ItemBusqueda {
  id: number;
  nombre: string;
  stock_actual?: number;
  cantidad_disponible?: number;
  tipo: 'insumo' | 'refaccion' | 'herramienta';
}

@Component({
  selector: 'app-prestamos',
  standalone: false,
  templateUrl: './prestamos.component.html',
  styleUrls: ['./prestamos.component.css']
})
export class PrestamosComponent implements OnInit {
  
  private apiUrl = environment.apiUrl;
  
  // --- Estado del Tablero ---
  prestamosActivos: PrestamoActivo[] = [];
  loading = false;

  // --- Paginación (Cliente) ---
  page: number = 1;
  itemsPerPage: number = 10;

  // --- Modales ---
  mostrarModalNuevo = false;
  mostrarModalDevolucion = false;

  // --- Formulario Nuevo Préstamo ---
  itemControl = new FormControl();
  filteredItems$: Observable<ItemBusqueda[]>;
  
  nuevoPrestamo = {
    nombre_solicitante_manual: '', 
    observaciones: '',
    items: [] as any[] 
  };
  
  itemSeleccionadoTemporal: ItemBusqueda | null = null;
  cantidadAPrestar: number = 1;
  
  tipoItemBusqueda: 'insumo' | 'refaccion' | 'herramienta' = 'insumo'; 

  // --- Formulario Devolución ---
  itemParaDevolver: PrestamoActivo | null = null;
  datosDevolucion = {
    cantidad: 0,
    estado: 'BUENO' 
  };

  // Notificaciones
  mostrarModalNotificacion = false;
  notificacion = { titulo: '', mensaje: '', tipo: 'exito' as 'exito' | 'error' | 'advertencia' };

  constructor(private http: HttpClient, public authService: AuthService) {
    this.filteredItems$ = this.itemControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(val => this._buscarItem(val || ''))
    );
  }

  ngOnInit(): void {
    this.obtenerPrestamosActivos();
  }

  // --- Cargar Tablero ---
  obtenerPrestamosActivos() {
    this.loading = true;
    this.http.get<PrestamoActivo[]>(`${this.apiUrl}/prestamos/activos`).subscribe({
      next: (data) => {
        this.prestamosActivos = data.map(p => ({
            ...p,
            solicitante: p.nombre_solicitante_manual || p.solicitante || 'Desconocido'
        }));
        this.loading = false;
        // Reiniciar a página 1 al recargar datos
        this.page = 1; 
      },
      error: (err) => {
        console.error('Error cargando préstamos:', err);
        this.loading = false;
      }
    });
  }

  // --- Lógica del Buscador ---
  cambiarTipoBusqueda(tipo: 'insumo' | 'refaccion' | 'herramienta') {
    this.tipoItemBusqueda = tipo;
    this.itemControl.setValue('');
    this.itemSeleccionadoTemporal = null;
  }

  private _buscarItem(term: any): Observable<ItemBusqueda[]> {
    const searchTerm = typeof term === 'string' ? term : term.nombre;
    if (!searchTerm || searchTerm.length < 2) return of([]);
    
    const endpoint = this.tipoItemBusqueda === 'insumo' ? 'insumos' : 'refacciones';
    
    return this.http.get<any[]>(`${this.apiUrl}/${endpoint}/buscar`, { params: { term: searchTerm } })
      .pipe(map(items => items.map(i => ({
        id: this.tipoItemBusqueda === 'insumo' ? i.id_insumo : i.id_refaccion,
        nombre: i.nombre,
        stock_actual: this.tipoItemBusqueda === 'insumo' ? i.stock_actual : i.cantidad_disponible,
        tipo: this.tipoItemBusqueda 
      }))));
  }

  displayFnItem(item: ItemBusqueda): string { return item ? item.nombre : ''; }

  // --- Lógica Nuevo Préstamo ---
  abrirModalNuevo() {
    this.nuevoPrestamo = { nombre_solicitante_manual: '', observaciones: '', items: [] };
    this.itemControl.setValue('');
    this.itemSeleccionadoTemporal = null;
    this.mostrarModalNuevo = true;
  }

  seleccionarItem(event: MatAutocompleteSelectedEvent) {
    this.itemSeleccionadoTemporal = event.option.value as ItemBusqueda;
  }

  agregarAlCarrito() {
    if (!this.itemSeleccionadoTemporal || this.cantidadAPrestar <= 0) return;
    
    const stock = this.itemSeleccionadoTemporal.stock_actual !== undefined 
        ? this.itemSeleccionadoTemporal.stock_actual 
        : (this.itemSeleccionadoTemporal.cantidad_disponible || 0);

    if (this.cantidadAPrestar > stock) {
      this.mostrarNotificacion('Stock Insuficiente', `Solo hay ${stock} disponibles.`, 'advertencia');
      return;
    }

    this.nuevoPrestamo.items.push({
      ...this.itemSeleccionadoTemporal,
      cantidad: this.cantidadAPrestar
    });

    this.itemControl.setValue('');
    this.itemSeleccionadoTemporal = null;
    this.cantidadAPrestar = 1;
  }

  eliminarDelCarrito(index: number) {
    this.nuevoPrestamo.items.splice(index, 1);
  }

  guardarPrestamo() {
    if (!this.nuevoPrestamo.nombre_solicitante_manual.trim()) {
        this.mostrarNotificacion('Faltan Datos', 'Escribe el nombre del mecánico.', 'advertencia');
        return;
    }
    if (this.nuevoPrestamo.items.length === 0) {
      this.mostrarNotificacion('Faltan Datos', 'Agrega al menos una herramienta o insumo.', 'advertencia');
      return;
    }

    const payload = {
        nombre_solicitante_manual: this.nuevoPrestamo.nombre_solicitante_manual,
        observaciones: this.nuevoPrestamo.observaciones,
        items: this.nuevoPrestamo.items.map(i => ({
            id: i.id,
            cantidad: i.cantidad,
            tipo: i.tipo === 'herramienta' ? 'refaccion' : i.tipo
        }))
    };

    this.http.post(`${this.apiUrl}/prestamos`, payload).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Préstamo registrado correctamente.', 'exito');
        this.mostrarModalNuevo = false;
        this.obtenerPrestamosActivos();
      },
      error: (err) => {
        console.error(err);
        this.mostrarNotificacion('Error', err.error?.message || 'Error al guardar.', 'error');
      }
    });
  }

  // --- Lógica Devolución ---
  abrirModalDevolucion(item: PrestamoActivo) {
    this.itemParaDevolver = item;
    this.datosDevolucion = { cantidad: item.pendiente, estado: 'BUENO' };
    this.mostrarModalDevolucion = true;
  }

  confirmarDevolucion() {
    if (!this.itemParaDevolver) return;
    if (this.datosDevolucion.cantidad > this.itemParaDevolver.pendiente) {
        this.mostrarNotificacion('Error', 'No puedes devolver más de lo pendiente.', 'error');
        return;
    }

    const payload = {
      id_detalle_prestamo: this.itemParaDevolver.id_detalle_prestamo,
      cantidad_devuelta: this.datosDevolucion.cantidad,
      estado_devolucion: this.datosDevolucion.estado
    };

    this.http.put(`${this.apiUrl}/prestamos/devolucion`, payload).subscribe({
      next: () => {
        this.mostrarNotificacion('Devolución Exitosa', 'El inventario ha sido actualizado.', 'exito');
        this.mostrarModalDevolucion = false;
        this.obtenerPrestamosActivos();
      },
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'Error al devolver.', 'error')
    });
  }

  // Utilidades
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }
  
  cerrarNotificacion() { 
    this.mostrarModalNotificacion = false; 
  }
}