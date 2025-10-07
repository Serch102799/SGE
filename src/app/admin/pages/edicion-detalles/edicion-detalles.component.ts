import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';

interface Detalle {
  id_detalle: number;
  tipo: 'refaccion' | 'insumo';
  fecha_operacion: string;
  nombre_item: string;
  cantidad_recibida: number;
  costo: number;
  id_entrada: number;
}

@Component({
  selector: 'app-edicion-detalles',
  standalone: false,
  templateUrl: './edicion-detalles.component.html',
  styleUrls: ['./edicion-detalles.component.css']
})
export class EdicionDetallesComponent implements OnInit, OnDestroy {

  private apiUrl = `${environment.apiUrl}/superadmin/detalles-entrada`;
  detalles: Detalle[] = [];

  // Paginación y Búsqueda
  currentPage: number = 1;
  itemsPerPage: number = 15;
  totalItems: number = 0;
  terminoBusqueda: string = '';
  private searchSubscription?: Subscription;
  private searchSubject: Subject<void> = new Subject<void>();

  // Modal de Edición
  mostrarModalEditar = false;
  detalleAEditar: Detalle | null = null;
  nuevosDatos = {
    cantidad_recibida: 0,
    costo: 0,
    motivo: ''
  };
  isSaving = false;
  
  // Notificaciones
  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };

  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject.pipe(
      startWith(undefined),
      debounceTime(400)
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerDetalles();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  obtenerDetalles(): void {
    const params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('limit', this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim());

    this.http.get<{ total: number, data: Detalle[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.detalles = response.data;
        this.totalItems = response.total;
      },
      error: (err) => this.mostrarNotificacion('Error', 'No se pudo cargar la lista de detalles.', 'error')
    });
  }

  onSearchChange(): void {
    this.searchSubject.next();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerDetalles();
  }

  abrirModalEditar(detalle: Detalle): void {
    this.detalleAEditar = detalle;
    this.nuevosDatos = {
      cantidad_recibida: detalle.cantidad_recibida,
      costo: detalle.costo,
      motivo: ''
    };
    this.mostrarModalEditar = true;
  }

  cerrarModalEditar(): void {
    this.mostrarModalEditar = false;
  }

  guardarCambios(): void {
    if (!this.detalleAEditar || !this.nuevosDatos.motivo.trim()) {
      this.mostrarNotificacion('Datos Incompletos', 'El motivo de la modificación es obligatorio.');
      return;
    }

    this.isSaving = true;
    const { tipo, id_detalle } = this.detalleAEditar;
    const url = `${this.apiUrl}/${tipo}/${id_detalle}`;
    
    this.http.put(url, this.nuevosDatos).subscribe({
      next: (response: any) => {
        this.mostrarNotificacion('Éxito', response.message, 'exito');
        this.isSaving = false;
        this.cerrarModalEditar();
        this.obtenerDetalles();
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'No se pudo actualizar el registro.', 'error');
        this.isSaving = false;
      }
    });
  }

  // Métodos de utilidad
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') { this.notificacion = { titulo, mensaje, tipo }; this.mostrarModalNotificacion = true; }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}