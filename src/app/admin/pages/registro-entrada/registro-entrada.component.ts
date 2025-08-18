import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environments';


// --- Interfaces ---
interface Proveedor { id_proveedor: number; nombre_proveedor: string; }
interface Empleado { id_empleado: number; nombre: string; }
interface RefaccionSimple { id_refaccion: number; nombre: string; marca: string; numero_parte: string; }
interface DetalleTemporal { idRefaccion: number; nombreRefaccion: string; cantidad: number;  costo_ingresado: number; tipo_costo: 'unitario' | 'neto'; aplica_iva: boolean; }

@Component({
  selector: 'app-registro-entrada',
  standalone: false,
  templateUrl: './registro-entrada.component.html',
  styleUrls: ['./registro-entrada.component.css']
})
export class RegistroEntradaComponent implements OnInit {

  private apiUrl = environment.apiUrl;

  proveedores: Proveedor[] = [];
  empleados: Empleado[] = [];
  refacciones: RefaccionSimple[] = [];

  entradaMaestro = { idProveedor: null as number | null, numeroFacturaProveedor: '', observaciones: '', recibidoPorID: null as number | null };
  detalleActual = { idRefaccion: null as number | null, cantidad: null as number | null, costo_ingresado: null as number | null,  tipo_costo: 'unitario' as 'unitario' | 'neto', aplica_iva: false  };
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
      this.http.get<Proveedor[]>(`${this.apiUrl}/proveedores`),
      this.http.get<Empleado[]>(`${this.apiUrl}/empleados`),
      this.http.get<RefaccionSimple[]>(`${this.apiUrl}/refacciones`)
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
    const { idRefaccion, cantidad, costo_ingresado, tipo_costo, aplica_iva } = this.detalleActual;
    
    if (!idRefaccion || !cantidad || cantidad <= 0 || !costo_ingresado || costo_ingresado <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Por favor, selecciona una refacción, cantidad y costo válidos.');
      return;
    }
    const refaccionSeleccionada = this.refacciones.find(r => r.id_refaccion === idRefaccion);
    if (!refaccionSeleccionada) return;
    if (this.detallesAAgregar.some(d => d.idRefaccion === idRefaccion)) {
      this.mostrarNotificacion('Refacción Duplicada', 'Esta refacción ya ha sido agregada a la lista.');
      return;
    }

    const nuevoDetalle: DetalleTemporal = {
      idRefaccion,
      nombreRefaccion: refaccionSeleccionada.nombre,
      cantidad,
      costo_ingresado,
      tipo_costo,
      aplica_iva
    };

    this.detallesAAgregar = [...this.detallesAAgregar, nuevoDetalle];
    this.detalleActual = { idRefaccion: null, cantidad: null, costo_ingresado: null, tipo_costo: 'unitario', aplica_iva: false };
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

    this.http.post<any>(`${this.apiUrl}/entradas`, payloadMaestro).subscribe({
      next: (respuestaMaestro) => {
        const nuevaEntradaID = respuestaMaestro.id_entrada;
        const peticionesDetalle = this.detallesAAgregar.map(detalle => {
          
          const payloadDetalle = {
            ID_Entrada: nuevaEntradaID,
            ID_Refaccion: detalle.idRefaccion,
            Cantidad_Recibida: detalle.cantidad,
            costo_ingresado: detalle.costo_ingresado,
            tipo_costo: detalle.tipo_costo,
            aplica_iva: detalle.aplica_iva
          };
          return this.http.post(`${this.apiUrl}/detalle-entrada`, payloadDetalle);
        });

        forkJoin(peticionesDetalle).subscribe({
          next: () => {
            sessionStorage.setItem('notificacion', '¡Entrada registrada exitosamente!');
            this.isSaving = false;
            this.router.navigate(['/admin/entradas']);
          },
          error: err => {
            const serverMessage = err.error?.message || 'Error desconocido al guardar detalles.';
            this.mostrarNotificacion('Error al Guardar Detalles', serverMessage, 'error');
            this.isSaving = false;
          }
        });
      },
      error: err => {
        const serverMessage = err.error?.message || 'Error desconocido al crear la entrada.';
        this.mostrarNotificacion('Error al Crear Entrada', serverMessage, 'error');
        this.isSaving = false;
      }
    });
  }

  regresar() { this.location.back(); }
}