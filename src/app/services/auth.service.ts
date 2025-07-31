import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environments';

export interface AuthResponse {
  message: string;
  empleado: {
    id: number;
    nombre: string;
    puesto: string;
    rol: string;
  };
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
    private apiUrl = environment.apiUrl; 

  private _isLoggedIn = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this._isLoggedIn.asObservable();

  private readonly isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.checkToken();
  }

  private checkToken(): void {
    if (this.isBrowser) {
      const token = this.getToken();
      this._isLoggedIn.next(!!token);
    }
  }

  login(credentials: { Nombre_Usuario: string, Contrasena: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          this.saveToken(response.token, response.empleado);
          this._isLoggedIn.next(true);
        })
      );
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('current_user');
      this._isLoggedIn.next(false);
      this.router.navigate(['/login']);
    }
  }

  private saveToken(token: string, user: any): void {
    if (this.isBrowser) {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('current_user', JSON.stringify(user));
    }
  }

  getToken(): string | null {
    if (this.isBrowser) {
      return localStorage.getItem('auth_token');
    }
    return null;
  }
  getCurrentUser(): CurrentUser | null {
    if (this.isBrowser) {
      const user = localStorage.getItem('current_user');
      return user ? JSON.parse(user) : null;
    }
    return null;
  }
  
 
  /**
   * Verifica si el usuario actual tiene uno de los roles especificados.
   * @param roles - Un arreglo de roles permitidos (ej. ['Admin']).
   */
  hasRole(roles: string[]): boolean {
    if (!this.isBrowser) {
      return false;
    }
    const user = this.getCurrentUser();
    if (!user || !user.rol) {
      return false;
    }
    return roles.includes(user.rol);
  }
}