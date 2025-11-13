import { Component, OnInit } from '@angular/core';
import { AdminService, SesionActiva, AccionAuditoria } from '../../../services/admin.service'; 

@Component({
  selector: 'app-admin-panel',
  standalone: false,
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.css']
})
export class AdminPanelComponent implements OnInit {

  // ---- Estado de Sesiones ----
  sesionesActivas: any[] = []; // (Usar 'any' temporalmente para 'cerrando')
  cargandoSesiones: boolean = false;
  errorSesiones: string | null = null;

  auditoriaGeneral: AccionAuditoria[] = [];
  cargandoAuditoria: boolean = false;
  pageAuditoria: number = 1;
  limitAuditoria: number = 15;
  totalAuditoria: number = 0;
  searchAuditoria: string = '';

  // ---- Estado del Modal de Auditoría ----
  modalVisible: boolean = false;
  cargandoModal: boolean = false;
  historialUsuario: AccionAuditoria[] = [];
  usuarioSeleccionado: string | null = null;

  constructor(private adminService: AdminService) { }

  ngOnInit(): void {
    this.cargarSesionesActivas();
    this.cargarAuditoriaGeneral();
  }

  /**
   * Carga la lista de sesiones activas desde el backend
   */
  cargarSesionesActivas(): void {
    this.cargandoSesiones = true;
    this.errorSesiones = null;
    this.adminService.getSesionesActivas().subscribe({
      next: (data) => {
        this.sesionesActivas = data;
        this.cargandoSesiones = false;
      },
      error: (err) => {
        console.error(err);
        this.errorSesiones = 'Error al cargar las sesiones. ' + (err.error?.message || err.message);
        this.cargandoSesiones = false;
      }
    });
  }

  /**
   * Llama al servicio para forzar el cierre de una sesión
   */
  onForzarCierre(sesion: SesionActiva): void {
    if (!confirm(`¿Estás seguro de cerrar la sesión de ${sesion.nombre} (${sesion.ip_address})?`)) {
      return;
    }

    // Deshabilita la fila (opcional)
    sesion['cerrando'] = true; 

    this.adminService.forzarCierreSesion(sesion.id_sesion).subscribe({
      next: () => {
        // Éxito: recarga la lista para que desaparezca la sesión cerrada
        this.cargarSesionesActivas();
        alert('Sesión cerrada exitosamente.');
      },
      error: (err) => {
        alert('Error al cerrar la sesión: ' + (err.error?.message || err.message));
        delete sesion['cerrando']; // Reactiva la fila si falla
      }
    });
  }

  cargarAuditoriaGeneral(): void {
    this.cargandoAuditoria = true;
    this.adminService.getAuditoriaGeneral(this.pageAuditoria, this.limitAuditoria, this.searchAuditoria)
      .subscribe({
        next: (response) => {
          // Asumiendo que el backend devuelve { total: number, data: [...] }
          // Si tu backend devuelve solo el array, ajusta esto.
          this.auditoriaGeneral = response.data; 
          this.totalAuditoria = response.total;
          this.cargandoAuditoria = false;
        },
        error: (err) => {
          console.error('Error al cargar auditoría general:', err);
          this.cargandoAuditoria = false;
        }
      });
  }

  onPageChangeAuditoria(page: number): void {
    this.pageAuditoria = page;
    this.cargarAuditoriaGeneral();
  }

  onSearchAuditoria(): void {
    this.pageAuditoria = 1; // Resetear a página 1 al buscar
    this.cargarAuditoriaGeneral();
  }

  // Helper para formatear el JSON de detalles en el HTML
  formatDetalles(detalles: any): string {
    if (!detalles) return '-';
    try {
      // Si es un string JSON, lo parseamos, si ya es objeto lo usamos
      const obj = typeof detalles === 'string' ? JSON.parse(detalles) : detalles;
      
      // Formateo simple para lectura humana
      return Object.entries(obj)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    } catch (e) {
      return JSON.stringify(detalles);
    }
  }
  // --- Métodos del Modal ---

  /**
   * Abre el modal y carga el historial del usuario seleccionado
   */
  onVerHistorial(sesion: SesionActiva): void {
    this.modalVisible = true;
    this.cargandoModal = true;
    this.usuarioSeleccionado = sesion.nombre;
    this.historialUsuario = [];

    this.adminService.getAuditoriaUsuario(sesion.id_usuario).subscribe({
      next: (data) => {
        this.historialUsuario = data;
        this.cargandoModal = false;
      },
      error: (err) => {
        alert('Error al cargar el historial: ' + (err.error?.message || err.message));
        this.cargandoModal = false;
        this.modalVisible = false; // Cierra el modal si falla
      }
    });
  }

  /**
   * Cierra el modal de historial
   */
  cerrarModal(): void {
    this.modalVisible = false;
    this.historialUsuario = [];
    this.usuarioSeleccionado = null;
  }
}