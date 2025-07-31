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

  // Los getters para los campos del formulario se mantienen igual
  get nombreUsuario() { return this.loginForm.get('nombreUsuario'); }
  get password() { return this.loginForm.get('password'); }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched(); 
      return;
    }

    this.errorMessage = null; // Limpia errores previos
    const { nombreUsuario, password } = this.loginForm.value;

    this.authService.login({ 
      Nombre_Usuario: nombreUsuario, 
      Contrasena: password 
    }).subscribe({
      next: (response) => {
        // El login fue exitoso
        console.log('Login exitoso, redirigiendo...');
        this.router.navigate(['/admin/dashboard']); 
      },
      error: (err) => {
        console.error('Error recibido en el componente:', err);
        this.errorMessage = 'Credenciales incorrectas. Verifica tu usuario y contraseña.';
      }
    });
  }
}