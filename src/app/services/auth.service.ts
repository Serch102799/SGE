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
  private apiUrl = `${environment.apiUrl}/auth`;

  private currentUserSubject: BehaviorSubject<CurrentUser | null>;
  public currentUser$: Observable<CurrentUser | null>;
  
  private readonly isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    
    const storedUser = this.isBrowser ? localStorage.getItem('current_user') : null;
    this.currentUserSubject = new BehaviorSubject<CurrentUser | null>(storedUser ? JSON.parse(storedUser) : null);
    this.currentUser$ = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): CurrentUser | null {
    return this.currentUserSubject.value;
  }

  login(credentials: { Nombre_Usuario: string, Contrasena: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          if (response.token && response.empleado) {
            if (this.isBrowser) {
              localStorage.setItem('token', response.token);
              localStorage.setItem('current_user', JSON.stringify(response.empleado));
            }
            this.currentUserSubject.next(response.empleado);
            this.redirectUserByRole(response.empleado.rol);
          }
        })
      );
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('token');
      localStorage.removeItem('current_user');
    }
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    if (this.isBrowser) {
      return localStorage.getItem('token');
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

  hasRole(roles: string[]): boolean {
    const user = this.currentUserValue;
    if (!user || !user.rol) {
      return false;
    }
    return roles.includes(user.rol);
  }

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