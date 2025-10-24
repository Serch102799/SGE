import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { forkJoin } from 'rxjs';

interface Ruta { 
  id_ruta: number; 
  nombre_ruta: string; 
}

interface Rendimiento {
  id_rendimiento: number;
  modelo_autobus: string;
  id_ruta: number;
  nombre_ruta: string;
  rendimiento_excelente: number;
  rendimiento_bueno: number;
  rendimiento_regular: number;
  activo: boolean;
}

@Component({
  selector: 'app-rendimientos',
  standalone: false,
  templateUrl: './rendimientos.component.html',
  styleUrls: ['./rendimientos.component.css']
})
export class RendimientosComponent implements OnInit {

  private apiUrl = `${environment.apiUrl}/rendimientos`;
  rendimientos: Rendimiento[] = [];

  public Math = Math;
  
  // Catálogos para modales
  rutas: Ruta[] = [];
  modelos: string[] = [];

  // Paginación y Búsqueda
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;
  terminoBusqueda: string = '';
  filtroModelo: string = '';

  // Modales
  mostrarModal = false;
  modoEdicion = false;
  seleccionado: Partial<Rendimiento> = {};
  
  // Modal de confirmación de eliminación
  mostrarModalEliminar = false;
  itemAEliminar: Rendimiento | null = null;
  
  // Notificaciones
  mostrarModalNotificacion = false;
  notificacion = { 
    titulo: 'Aviso', 
    mensaje: '', 
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' 
  };

  constructor(
    private http: HttpClient, 
    public authService: AuthService
  ) { }

  ngOnInit(): void {
    this.cargarCatalogos();
    this.obtenerDatos();
  }

  cargarCatalogos(): void {
    const rutas$ = this.http.get<Ruta[]>(`${environment.apiUrl}/rutas/lista-simple`);
    const modelos$ = this.http.get<string[]>(`${environment.apiUrl}/autobuses/modelos`);

    forkJoin([rutas$, modelos$]).subscribe({
      next: ([rutas, modelos]) => {
        this.rutas = rutas;
        this.modelos = modelos;
      },
      error: (err) => {
        console.error('Error al cargar catálogos:', err);
        this.mostrarNotificacion('Error', 'No se pudieron cargar los catálogos', 'error');
      }
    });
  }

  obtenerDatos(): void {
    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('limit', this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim());

    // Agregar filtro de modelo si está seleccionado
    if (this.filtroModelo) {
      params = params.set('modelo', this.filtroModelo);
    }

    this.http.get<{ total: number, data: Rendimiento[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.rendimientos = response.data;
        this.totalItems = response.total;
      },
      error: (err) => {
        console.error('Error al obtener datos:', err);
        this.mostrarNotificacion('Error', 'No se pudieron cargar los rendimientos', 'error');
      }
    });
  }

  onSearchChange(): void { 
    this.currentPage = 1; 
    this.obtenerDatos(); 
  }

  onPageChange(page: number): void { 
    this.currentPage = page; 
    this.obtenerDatos(); 
  }
  
  abrirModal(modo: 'agregar' | 'editar', item?: Rendimiento): void {
    this.modoEdicion = modo === 'editar';
    this.seleccionado = modo === 'editar' && item ? { ...item } : { 
      activo: true,
      rendimiento_excelente: 0,
      rendimiento_bueno: 0,
      rendimiento_regular: 0
    };
    this.mostrarModal = true;
  }

  cerrarModal(): void { 
    this.mostrarModal = false; 
  }

  guardar(): void {
    // Validación básica
    if (!this.seleccionado.modelo_autobus || !this.seleccionado.id_ruta) {
      this.mostrarNotificacion('Validación', 'Por favor completa todos los campos requeridos', 'advertencia');
      return;
    }

    if (!this.seleccionado.rendimiento_excelente || 
        !this.seleccionado.rendimiento_bueno || 
        !this.seleccionado.rendimiento_regular) {
      this.mostrarNotificacion('Validación', 'Los valores de rendimiento son requeridos', 'advertencia');
      return;
    }

    // Validar jerarquía: excelente > bueno > regular
    if (this.seleccionado.rendimiento_excelente <= this.seleccionado.rendimiento_bueno) {
      this.mostrarNotificacion('Validación', 'El rendimiento excelente debe ser mayor al bueno', 'advertencia');
      return;
    }

    if (this.seleccionado.rendimiento_bueno <= this.seleccionado.rendimiento_regular) {
      this.mostrarNotificacion('Validación', 'El rendimiento bueno debe ser mayor al regular', 'advertencia');
      return;
    }

    const request$ = this.modoEdicion
      ? this.http.put(`${this.apiUrl}/${this.seleccionado.id_rendimiento}`, this.seleccionado)
      : this.http.post(this.apiUrl, this.seleccionado);
      
    request$.subscribe({
      next: () => {
        this.mostrarNotificacion(
          'Éxito', 
          `Referencia ${this.modoEdicion ? 'actualizada' : 'creada'} con éxito.`, 
          'exito'
        );
        this.obtenerDatos();
        this.cerrarModal();
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'Ocurrió un error.', 'error');
      }
    });
  }

  confirmarEliminar(item: Rendimiento): void {
    this.itemAEliminar = item;
    this.mostrarModalEliminar = true;
  }

  eliminar(): void {
    if (!this.itemAEliminar) return;

    this.http.delete(`${this.apiUrl}/${this.itemAEliminar.id_rendimiento}`).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Referencia eliminada con éxito', 'exito');
        this.obtenerDatos();
        this.cerrarModalEliminar();
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'No se pudo eliminar', 'error');
      }
    });
  }

  cerrarModalEliminar(): void {
    this.mostrarModalEliminar = false;
    this.itemAEliminar = null;
  }
  
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia'): void { 
    this.notificacion = { titulo, mensaje, tipo }; 
    this.mostrarModalNotificacion = true; 
  }

  cerrarModalNotificacion(): void { 
    this.mostrarModalNotificacion = false; 
  }

  getNombreRuta(idRuta: number): string {
    const ruta = this.rutas.find(r => r.id_ruta === idRuta);
    return ruta ? ruta.nombre_ruta : '-';
  }
}