import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService, CurrentUser } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';

@Component({
  selector: 'app-perfil',
  standalone: false,
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit {

  currentUser: CurrentUser | null = null;
  passwordForm: FormGroup;

   private apiUrl = `${environment.apiUrl}/auth`;

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validator: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
  }

  // Validador personalizado para asegurar que las nuevas contraseñas coincidan
  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { mismatch: true };
  }

  onSubmit() {
    if (this.passwordForm.invalid) {
      this.mostrarNotificacion('Formulario Inválido', 'Por favor, completa todos los campos correctamente.');
      return;
    }

    const { currentPassword, newPassword } = this.passwordForm.value;
    
    this.http.put(`${this.apiUrl}/change-password`, { currentPassword, newPassword })
      .subscribe({
        next: (res: any) => {
          this.mostrarNotificacion('Éxito', res.message, 'exito');
          this.passwordForm.reset();
        },
        error: (err) => {
          this.mostrarNotificacion('Error', err.error?.message || 'No se pudo cambiar la contraseña.', 'error');
        }
      });
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}