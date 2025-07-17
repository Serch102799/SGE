import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http'; // Importa HttpErrorResponse
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) {}

  regresar() {
    // Si quieres regresar al login, esta línea está bien.
    // Si quieres regresar a la página principal del sitio, podrías usar: this.router.navigate(['/']);
    this.router.navigate(['/auth/login']);
  }

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      nombreUsuario: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      remember: [false]
    });
  }

  get nombreUsuario() {
    return this.loginForm.get('nombreUsuario');
  }

  get password() {
    return this.loginForm.get('password');
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      console.error('Formulario inválido. Errores:', this.loginForm.errors);
      console.error('Errores en nombreUsuario:', this.nombreUsuario?.errors);
      console.error('Errores en password:', this.password?.errors);
      alert('Por favor, completa correctamente todos los campos.');
      return;
    }

    const { nombreUsuario, password } = this.loginForm.value;
    console.log('Credenciales a enviar:', { nombreUsuario, password });

    this.http
      .post<{ token: string, empleado: any }>('http://localhost:3000/api/login', {
        Nombre_Usuario: nombreUsuario,
        Contrasena: password
      })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          console.error('Error en la petición de login:', err);
          let errorMessage = 'Error desconocido. Intenta de nuevo.';
          if (err.error instanceof ErrorEvent) {
            errorMessage = `Error del cliente: ${err.error.message}`;
          } else {
            if (err.status === 401) {
              errorMessage = 'Credenciales incorrectas. Verifica tu usuario y contraseña.';
            } else if (err.status === 404) {
                errorMessage = 'La ruta de login del servidor no fue encontrada.';
            } else if (err.status === 500) {
                errorMessage = 'Error interno del servidor. Contacta al administrador.';
            } else {
              errorMessage = `Error del servidor: ${err.status} - ${err.message}`;
            }
          }
          alert(errorMessage);
          return of(null);
        })
      )
      .subscribe(response => {
        console.log('Respuesta del servidor:', response);

        if (response) {
          localStorage.setItem('token', response.token);
          localStorage.setItem('empleado', JSON.stringify(response.empleado));
          console.log('Login exitoso. Token y empleado almacenados.');

          const puesto = response.empleado?.puesto?.toLowerCase();
          console.log('Puesto del empleado (minúsculas):', puesto);

          // CAMBIO CLAVE AQUÍ: REDIRECCIÓN AL DASHBOARD DE ADMIN
          if (puesto === 'almacenista') { // ¡Asegúrate de que 'almacenista' coincida con lo que tu backend envía!
            this.router.navigate(['/admin/dashboard']); // Redirige a /admin/dashboard
            console.log('Redirigiendo a /admin/dashboard');
          } else {
            // Si hay otros roles, puedes redirigirlos a otras secciones
            // O si es un dashboard general que no requiere la ruta /admin/
            this.router.navigate(['/admin/dashboard']); // Si tienes un dashboard no-admin.
            console.log('Redirigiendo a /dashboard');
          }
        } else {
          console.log('La respuesta fue nula, no se pudo procesar el login (posiblemente por catchError).');
        }
      });
  }
}