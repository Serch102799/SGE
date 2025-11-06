import { Component, OnInit } from '@angular/core';
import { AdminService, SesionActiva, AccionAuditoria } from '../../../services/admin.service'; 

@Component({
  selector: 'app-admin-panel',
  standalone: false,
  templateUrl: './admin-panel.component.html'
})
export class AdminPanelComponent implements OnInit {

  // ---- Estado de Sesiones ----
  sesionesActivas: SesionActiva[] = [];
  cargandoSesiones: boolean = false;
  errorSesiones: string | null = null;

  // ---- Estado del Modal de Auditoría ----
  modalVisible: boolean = false;
  cargandoModal: boolean = false;
  historialUsuario: AccionAuditoria[] = [];
  usuarioSeleccionado: string | null = null;

  constructor(private adminService: AdminService) { }

  ngOnInit(): void {
    this.cargarSesionesActivas();
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