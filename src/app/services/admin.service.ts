import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environments'; // Asumiendo que tienes tu apiUrl aquí

// (Opcional) Define interfaces para los datos
export interface SesionActiva {
  id_sesion: number;
  fecha_login: string;
  ip_address: string;
  user_agent: string;
  nombre: string;
  puesto: string;
  id_usuario: number;
  cerrando?: boolean; // Necesitaremos esto para el modal
}

export interface AccionAuditoria {
  timestamp: string;
  tipo_accion: string;
  recurso_afectado: string;
  id_recurso_afectado: number;
  detalles_cambio: any;
  ip_address: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiUrl}/admin`; // Ej: 'http://localhost:3000/api/admin'

  constructor(private http: HttpClient) { }

  // 1. Obtener la lista de sesiones activas
  getSesionesActivas(): Observable<SesionActiva[]> {
    // El token se debe añadir con un HttpInterceptor, pero lo pongo aquí por claridad
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });
    return this.http.get<SesionActiva[]>(`${this.apiUrl}/sesiones`, { headers });
  }

  // 2. Forzar el cierre de una sesión
  forzarCierreSesion(id_sesion: number): Observable<any> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });
    return this.http.post(`${this.apiUrl}/sesiones/cerrar/${id_sesion}`, {}, { headers });
  }

  // 3. Obtener el historial de auditoría de un usuario
  getAuditoriaUsuario(id_usuario: number): Observable<AccionAuditoria[]> {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });
    return this.http.get<AccionAuditoria[]>(`${this.apiUrl}/auditoria/${id_usuario}`, { headers });
  }
}