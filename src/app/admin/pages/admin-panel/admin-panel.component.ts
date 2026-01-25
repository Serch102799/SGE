import { Component, OnInit } from '@angular/core';
import { AdminService, SesionActiva, AccionAuditoria } from '../../../services/admin.service'; 

@Component({
  selector: 'app-admin-panel',
  standalone: false,
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.css']
})
export class AdminPanelComponent implements OnInit {

  // ==========================================
  // 1. ESTADO DE SESIONES ACTIVAS
  // ==========================================
  sesionesActivas: any[] = []; 
  cargandoSesiones: boolean = false;
  errorSesiones: string | null = null;

  // PAGINACIÓN SESIONES (Cliente)
  // Estas variables controlan la tabla de arriba
  pageSesiones: number = 1;
  limitSesiones: number = 5; // Muestra 5 sesiones por página

  // ==========================================
  // 2. ESTADO DE AUDITORÍA GLOBAL
  // ==========================================
  auditoriaGeneral: AccionAuditoria[] = [];
  cargandoAuditoria: boolean = false;
  searchAuditoria: string = '';

  // PAGINACIÓN AUDITORÍA (Servidor)
  // Estas variables controlan la tabla de abajo y la API
  pageAuditoria: number = 1;
  limitAuditoria: number = 10;
  totalAuditoria: number = 0;

  // ==========================================
  // 3. ESTADO DEL MODAL (HISTORIAL)
  // ==========================================
  modalVisible: boolean = false;
  cargandoModal: boolean = false;
  historialUsuario: AccionAuditoria[] = [];
  usuarioSeleccionado: string | null = null;

  constructor(private adminService: AdminService) { }

  ngOnInit(): void {
    this.cargarSesionesActivas();
    this.cargarAuditoriaGeneral();
  }

  // ----------------------------------------------------------------
  // LÓGICA: SESIONES ACTIVAS
  // ----------------------------------------------------------------
  cargarSesionesActivas(): void {
    this.cargandoSesiones = true;
    this.errorSesiones = null;
    
    this.adminService.getSesionesActivas().subscribe({
      next: (data) => {
        this.sesionesActivas = data;
        this.cargandoSesiones = false;
        // Reiniciamos a la página 1 al refrescar para evitar quedar en una página vacía
        this.pageSesiones = 1; 
      },
      error: (err) => {
        console.error(err);
        this.errorSesiones = 'Error al cargar las sesiones. ' + (err.error?.message || err.message);
        this.cargandoSesiones = false;
      }
    });
  }

  onForzarCierre(sesion: SesionActiva): void {
    if (!confirm(`¿Estás seguro de cerrar la sesión de ${sesion.nombre} (${sesion.ip_address})?`)) {
      return;
    }

    // Efecto visual de carga en la fila específica
    sesion['cerrando'] = true; 

    this.adminService.forzarCierreSesion(sesion.id_sesion).subscribe({
      next: () => {
        // Eliminamos localmente para feedback inmediato
        this.sesionesActivas = this.sesionesActivas.filter(s => s.id_sesion !== sesion.id_sesion);
        alert('Sesión cerrada exitosamente.');
      },
      error: (err) => {
        alert('Error al cerrar la sesión: ' + (err.error?.message || err.message));
        delete sesion['cerrando']; // Quitamos el estado de carga si falló
      }
    });
  }

  // ----------------------------------------------------------------
  // LÓGICA: AUDITORÍA (SERVER-SIDE PAGINATION)
  // ----------------------------------------------------------------
  cargarAuditoriaGeneral(): void {
    this.cargandoAuditoria = true;
    
    // Llamamos al servicio pasando página, límite y búsqueda
    this.adminService.getAuditoriaGeneral(this.pageAuditoria, this.limitAuditoria, this.searchAuditoria)
      .subscribe({
        next: (response) => {
          // Asumiendo que tu API devuelve { total: number, data: [] }
          this.auditoriaGeneral = response.data; 
          this.totalAuditoria = response.total;
          this.cargandoAuditoria = false;
        },
        error: (err) => {
          console.error('Error al cargar auditoría:', err);
          this.cargandoAuditoria = false;
        }
      });
  }

  // Evento al cambiar de página en la tabla de Auditoría
  onPageChangeAuditoria(newPage: number): void {
    this.pageAuditoria = newPage;
    this.cargarAuditoriaGeneral();
  }

  // Evento al buscar en Auditoría
  onSearchAuditoria(): void {
    this.pageAuditoria = 1; // Importante: Resetear a página 1 nueva búsqueda
    this.cargarAuditoriaGeneral();
  }

  // Helper para formatear JSON en la vista
  formatDetalles(detalles: any): string {
    if (!detalles) return '-';
    try {
      const obj = typeof detalles === 'string' ? JSON.parse(detalles) : detalles;
      // Intenta convertir objeto a string legible "Clave: Valor"
      return Object.entries(obj)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    } catch (e) {
      return String(detalles);
    }
  }

  // ----------------------------------------------------------------
  // LÓGICA: MODAL HISTORIAL USUARIO
  // ----------------------------------------------------------------
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
        alert('Error al cargar historial: ' + (err.error?.message || err.message));
        this.cargandoModal = false;
        this.modalVisible = false;
      }
    });
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.historialUsuario = [];
    this.usuarioSeleccionado = null;
  }
}