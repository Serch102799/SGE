import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private apiUrl = 'http://localhost:3000/api/empleados';

  constructor(private http: HttpClient) {}

  obtenerUsuarios() {
    return this.http.get<any[]>(this.apiUrl);
  }

  crearUsuario(data: any) {
    return this.http.post(this.apiUrl, data);
  }

  actualizarEstado(nombreUsuario: string, data: any) {
    return this.http.put(`${this.apiUrl}/usuario/${nombreUsuario}`, data);
  }

  eliminarUsuario(nombreUsuario: string) {
    return this.http.delete(`${this.apiUrl}/usuario/${nombreUsuario}`);
  }
}
