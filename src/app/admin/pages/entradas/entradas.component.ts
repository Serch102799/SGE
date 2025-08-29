import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import * as Papa from 'papaparse';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';

// Interfaz para la lista de entradas
export interface Entrada {
  idEntrada: number;
  idProveedor: number;
  factura_proveedor: string;
  vale_interno: string; 
  valor_neto: number;
  observaciones: string;
  recibidoPorID: number;
  fechaEntrada: string;
  nombreProveedor: string; 
  nombreEmpleado: string;   
}

@Component({
  selector: 'app-entradas',
  standalone  : false,
  templateUrl: './entradas.component.html',
  styleUrls: ['./entradas.component.css']
})
export class EntradasComponent implements OnInit, OnDestroy {

  private apiUrl = `${environment.apiUrl}/entradas`;
  
  // --- Estado de la Tabla ---
  entradas: Entrada[] = [];
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;

  // --- Filtros ---
  terminoBusqueda: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';
  private searchSubject: Subject<void> = new Subject<void>();
  private searchSubscription?: Subscription;

  // --- Modales y Notificaciones ---
  mostrarModalDetalles = false;
  valorNetoEntradaSeleccionada: number = 0;
  detallesSeleccionados: any[] = [];
  entradaSeleccionadaId: number | null = null;
  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient, private router: Router, public authService: AuthService) { }

  ngOnInit(): void {
    this.revisarNotificaciones();

    this.searchSubscription = this.searchSubject.pipe(
      startWith(undefined), 
      debounceTime(400)
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerEntradas();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }
  
  obtenerEntradas() {
    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('limit', this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim());

    if (this.fechaInicio) params = params.set('fechaInicio', this.fechaInicio);
    if (this.fechaFin) params = params.set('fechaFin', this.fechaFin);

    this.http.get<{ total: number, data: any[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.entradas = (response.data || []).map(item => ({
          idEntrada: item.id_entrada,
          fechaEntrada: item.fecha_operacion,
          idProveedor: item.id_proveedor,
          nombreProveedor: item.nombre_proveedor,
          factura_proveedor: item.factura_proveedor,
          vale_interno: item.vale_interno,
          recibidoPorID: item.recibido_por_id,
          nombreEmpleado: item.nombre_empleado,
          observaciones: item.observaciones,
          valor_neto: parseFloat(item.valor_neto) || 0
        }));
        this.totalItems = response.total || 0;
      },
      error: (err) => {
        console.error('Error al obtener las entradas', err);
        this.mostrarNotificacion('Error', 'No se pudo cargar el historial de entradas.', 'error');
        this.entradas = [];
        this.totalItems = 0;
      }
    });
  }

  // Este método unificado ahora maneja todos los cambios en los filtros
  onFiltroChange(): void {
    this.searchSubject.next();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerEntradas();
  }
  
  registrarNuevaEntrada() {
    this.router.navigate(['/admin/registro-entrada']);
  }

  exportarACSV() {
    if (this.entradas.length === 0) {
      this.mostrarNotificacion('Sin Datos', 'No hay datos para exportar.');
      return;
    }

    const dataParaExportar = this.entradas.map(entrada => ({
      'ID Entrada': entrada.idEntrada,
      'Fecha Operación': entrada.fechaEntrada,
      'Proveedor': entrada.nombreProveedor,
      'Factura/Vale': entrada.factura_proveedor || entrada.vale_interno,
      'Recibido Por': entrada.nombreEmpleado,
      'Valor Neto': entrada.valor_neto,
      'Observaciones': entrada.observaciones
    }));

    const csv = Papa.unparse(dataParaExportar);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'reporte_entradas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  verDetalles(entrada: Entrada) {
    this.entradaSeleccionadaId = entrada.idEntrada;
    
    // La petición ahora espera un objeto { detalles, valorNeto }
    this.http.get<{ detalles: any[], valorNeto: number }>(`${this.apiUrl}/detalles/${entrada.idEntrada}`).subscribe({
      next: (respuesta) => {
        this.detallesSeleccionados = respuesta.detalles;
        this.valorNetoEntradaSeleccionada = respuesta.valorNeto; // <-- SE GUARDA EL VALOR
        this.mostrarModalDetalles = true;
      },
      error: (err) => this.mostrarNotificacion('Error', 'No se pudieron cargar los detalles de la entrada.', 'error')
    });
  }
  
  cerrarModalDetalles() {
    this.mostrarModalDetalles = false;
  }
  
  // --- Métodos de utilidad ---
  revisarNotificaciones() {
    const notificacionMsg = sessionStorage.getItem('notificacion');
    if (notificacionMsg) {
      this.mostrarNotificacion('Éxito', notificacionMsg, 'exito');
      sessionStorage.removeItem('notificacion');
    }
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}