import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const rolesRequeridos = route.data['roles'] as string[];

    // Si no se especificaron roles, permite el acceso
    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    if (this.authService.hasRole(rolesRequeridos)) {
      return true; // El usuario tiene el rol, puede pasar
    } else {
      alert('Acceso denegado: No tienes los permisos necesarios.');
      this.router.navigate(['/admin/dashboard']);
      return false;
    }
  }
}