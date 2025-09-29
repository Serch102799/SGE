import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environments';

// --- Interfaces ---
export interface AuthResponse {
  message: string;
  empleado: CurrentUser;
  token: string;
}

export interface CurrentUser {
  id: number;
  nombre: string;
  puesto: string;
  rol: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`; // URL base para autenticación

  // BehaviorSubject para mantener el estado del usuario actual
  private currentUserSubject: BehaviorSubject<CurrentUser | null>;
  public currentUser$: Observable<CurrentUser | null>;
  
  private readonly isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    
    // Al iniciar el servicio, intenta cargar el usuario desde localStorage
    const storedUser = this.isBrowser ? localStorage.getItem('current_user') : null;
    this.currentUserSubject = new BehaviorSubject<CurrentUser | null>(storedUser ? JSON.parse(storedUser) : null);
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  /**
   * Devuelve el valor actual del usuario logueado.
   */
  public get currentUserValue(): CurrentUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * Realiza la petición de login al backend.
   * @param credentials - Objeto con Nombre_Usuario y Contrasena.
   */
  login(credentials: { Nombre_Usuario: string, Contrasena: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          if (response.token && response.empleado) {
            // Guarda la información en localStorage
            if (this.isBrowser) {
              localStorage.setItem('token', response.token);
              localStorage.setItem('current_user', JSON.stringify(response.empleado));
            }
            // Notifica a toda la aplicación sobre el nuevo usuario
            this.currentUserSubject.next(response.empleado);

            // --- LÓGICA DE REDIRECCIÓN POR ROL ---
            this.redirectUserByRole(response.empleado.rol);
          }
        })
      );
  }

  /**
   * Cierra la sesión del usuario.
   */
  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('token');
      localStorage.removeItem('current_user');
    }
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  /**
   * Obtiene el token JWT del almacenamiento local.
   */
  getToken(): string | null {
    if (this.isBrowser) {
      return localStorage.getItem('token');
    }
    return null;
  }

  /**
   * Verifica si el usuario actual tiene uno de los roles especificados.
   * @param roles - Un arreglo de roles permitidos (ej. ['Admin', 'SuperUsuario']).
   */
  hasRole(roles: string[]): boolean {
    const user = this.currentUserValue;
    if (!user || !user.rol) {
      return false;
    }
    return roles.includes(user.rol);
  }

  /**
   * Redirige al usuario a la página correspondiente según su rol.
   * @param rol - El rol del usuario.
   */
  private redirectUserByRole(rol: string): void {
    switch (rol) {
      case 'AdminDiesel':
        this.router.navigate(['/admin/tanques']);
        break;

      default:
        this.router.navigate(['/admin/dashboard']);
        break;
    }
  }
}