import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';
import { AuthService } from '../../../services/auth.service';

interface Ruta {
  id_ruta: number;
  nombre_ruta: string;
}

@Component({
  selector: 'app-historial-combustible',
  standalone: false,
  templateUrl: './historial-combustible.component.html',
  styleUrls: ['./historial-combustible.component.css']
})
export class HistorialCombustibleComponent implements OnInit, OnDestroy {

  private apiUrl = `${environment.apiUrl}/cargas-combustible`;
  cargas: any[] = [];
  rutas: Ruta[] = [];

  // Paginación y Búsqueda
  currentPage: number = 1;
  itemsPerPage: number = 15;
  totalItems: number = 0;
  terminoBusqueda: string = '';
  filtroRutaId: string = '';
  private searchSubject: Subject<void> = new Subject<void>();
  private searchSubscription?: Subscription;

  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit(): void {
    this.cargarRutas(); // Carga las rutas primero para el dropdown

    this.searchSubscription = this.searchSubject.pipe(
      startWith(undefined) // Dispara la carga inicial
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerCargas();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  cargarRutas(): void {
    // Apunta al endpoint que devuelve un arreglo simple
    this.http.get<Ruta[]>(`${environment.apiUrl}/rutas/lista-simple`).subscribe(data => {
      this.rutas = data;
    });
  }

  obtenerCargas(): void {
    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('limit', this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim());
    
    if (this.filtroRutaId) {
      params = params.set('id_ruta', this.filtroRutaId);
    }

    // Espera recibir el objeto { total, data }
    this.http.get<{ total: number, data: any[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        // Asigna el arreglo desde response.data
        this.cargas = response.data;
        // Guarda el total de ítems para la paginación
        this.totalItems = response.total;
      },
      error: (err) => {
        console.error("Error al obtener historial de cargas:", err);
        this.cargas = [];
        this.totalItems = 0;
      }
    });
  }

  onSearchChange(): void {
    // debounceTime se maneja en el subject, solo necesitamos emitir
    this.searchSubject.next();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerCargas();
  }
}