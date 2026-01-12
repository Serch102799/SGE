import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';

// Definición de interfaces para mejor tipado
export interface Empleado {
  id_empleado: number;
  nombre: string;
  puesto: string;
  departamento: string;
  nombre_usuario: string;
  estado_cuenta: 'Activo' | 'Inactivo';
  rol: string; 
  id_rol?: number; // Agregado porque el backend puede devolverlo
}

@Component({
  selector: 'app-usuarios',
  standalone: false, 
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit {
  
  // --- Variables de Datos ---
  usuarios: Empleado[] = [];
  usuariosFiltrados: Empleado[] = []; 
  roles: { id_rol: number, nombre_rol: string }[] = [];

  private apiUrl = `${environment.apiUrl}/empleados`;

  // --- Búsqueda y Filtros ---
  terminoBusqueda: string = '';
  filtroEstado: 'Todos' | 'Activo' | 'Inactivo' = 'Todos';

  // --- Propiedades para Modal Agregar/Editar ---
  mostrarModal = false;
  modoEdicion = false; // TRUE si estamos editando, FALSE si es nuevo
  idEmpleadoEdicion: number | null = null; // Para saber a quién estamos editando

  nuevoEmpleado = {
    Nombre: '',
    Puesto: '',
    Departamento: '',
    Nombre_Usuario: '',
    Contrasena_Hash: '', // Solo para creación
    ID_Rol: null as number | null,
    Estado_Cuenta: 'Activo' // Por defecto
  };

  // --- Propiedades para Modal Borrado ---
  mostrarModalBorrado = false;
  usuarioAEliminar: Empleado | null = null;
  
  // --- Propiedades para Modal Credencial (ID Card) ---
  modalCredencialVisible: boolean = false;
  usuarioSeleccionado: any = null;

  // --- Propiedades para Notificaciones ---
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

  // ==========================================
  // CARGA DE DATOS
  // ==========================================
  obtenerUsuarios() {
    this.http.get<Empleado[]>(this.apiUrl).subscribe({
      next: data => {
        this.usuarios = data;
        this.filtrarUsuarios(); // Aplicar filtros iniciales
      },
      error: err => console.error('Error al cargar usuarios', err)
    });
  }

  cargarRoles() {
    const rolesApiUrl = `${environment.apiUrl}/roles`;
    this.http.get<any[]>(rolesApiUrl).subscribe({
      next: (data) => {
        this.roles = data;
      },
      error: (err) => console.error('Error al cargar roles', err)
    });
  }

  // ==========================================
  // LÓGICA DE BÚSQUEDA Y FILTROS (NUEVO)
  // ==========================================
  
  // 1. Cambiar filtro de estado (Botones superiores)
  cambiarFiltroEstado(estado: 'Todos' | 'Activo' | 'Inactivo') {
    this.filtroEstado = estado;
    this.filtrarUsuarios();
  }

  // 2. Filtro maestro (Texto + Estado)
  filtrarUsuarios() {
    const termino = this.terminoBusqueda.toLowerCase().trim();
    
    // Filtro 1: Búsqueda de texto
    let resultado = this.usuarios.filter(usuario => {
      const coincideTexto = 
        usuario.nombre.toLowerCase().includes(termino) ||
        usuario.nombre_usuario.toLowerCase().includes(termino) ||
        (usuario.puesto && usuario.puesto.toLowerCase().includes(termino));
      return coincideTexto;
    });

    // Filtro 2: Estado (Si no es 'Todos')
    if (this.filtroEstado !== 'Todos') {
      resultado = resultado.filter(u => u.estado_cuenta === this.filtroEstado);
    }

    this.usuariosFiltrados = resultado;
  }

  // ==========================================
  // MODAL AGREGAR / EDITAR
  // ==========================================
  abrirModal(): void {
    this.modoEdicion = false;
    this.idEmpleadoEdicion = null;
    // Limpiar formulario
    this.nuevoEmpleado = {
      Nombre: '', Puesto: '', Departamento: '', Nombre_Usuario: '', 
      Contrasena_Hash: '', ID_Rol: null, Estado_Cuenta: 'Activo'
    };
    this.mostrarModal = true;
  }

  abrirModalEditar(usuario: Empleado): void {
    this.modoEdicion = true;
    this.idEmpleadoEdicion = usuario.id_empleado;
    
    // Mapear datos del usuario seleccionado al formulario
    this.nuevoEmpleado = {
      Nombre: usuario.nombre,
      Puesto: usuario.puesto,
      Departamento: usuario.departamento,
      Nombre_Usuario: usuario.nombre_usuario,
      Contrasena_Hash: '', // No mostramos la contraseña en edición
      ID_Rol: usuario.id_rol || null, 
      Estado_Cuenta: usuario.estado_cuenta
    };
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }

  guardarEmpleado(): void {
    // Validaciones básicas
    if (!this.nuevoEmpleado.Nombre || !this.nuevoEmpleado.Nombre_Usuario || !this.nuevoEmpleado.ID_Rol) {
      this.mostrarNotificacion('Campos Requeridos', 'Nombre, Usuario y Rol son obligatorios.');
      return;
    }

    // Validación de contraseña solo si es nuevo
    if (!this.modoEdicion && !this.nuevoEmpleado.Contrasena_Hash) {
        this.mostrarNotificacion('Campos Requeridos', 'La contraseña es obligatoria para nuevos usuarios.');
        return;
    }

    if (this.modoEdicion) {
        this.actualizarEmpleadoExistente();
    } else {
        this.crearNuevoEmpleado();
    }
  }

  crearNuevoEmpleado() {
    this.http.post<Empleado>(this.apiUrl, this.nuevoEmpleado).subscribe({
      next: (empleadoCreado) => {
        this.mostrarNotificacion('Éxito', `Usuario ${empleadoCreado.nombre} creado correctamente.`, 'exito');
        this.obtenerUsuarios();
        this.cerrarModal();
      },
      error: (err) => {
        const msg = err.error?.message || 'Error al crear usuario.';
        this.mostrarNotificacion('Error', msg, 'error');
      }
    });
  }

  actualizarEmpleadoExistente() {
      // Preparamos los datos completos para enviar al backend
      const payload = {
          Nombre: this.nuevoEmpleado.Nombre,
          Puesto: this.nuevoEmpleado.Puesto,
          Departamento: this.nuevoEmpleado.Departamento,
          Nombre_Usuario: this.nuevoEmpleado.Nombre_Usuario,
          ID_Rol: this.nuevoEmpleado.ID_Rol,
          Estado_Cuenta: this.nuevoEmpleado.Estado_Cuenta
      };

      this.http.put(`${this.apiUrl}/${this.idEmpleadoEdicion}`, payload).subscribe({
          next: () => {
              this.mostrarNotificacion('Éxito', 'Información actualizada correctamente.', 'exito');
              this.obtenerUsuarios();
              this.cerrarModal();
          },
          error: (err) => {
              console.error(err);
              this.mostrarNotificacion('Error', 'No se pudieron guardar los cambios. Verifica el backend.', 'error');
          }
      });
  }

  // ==========================================
  // MODAL BORRADO / DESACTIVACIÓN
  // ==========================================
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
        this.mostrarNotificacion('Desactivado', `El usuario ha sido desactivado.`, 'exito');
        this.obtenerUsuarios();
        this.cerrarModalBorrado();
      },
      error: (err) => {
        const msg = err.error?.message || 'Error al desactivar.';
        this.mostrarNotificacion('Error', msg, 'error');
        this.cerrarModalBorrado();
      }
    });
  }

  // ==========================================
  // MODAL CREDENCIAL (ID CARD)
  // ==========================================
  verCredencial(usuario: any) {
    this.usuarioSeleccionado = usuario;
    this.modalCredencialVisible = true;
  }

  cerrarCredencial() {
    this.modalCredencialVisible = false;
    this.usuarioSeleccionado = null;
  }

  // ==========================================
  // NOTIFICACIONES
  // ==========================================
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}