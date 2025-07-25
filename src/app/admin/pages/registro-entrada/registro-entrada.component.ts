import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';

// --- Interfaces ---
interface Proveedor { id_proveedor: number; nombre_proveedor: string; }
interface Empleado { id_empleado: number; nombre: string; }
interface RefaccionSimple { id_refaccion: number; nombre: string; marca: string; numero_parte: string; }
interface DetalleTemporal { idRefaccion: number; nombreRefaccion: string; cantidad: number; costo: number; }

@Component({
  selector: 'app-registro-entrada',
  standalone: false,
  templateUrl: './registro-entrada.component.html',
  styleUrls: ['./registro-entrada.component.css']
})
export class RegistroEntradaComponent implements OnInit {

  proveedores: Proveedor[] = [];
  empleados: Empleado[] = [];
  refacciones: RefaccionSimple[] = [];

  entradaMaestro = { idProveedor: null as number | null, numeroFacturaProveedor: '', observaciones: '', recibidoPorID: null as number | null };
  detalleActual = { idRefaccion: null as number | null, cantidad: null as number | null, costo: null as number | null };
  detallesAAgregar: DetalleTemporal[] = [];
  isSaving = false;

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient, private router: Router, private location: Location) {}

  ngOnInit(): void { this.cargarCatalogos(); }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
  
  cargarCatalogos() {
    const peticiones = [
      this.http.get<Proveedor[]>('http://localhost:3000/api/proveedores'),
      this.http.get<Empleado[]>('http://localhost:3000/api/empleados'),
      this.http.get<RefaccionSimple[]>('http://localhost:3000/api/refacciones')
    ];

    forkJoin(peticiones).subscribe({
      next: ([proveedores, empleados, refacciones]) => {
        this.proveedores = proveedores as Proveedor[];
        this.empleados = empleados as Empleado[];
        this.refacciones = refacciones as RefaccionSimple[];
      },
      error: err => {
        console.error('Error al cargar los catálogos', err);
        this.mostrarNotificacion('Error de Carga', 'No se pudieron cargar los datos necesarios para el formulario.', 'error');
      }
    });
  }

  agregarDetalle() {
    const { idRefaccion, cantidad, costo } = this.detalleActual;
    if (!idRefaccion || !cantidad || cantidad <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Por favor, selecciona una refacción y una cantidad válida.');
      return;
    }
    const refaccionSeleccionada = this.refacciones.find(r => r.id_refaccion === idRefaccion);
    if (!refaccionSeleccionada) return;
    if (this.detallesAAgregar.some(d => d.idRefaccion === idRefaccion)) {
      this.mostrarNotificacion('Refacción Duplicada', 'Esta refacción ya ha sido agregada a la lista.');
      return;
    }
    const nuevoDetalle = { idRefaccion, nombreRefaccion: refaccionSeleccionada.nombre, cantidad, costo: costo ?? 0 };
    this.detallesAAgregar = [...this.detallesAAgregar, nuevoDetalle];
    this.detalleActual = { idRefaccion: null, cantidad: null, costo: null };
  }

  eliminarDetalle(index: number) {
    this.detallesAAgregar = this.detallesAAgregar.filter((_, i) => i !== index);
  }

  guardarEntradaCompleta() {
    if (this.isSaving) return;
    if (!this.entradaMaestro.idProveedor || !this.entradaMaestro.recibidoPorID) {
      this.mostrarNotificacion('Datos Incompletos', 'Debes seleccionar un proveedor y quién recibe la mercancía.');
      return;
    }
    if (this.detallesAAgregar.length === 0) {
      this.mostrarNotificacion('Sin Detalles', 'Debes agregar al menos una refacción a la entrada.');
      return;
    }
    this.isSaving = true;
    const payloadMaestro = {
      ID_Proveedor: this.entradaMaestro.idProveedor,
      Numero_Factura_Proveedor: this.entradaMaestro.numeroFacturaProveedor,
      Observaciones: this.entradaMaestro.observaciones,
      Recibido_Por_ID: this.entradaMaestro.recibidoPorID
    };
    this.http.post<any>('http://localhost:3000/api/entradas', payloadMaestro).subscribe({
      next: (respuestaMaestro) => {
        const nuevaEntradaID = respuestaMaestro.id_entrada;
        const peticionesDetalle = this.detallesAAgregar.map(detalle => {
          const payloadDetalle = {
            ID_Entrada: nuevaEntradaID,
            ID_Refaccion: detalle.idRefaccion,
            Cantidad_Recibida: detalle.cantidad,
            Costo_Unitario_Entrada: detalle.costo
          };
          return this.http.post('http://localhost:3000/api/detalle-entrada', payloadDetalle);
        });
        forkJoin(peticionesDetalle).subscribe({
          next: () => {
            sessionStorage.setItem('notificacion', '¡Entrada registrada exitosamente!');
            this.isSaving = false;
            this.router.navigate(['/admin/entradas']);
          },
          error: err => {
            const serverMessage = err.error?.message || err.message || 'Error desconocido.';
            this.mostrarNotificacion('Error al Guardar Detalles', serverMessage, 'error');
            this.isSaving = false;
          }
        });
      },
      error: err => {
        const serverMessage = err.error?.message || err.message || 'Error desconocido.';
        this.mostrarNotificacion('Error al Crear Entrada', serverMessage, 'error');
        this.isSaving = false;
      }
    });
  }

  regresar() { this.location.back(); }
}