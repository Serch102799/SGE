import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-menu',
  standalone: false,
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'] 
})
export class MenuComponent implements OnInit {
  usuarioNombre: string = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    const usuario = localStorage.getItem('usuario');
    if (usuario) {
      this.usuarioNombre = JSON.parse(usuario).nombre; 
    }
  }

  onClickRegistro() {
    this.router.navigate(['/registro-usuarios']);
  }

  onClickCatalogo() {
    this.router.navigate(['/catalogo-usuarios']);
  }

  onClickAgregar() {
    this.router.navigate(['/agregar-producto']);
  }

  onClickProducto() {
    this.router.navigate(['/catalogo-producto']);
  }

  onClickSalir() {
    localStorage.removeItem('token'); 
    localStorage.removeItem('usuario'); 
    this.router.navigate(['/login']);
  }
}
