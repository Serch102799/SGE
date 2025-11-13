import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http'; // <-- Agregado HttpParams
import { Observable } from 'rxjs';
import { environment } from '../../environments/environments';

// Define interfaces para los datos
export interface SesionActiva {
  id_sesion: number;
  fecha_login: string;
  ip_address: string;
  user_agent: string;
  nombre: string;
  puesto: string;
  id_usuario: number;
  cerrando?: boolean;
}

export interface AccionAuditoria {
  timestamp: string;
  tipo_accion: string;
  recurso_afectado: string;
  id_recurso_afectado: number;
  detalles_cambio: any;
  ip_address: string;
  nombre_usuario?: string;
}

export interface RespuestaAuditoria {
  total: number;
  data: AccionAuditoria[];
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiUrl}/superadmin`; 

  constructor(private http: HttpClient) { }

  // Helper para headers (si no usas interceptor)
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });
  }

  // 1. Obtener la lista de sesiones activas
  getSesionesActivas(): Observable<SesionActiva[]> {
    return this.http.get<SesionActiva[]>(`${this.apiUrl}/sesiones`, { headers: this.getHeaders() });
  }

  // 2. Forzar el cierre de una sesión
  forzarCierreSesion(id_sesion: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/sesiones/cerrar/${id_sesion}`, {}, { headers: this.getHeaders() });
  }

  // 3. Obtener el historial de auditoría de un usuario específico
  getAuditoriaUsuario(id_usuario: number): Observable<AccionAuditoria[]> {
    return this.http.get<AccionAuditoria[]>(`${this.apiUrl}/auditoria/${id_usuario}`, { headers: this.getHeaders() });
  }

  // 4. NUEVO: Obtener auditoría general (paginada y filtrada)
  getAuditoriaGeneral(page: number = 1, limit: number = 20, search: string = ''): Observable<RespuestaAuditoria> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    
    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<RespuestaAuditoria>(`${this.apiUrl}/auditoria`, { 
      headers: this.getHeaders(),
      params: params 
    });
  }
}