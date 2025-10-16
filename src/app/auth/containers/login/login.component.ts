import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  animations: [
    trigger('formState', [
      state('hidden', style({
        opacity: 0,
        transform: 'scale(0.95) translateY(-20px)'
      })),
      state('visible', style({
        opacity: 1,
        transform: 'scale(1) translateY(0)'
      })),
      transition('hidden <=> visible', animate('600ms cubic-bezier(0.34, 1.56, 0.64, 1)'))
    ]),
    trigger('logoState', [
      state('expanded', style({
        transform: 'translateY(-80px) scale(0.6)',
        opacity: 0.7
      })),
      state('collapsed', style({
        transform: 'translateY(0) scale(1)',
        opacity: 1
      })),
      transition('* <=> *', animate('600ms cubic-bezier(0.34, 1.56, 0.64, 1)'))
    ])
  ]
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string | null = null;
  isFormVisible = false;
  isLoading = false;

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

  toggleForm(): void {
    this.isFormVisible = !this.isFormVisible;
    this.errorMessage = null;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;
    const { nombreUsuario, password } = this.loginForm.value;

    this.authService.login({
      Nombre_Usuario: nombreUsuario,
      Contrasena: password
    }).subscribe({
      next: (response) => {
        console.log('Login exitoso, el servicio de autenticación redirigirá...');
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error recibido en el componente:', err);
        this.errorMessage = err.error?.message || 'Credenciales incorrectas.';
      }
    });
  }
}