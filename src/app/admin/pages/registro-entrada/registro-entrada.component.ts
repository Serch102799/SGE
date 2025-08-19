import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';

// --- Interfaces ---
interface Proveedor { id_proveedor: number; nombre_proveedor: string; }
interface Empleado { id_empleado: number; nombre: string; }
interface ItemSimple { id: number; nombre: string; } // Interfaz genérica para los dropdowns

// Interfaz para los items en la lista de "agregados"
interface DetalleTemporal {
  id: number;
  nombre: string;
  tipo: 'Refacción' | 'Insumo';
  cantidad: number;
  costo_ingresado: number;
  tipo_costo: 'unitario' | 'neto';
  aplica_iva: boolean;
}

@Component({
  selector: 'app-registro-entrada',
  standalone: false,
  templateUrl: './registro-entrada.component.html',
  styleUrls: ['./registro-entrada.component.css']
})
export class RegistroEntradaComponent implements OnInit {

  private apiUrl = environment.apiUrl;

  // --- Catálogos ---
  proveedores: Proveedor[] = [];
  empleados: Empleado[] = [];
  refacciones: ItemSimple[] = [];
  insumos: ItemSimple[] = [];

  // --- Formulario Maestro ---
  entradaMaestro = {
    idProveedor: null as number | null,
    numeroFacturaProveedor: '',
    observaciones: '',
    recibidoPorID: null as number | null
  };
  
  // --- Formulario de Detalle (unificado) ---
  detalleActual = {
    tipo_item: 'Refacción' as 'Refacción' | 'Insumo',
    id_item: null as number | null,
    cantidad: null as number | null,
    costo_ingresado: null as number | null,
    tipo_costo: 'unitario' as 'unitario' | 'neto',
    aplica_iva: false
  };

  // --- Lista de Items a Agregar ---
  detallesAAgregar: DetalleTemporal[] = [];
  isSaving = false;

  // --- Notificaciones ---
  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient, private router: Router, private location: Location) {}

  ngOnInit(): void {
    this.cargarCatalogos();
  }
  
  cargarCatalogos() {
    const peticiones = [
      this.http.get<Proveedor[]>(`${this.apiUrl}/proveedores`),
      this.http.get<Empleado[]>(`${this.apiUrl}/empleados`),
      this.http.get<any[]>(`${this.apiUrl}/refacciones`).pipe(catchError(() => of([]))),
      this.http.get<any[]>(`${this.apiUrl}/insumos`).pipe(catchError(() => of([])))
    ];

    forkJoin(peticiones).subscribe({
      next: ([proveedores, empleados, refacciones, insumos]) => {
        this.proveedores = proveedores as Proveedor[];
        this.empleados = empleados as Empleado[];
        // Se mapean los datos a una interfaz genérica para los dropdowns
        this.refacciones = (refacciones as any[]).map(r => ({ id: r.id_refaccion, nombre: `${r.nombre} - ${r.marca}` }));
        this.insumos = (insumos as any[]).map(i => ({ id: i.id_insumo, nombre: i.nombre }));
      },
      error: err => {
        console.error('Error al cargar los catálogos', err);
        this.mostrarNotificacion('Error de Carga', 'No se pudieron cargar los datos necesarios para el formulario.', 'error');
      }
    });
  }

  // Se resetea el ID del item cuando el usuario cambia de tipo (Refacción/Insumo)
  onTipoItemChange(): void {
    this.detalleActual.id_item = null;
  }

  agregarDetalle() {
    console.log('Datos del detalle al hacer clic:', this.detalleActual); 
    const { tipo_item, id_item, cantidad, costo_ingresado, tipo_costo, aplica_iva } = this.detalleActual;
    
    if (!id_item || !cantidad || cantidad <= 0 || !costo_ingresado || costo_ingresado <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Por favor, selecciona un ítem, cantidad y costo válidos.');
      return;
    }

    const listaItems = tipo_item === 'Refacción' ? this.refacciones : this.insumos;
    const itemSeleccionado = listaItems.find(item => item.id === id_item);
    if (!itemSeleccionado) return;

    if (this.detallesAAgregar.some(d => d.id === id_item && d.tipo === tipo_item)) {
      this.mostrarNotificacion('Ítem Duplicado', `Este ${tipo_item.toLowerCase()} ya ha sido agregado a la lista.`);
      return;
    }

    const nuevoDetalle: DetalleTemporal = {
      id: id_item,
      nombre: itemSeleccionado.nombre,
      tipo: tipo_item,
      cantidad,
      costo_ingresado,
      tipo_costo,
      aplica_iva
    };

    this.detallesAAgregar = [...this.detallesAAgregar, nuevoDetalle];
    this.resetDetalleActual();
  }
  
  resetDetalleActual(): void {
    // Resetea el formulario de detalle manteniendo el último tipo de item seleccionado
    const tipoActual = this.detalleActual.tipo_item;
    this.detalleActual = { tipo_item: tipoActual, id_item: null, cantidad: null, costo_ingresado: null, tipo_costo: 'unitario', aplica_iva: false };
  }

  eliminarDetalle(index: number): void {
    this.detallesAAgregar = this.detallesAAgregar.filter((_, i) => i !== index);
  }

  guardarEntradaCompleta() {
    if (this.isSaving) return;
    if (!this.entradaMaestro.idProveedor || !this.entradaMaestro.recibidoPorID) {
      this.mostrarNotificacion('Datos Incompletos', 'Debes seleccionar un proveedor y quién recibe la mercancía.');
      return;
    }
    if (this.detallesAAgregar.length === 0) {
      this.mostrarNotificacion('Sin Detalles', 'Debes agregar al menos una refacción o insumo a la entrada.');
      return;
    }

    this.isSaving = true;
    const payloadMaestro = {
      ID_Proveedor: this.entradaMaestro.idProveedor,
      Numero_Factura_Proveedor: this.entradaMaestro.numeroFacturaProveedor,
      Observaciones: this.entradaMaestro.observaciones,
      Recibido_Por_ID: this.entradaMaestro.recibidoPorID
    };

    // 1. Se crea el registro maestro en la tabla unificada 'entrada'
    this.http.post<any>(`${this.apiUrl}/entradas`, payloadMaestro).subscribe({
      next: (respuestaMaestro) => {
        const nuevaEntradaID = respuestaMaestro.id_entrada;

        // 2. Se separan los detalles de refacciones y de insumos
        const peticionesRefacciones = this.detallesAAgregar
            .filter(d => d.tipo === 'Refacción')
            .map(detalle => this.http.post(`${this.apiUrl}/detalle-entrada`, {
                ID_Entrada: nuevaEntradaID,
                ID_Refaccion: detalle.id,
                Cantidad_Recibida: detalle.cantidad,
                costo_ingresado: detalle.costo_ingresado,
                tipo_costo: detalle.tipo_costo,
                aplica_iva: detalle.aplica_iva
            }));
            
        const peticionesInsumos = this.detallesAAgregar
            .filter(d => d.tipo === 'Insumo')
            .map(detalle => this.http.post(`${this.apiUrl}/entradas-insumo`, {
                ID_Entrada: nuevaEntradaID,
                ID_Insumo: detalle.id,
                Cantidad_Recibida: detalle.cantidad,
                costo_ingresado: detalle.costo_ingresado,
                tipo_costo: detalle.tipo_costo,
                aplica_iva: detalle.aplica_iva
            }));

        // 3. Se ejecutan todas las peticiones de detalle en paralelo
        forkJoin([...peticionesRefacciones, ...peticionesInsumos]).subscribe({
          next: () => {
            sessionStorage.setItem('notificacion', '¡Entrada registrada exitosamente!');
            this.isSaving = false;
            this.router.navigate(['/admin/entradas']); // Redirige a la lista de entradas unificada
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

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}