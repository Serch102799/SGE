import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';


export interface Empleado {
  id_empleado: number;
  nombre: string;
  puesto: string;
  departamento: string;
  nombre_usuario: string;
  estado_cuenta: 'Activo' | 'Inactivo';
  rol: string;
}

@Component({
  selector: 'app-usuarios',
  standalone: false,
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit {
  usuarios: Empleado[] = [];
  usuariosFiltrados: Empleado[] = []; 
  private apiUrl = `${environment.apiUrl}/empleados`;

  // --- Propiedades para Modales ---
  mostrarModal = false;
  nuevoEmpleado = {
    Nombre: '',
    Puesto: '',
    Departamento: '',
    Nombre_Usuario: '',
    Contrasena_Hash: '',
    ID_Rol: null as number | null
  };
  roles: { id_rol: number, nombre_rol: string }[] = [];
  
  
  mostrarModalBorrado = false;
  usuarioAEliminar: Empleado | null = null;
  
  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient, public authService: AuthService) { }

  ngOnInit() {
    this.obtenerUsuarios();
    this.cargarRoles();
  }
  cargarRoles() {
  // CAMBIO: Se construye la URL correctamente desde la raíz de la API, no desde la URL de 'empleados'
  const rolesApiUrl = `${environment.apiUrl}/roles`;
  
  this.http.get<any[]>(rolesApiUrl).subscribe({
    next: (data) => {
      this.roles = data;
    },
    error: (err) => console.error('Error al cargar roles', err)
  });
}
  
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }

  obtenerUsuarios() {
    this.http.get<Empleado[]>(this.apiUrl).subscribe({
      next: data => {
        this.usuarios = data;
        this.usuariosFiltrados = data; 
      },
      error: err => console.error('Error al cargar usuarios', err)
    });
  }

  abrirModal(): void {
    this.nuevoEmpleado = {
      Nombre: '', Puesto: '', Departamento: '', Nombre_Usuario: '', Contrasena_Hash: '', ID_Rol: null
    };
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }

  guardarEmpleado(): void {
    if (!this.nuevoEmpleado.Nombre || !this.nuevoEmpleado.Nombre_Usuario || !this.nuevoEmpleado.Contrasena_Hash || !this.nuevoEmpleado.ID_Rol) {
      this.mostrarNotificacion('Campos Requeridos', 'Por favor, completa Nombre, Usuario, Rol y Contraseña.');
      return;
    }
    const payload = {
    Nombre: this.nuevoEmpleado.Nombre,
    Puesto: this.nuevoEmpleado.Puesto,
    Departamento: this.nuevoEmpleado.Departamento,
    Nombre_Usuario: this.nuevoEmpleado.Nombre_Usuario,
    Contrasena_Hash: this.nuevoEmpleado.Contrasena_Hash, // Se envía la contraseña en texto plano
    ID_Rol: this.nuevoEmpleado.ID_Rol           // Se envía el ID numérico del rol
  };

    this.http.post<Empleado>(this.apiUrl, this.nuevoEmpleado).subscribe({
      next: (empleadoCreado) => {
        this.mostrarNotificacion('Éxito', `El empleado ${empleadoCreado.nombre} ha sido creado.`, 'exito');
        this.obtenerUsuarios();
        this.cerrarModal();
      },
      error: (err) => {
        const mensajeError = err.error?.message || err.error?.errores?.[0]?.msg || 'No se pudo crear el empleado.';
        this.mostrarNotificacion('Error', mensajeError, 'error');
      }
    });
  }

  cambiarEstadoUsuario(usuario: Empleado) {
    const nuevoEstado = usuario.estado_cuenta === 'Activo' ? 'Inactivo' : 'Activo';
    const body = { Estado_Cuenta: nuevoEstado };

    this.http.put(`${this.apiUrl}/usuario/${usuario.nombre_usuario}`, body).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', `El estado de ${usuario.nombre} se actualizó a ${nuevoEstado}.`, 'exito');
        this.obtenerUsuarios();
      },
      error: (err) => {
        const mensajeError = err.error?.message || 'No se pudo cambiar el estado.';
        this.mostrarNotificacion('Error', mensajeError, 'error');
      }
    });
  }

  abrirModalBorrado(usuario: Empleado) {
    this.usuarioAEliminar = usuario;
    this.mostrarModalBorrado = true;
  }

  cerrarModalBorrado() {
    this.mostrarModalBorrado = false;
    this.usuarioAEliminar = null;
  }

  confirmarEliminacion() {
    if (!this.usuarioAEliminar) return;

    this.http.delete(`${this.apiUrl}/usuario/${this.usuarioAEliminar.nombre_usuario}`).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', `El usuario ${this.usuarioAEliminar?.nombre_usuario} ha sido desactivado.`, 'exito');
        this.obtenerUsuarios();
        this.cerrarModalBorrado();
      },
      error: (err) => {
        const mensajeError = err.error?.message || 'No se pudo desactivar el usuario.';
        this.mostrarNotificacion('Error', mensajeError, 'error');
        this.cerrarModalBorrado();
      }
    });
  }
}