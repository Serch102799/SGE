import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';

export interface Ruta {
  id_ruta: number;
  nombre_ruta: string;
  descripcion: string;
  kilometraje_vuelta: number;
}

@Component({
  selector: 'app-rutas',
  standalone: false,
  templateUrl: './rutas.component.html',
  styleUrls: ['./rutas.component.css']
})
export class RutasComponent implements OnInit, OnDestroy {
  
  private apiUrl = `${environment.apiUrl}/rutas`;
  rutas: Ruta[] = [];
  
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;
  terminoBusqueda: string = '';
  private searchSubscription?: Subscription;
  private searchSubject: Subject<void> = new Subject<void>();

  mostrarModal = false;
  modoEdicion = false;
  rutaSeleccionada: Partial<Ruta> = {};
  
  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };

  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject.pipe(
      startWith(undefined),
      debounceTime(400)
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerRutas();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  obtenerRutas(): void {
    const params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('limit', this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim());

    this.http.get<{ total: number, data: Ruta[] }>(this.apiUrl, { params }).subscribe(response => {
      this.rutas = response.data;
      this.totalItems = response.total;
    });
  }

  onSearchChange(): void {
    this.searchSubject.next();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerRutas();
  }
  
  abrirModal(modo: 'agregar' | 'editar', ruta?: Ruta): void {
    this.modoEdicion = modo === 'editar';
    this.rutaSeleccionada = modo === 'editar' && ruta ? { ...ruta } : {};
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }

  guardarRuta(): void {
    const request$ = this.modoEdicion
      ? this.http.put(`${this.apiUrl}/${this.rutaSeleccionada.id_ruta}`, this.rutaSeleccionada)
      : this.http.post(this.apiUrl, this.rutaSeleccionada);
      
    request$.subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', `Ruta ${this.modoEdicion ? 'actualizada' : 'creada'} exitosamente.`, 'exito');
        this.obtenerRutas();
        this.cerrarModal();
      },
      error: (err) => this.mostrarNotificacion('Error', err.error?.message || 'Ocurrió un error.', 'error')
    });
  }
  
  // (Aquí iría la lógica para eliminar, similar a otros catálogos)
  
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') { this.notificacion = { titulo, mensaje, tipo }; this.mostrarModalNotificacion = true; }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}