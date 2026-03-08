import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environments'; // Ajusta tu ruta

@Component({
  selector: 'app-admin-tickets',
  standalone: false,
  templateUrl: './admin-tickets.component.html',
  styleUrls: ['./admin-tickets.component.css']
})
export class AdminTicketsComponent implements OnInit {

  tickets: any[] = [];
  isLoading = false;
  
  // Notificaciones de aviso
  mostrarModalNotificacion = false;
  notificacion = { titulo: '', mensaje: '', tipo: 'exito' as 'exito' | 'error' | 'advertencia' };

  // --- NUEVO: Variables para el Modal de Confirmación ---
  mostrarModalConfirmacion = false;
  ticketAConfirmar: number | null = null;
  estatusAConfirmar: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarTickets();
  }

  cargarTickets() {
    this.isLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/tickets`).subscribe({
      next: (data) => {
        this.tickets = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.mostrarNotificacion('Error', 'No se pudieron cargar los tickets de soporte.', 'error');
        this.isLoading = false;
      }
    });
  }

  // --- NUEVO: Lógica del Modal de Confirmación ---
  abrirConfirmacion(id: number, nuevoEstatus: string) {
    this.ticketAConfirmar = id;
    this.estatusAConfirmar = nuevoEstatus;
    this.mostrarModalConfirmacion = true;
  }

  cerrarConfirmacion() {
    this.mostrarModalConfirmacion = false;
    this.ticketAConfirmar = null;
    this.estatusAConfirmar = '';
  }

  confirmarCambioEstatus() {
    if (this.ticketAConfirmar && this.estatusAConfirmar) {
      this.http.put(`${environment.apiUrl}/tickets/${this.ticketAConfirmar}/estatus`, { estatus: this.estatusAConfirmar }).subscribe({
        next: () => {
          this.mostrarNotificacion('Actualizado', `El ticket ahora está ${this.estatusAConfirmar}.`, 'exito');
          this.cargarTickets(); 
          this.cerrarConfirmacion(); // Cerramos el modal de pregunta
        },
        error: () => {
          this.mostrarNotificacion('Error', 'No se pudo actualizar el estatus.', 'error');
          this.cerrarConfirmacion();
        }
      });
    }
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}