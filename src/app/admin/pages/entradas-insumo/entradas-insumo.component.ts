import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

export interface EntradaInsumo {
  id_entrada_insumo: number;
  fecha_entrada: string;
  numero_factura: string;
  nombre_proveedor: string;
  nombre_empleado: string;
  observaciones: string;
}

@Component({
  selector: 'app-entradas-insumo',
  standalone: false,
  templateUrl: './entradas-insumo.component.html',
  styleUrls: ['./entradas-insumo.component.css']
})
export class EntradasInsumoComponent implements OnInit {
  entradasInsumo: EntradaInsumo[] = [];
  private apiUrl = 'http://localhost:3000/api/entradas-insumo';

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
      // Limpia el mensaje para que no vuelva a aparecer
      sessionStorage.removeItem('notificacion');
    }
  }

  obtenerEntradas() {
    this.http.get<EntradaInsumo[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.entradasInsumo = data;
      },
      error: (err) => console.error('Error al obtener las entradas de insumos', err)
    });
  }

  registrarNuevaEntrada() {
    this.router.navigate(['/admin/registro-entrada-insumo']);
  }
}