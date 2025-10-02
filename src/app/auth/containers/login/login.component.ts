import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string | null = null; 

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService 
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      nombreUsuario: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      remember: [false]
    });
  }

  get nombreUsuario() { return this.loginForm.get('nombreUsuario'); }
  get password() { return this.loginForm.get('password'); }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched(); 
      return;
    }

    this.errorMessage = null;
    const { nombreUsuario, password } = this.loginForm.value;

    this.authService.login({ 
      Nombre_Usuario: nombreUsuario, 
      Contrasena: password 
    }).subscribe({
      next: (response) => {
        // CAMBIO: Se elimina la redirección explícita de aquí.
        // Ahora el AuthService se encarga de todo.
        console.log('Login exitoso, el servicio de autenticación redirigirá...');
      },
      error: (err) => {
        console.error('Error recibido en el componente:', err);
        this.errorMessage = err.error?.message || 'Credenciales incorrectas.';
      }
    });
  }
}