import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-ajustes',
  standalone: false,
  templateUrl: './ajustes.component.html',
  styleUrls: ['./ajustes.component.css']
})
export class AjustesComponent implements OnInit {
  
  apiUrl = `${environment.apiUrl}/ajuste-Inventario`;
  inventario: any[] = [];
  loading = false;
  
  // Paginación y Filtros
  terminoBusqueda = '';
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  private searchSubject = new Subject<string>();

  // Modales Lógicos
  mostrarModalAjuste = false;        // El formulario de ajuste
  mostrarModalConfirmacion = false;  // "¿Estás seguro?"
  mostrarModalNotificacion = false;  // "Éxito/Error"

  // Datos para modales
  itemSeleccionado: any = null;
  nuevoStockFisico: number = 0;
  motivoAjuste: string = 'Reconteo Anual 2026';
  diferenciaCalculada: number = 0;

  notificacion = { titulo: '', mensaje: '', tipo: 'exito' }; // tipo: exito | error

  constructor(private http: HttpClient, public authService: AuthService) {
    // Debounce para no saturar el servidor al escribir
    this.searchSubject.pipe(debounceTime(500)).subscribe(() => {
      this.currentPage = 1; // Resetear a página 1 al buscar
      this.cargarInventario();
    });
  }

  ngOnInit() {
    this.cargarInventario();
  }

  // --- CARGA DE DATOS ---
  cargarInventario() {
    this.loading = true;
    let params = new HttpParams()
      .set('search', this.terminoBusqueda)
      .set('page', this.currentPage.toString())
      .set('limit', this.itemsPerPage.toString());

    this.http.get<{ data: any[], total: number }>(`${this.apiUrl}/inventario-global`, { params })
      .subscribe({
        next: (res) => {
          this.inventario = res.data;
          this.totalItems = res.total;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.mostrarNotificacion('Error', 'No se pudo cargar el inventario', 'error');
        }
      });
  }

  onSearchChange() {
    this.searchSubject.next(this.terminoBusqueda);
  }

  onPageChange(page: number) {
    this.currentPage = page;
    this.cargarInventario();
  }

  // --- LÓGICA DEL MODAL DE AJUSTE ---
  abrirModalAjuste(item: any) {
    this.itemSeleccionado = item;
    this.nuevoStockFisico = Number(item.stock_actual);
    this.diferenciaCalculada = 0;
    this.motivoAjuste = 'Reconteo Anual 2026';
    this.mostrarModalAjuste = true;
  }

  calcularDiferencia() {
    if(!this.itemSeleccionado) return;
    this.diferenciaCalculada = this.nuevoStockFisico - Number(this.itemSeleccionado.stock_actual);
  }

  cerrarModalAjuste() {
    this.mostrarModalAjuste = false;
    this.itemSeleccionado = null;
  }

  // --- LÓGICA DE CONFIRMACIÓN Y GUARDADO ---
  iniciarGuardado() {
    // Paso 1: Abrir modal de confirmación
    this.mostrarModalConfirmacion = true;
  }

  confirmarGuardado() {
    // Paso 2: El usuario dijo "SÍ"
    this.mostrarModalConfirmacion = false; // Cerrar confirmación
    
    const payload = {
      id: this.itemSeleccionado.id,
      tipo: this.itemSeleccionado.tipo,
      stock_fisico: this.nuevoStockFisico,
      motivo: this.motivoAjuste
    };

    this.http.post(`${this.apiUrl}/aplicar`, payload).subscribe({
      next: (res: any) => {
        this.cerrarModalAjuste();
        this.cargarInventario();
        this.mostrarNotificacion('Ajuste Exitoso', `Diferencia aplicada: ${res.diferencia}`, 'exito');
      },
      error: (err) => {
        this.mostrarModalConfirmacion = false;
        this.mostrarNotificacion('Error', err.error?.message || 'Error desconocido', 'error');
      }
    });
  }

  cancelarConfirmacion() {
    this.mostrarModalConfirmacion = false;
  }

  // --- LÓGICA DE NOTIFICACIONES ---
  mostrarNotificacion(titulo: string, mensaje: string, tipo: string) {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}