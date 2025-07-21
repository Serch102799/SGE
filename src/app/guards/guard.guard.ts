import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean {
    if (this.authService.getToken()) {
      // Si existe un token, el usuario puede pasar
      return true;
    } else {
      this.router.navigate(['/login']);
      return false;
    }
  }
}