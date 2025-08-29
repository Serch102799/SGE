import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import * as Papa from 'papaparse';
import { environment } from '../../../../environments/environments';


// Interfaz para la lista de entradas
export interface Entrada {
  idEntrada: number;
  idProveedor: number;
  factura_proveedor: string;
  observaciones: string;
  recibidoPorID: number;
  fechaEntrada: string;
  nombreProveedor: string; 
  nombreEmpleado: string;  
}

@Component({
  selector: 'app-entradas',
  standalone: false,
  templateUrl: './entradas.component.html',
  styleUrls: ['./entradas.component.css']
})
export class EntradasComponent implements OnInit {

  entradas: Entrada[] = [];
  entradasFiltradas: Entrada[] = [];
  private apiUrl = `${environment.apiUrl}/entradas`;
  private detalleApiUrl = `${environment.apiUrl}/detalle-entrada`;

  
  terminoBusqueda: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';
  mostrarModalDetalles = false;
  detallesSeleccionados: any[] = [];
  entradaSeleccionadaId: number | null = null;

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient, private router: Router) { }

  ngOnInit(): void {
    this.obtenerEntradas();
    this.revisarNotificaciones();
  }
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }
  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
  revisarNotificaciones() {
    const notificacionMsg = sessionStorage.getItem('notificacion');
    if (notificacionMsg) {
      this.mostrarNotificacion('Éxito', notificacionMsg, 'exito');
      sessionStorage.removeItem('notificacion');
    }
  }

  obtenerEntradas() {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        // Mapeamos los datos de la API a nuestra interfaz
        this.entradas = data.map(item => ({
          idEntrada: item.id_entrada,
          idProveedor: item.id_proveedor,
          factura_proveedor: item.factura_proveedor,
          observaciones: item.observaciones,
          recibidoPorID: item.recibido_por_id,
          fechaEntrada: item.fecha_operacion,
          nombreProveedor: item.nombre_proveedor,
          nombreEmpleado: item.nombre_empleado
        }));
          this.entradasFiltradas = this.entradas;
      },
      error: (err) => console.error('Error al obtener las entradas', err)
    });
  }

   aplicarFiltros() {
    let entradasTemp = this.entradas;
    const busqueda = this.terminoBusqueda.toLowerCase();

    // 1. Filtro de texto (existente)
    if (this.terminoBusqueda) {
      entradasTemp = entradasTemp.filter(e =>
        e.nombreProveedor.toLowerCase().includes(busqueda) ||
        e.factura_proveedor.toLowerCase().includes(busqueda) ||
        e.nombreEmpleado.toLowerCase().includes(busqueda)
      );
    }

    // 2. Filtro por fecha
    if (this.fechaInicio) {
      const fechaDesde = new Date(this.fechaInicio);
      entradasTemp = entradasTemp.filter(e => new Date(e.fechaEntrada) >= fechaDesde);
    }
    if (this.fechaFin) {
      const fechaHasta = new Date(this.fechaFin);
      fechaHasta.setDate(fechaHasta.getDate() + 1);
      entradasTemp = entradasTemp.filter(e => new Date(e.fechaEntrada) < fechaHasta);
    }

    this.entradasFiltradas = entradasTemp;
  }

  exportarACSV() {
    if (this.entradasFiltradas.length === 0) {
      this.mostrarNotificacion('Sin Datos', 'No hay datos para exportar.');
      return;
    }

    const dataParaExportar = this.entradasFiltradas.map(entrada => ({
      'ID Entrada': entrada.idEntrada,
      'Fecha': entrada.fechaEntrada,
      'Proveedor': entrada.nombreProveedor,
      'Numero de Factura': entrada.factura_proveedor,
      'Recibido Por': entrada.nombreEmpleado,
      'Observaciones': entrada.observaciones
    }));

    const csv = Papa.unparse(dataParaExportar);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'reporte_entradas.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  registrarNuevaEntrada() {
    this.router.navigate(['/admin/registro-entrada']);
  }

  verDetalles(entrada: Entrada) {
    this.entradaSeleccionadaId = entrada.idEntrada;
    this.http.get<any[]>(`${this.detalleApiUrl}/${entrada.idEntrada}`).subscribe({
      next: (detalles) => {
        this.detallesSeleccionados = detalles;
        this.mostrarModalDetalles = true;
      },
      error: (err) => this.mostrarNotificacion('Error', 'Error al cargar los detalles de la entrada.', 'error')
    });
  }

  cerrarModalDetalles() {
    this.mostrarModalDetalles = false;
    this.detallesSeleccionados = [];
    this.entradaSeleccionadaId = null;
  }
}