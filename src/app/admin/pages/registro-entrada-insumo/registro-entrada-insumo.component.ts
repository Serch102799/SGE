import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';

interface Proveedor { id_proveedor: number; nombre_proveedor: string; }
interface Empleado { id_empleado: number; nombre: string; }
interface InsumoSimple { id_insumo: number; nombre: string; unidad_medida: string; marca: string; numero_parte: string; tipo: string; }

interface DetalleInsumoTemporal {
  id_insumo: number;
  nombre_insumo: string;
  cantidad_recibida: number;
  costo_total_compra: number;
}

@Component({
  selector: 'app-registro-entrada-insumo',
  standalone: false,
  templateUrl: './registro-entrada-insumo.component.html',
  styleUrls: ['./registro-entrada-insumo.component.css']
})
export class RegistroEntradaInsumoComponent implements OnInit {

  proveedores: Proveedor[] = [];
  empleados: Empleado[] = [];
  insumos: InsumoSimple[] = [];

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  entradaMaestro = {
    id_proveedor: null as number | null,
    numero_factura: '',
    observaciones: '',
    id_empleado: null as number | null
  };
  detalleActual = {
    id_insumo: null as number | null,
    cantidad_recibida: null as number | null,
    costo_total_compra: null as number | null
  };
  
  detallesAAgregar: DetalleInsumoTemporal[] = [];
  
  isSaving = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.cargarCatalogos();
  }
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
      this.http.get<InsumoSimple[]>('http://localhost:3000/api/insumos')
    ];

    forkJoin(peticiones).subscribe({
      next: ([proveedores, empleados, insumos]) => {
        this.proveedores = proveedores as Proveedor[];
        this.empleados = empleados as Empleado[];
        this.insumos = insumos as InsumoSimple[];
      },
      error: err => console.error('Error al cargar los catálogos', err)
    });
  }
  
  agregarDetalle() {
    const { id_insumo, cantidad_recibida, costo_total_compra } = this.detalleActual;
    if (!id_insumo || !cantidad_recibida || cantidad_recibida <= 0 || !costo_total_compra || costo_total_compra <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Por favor, selecciona un insumo y completa cantidad y costo válidos.');
      return;
    }
    const insumoSeleccionado = this.insumos.find(i => i.id_insumo === id_insumo);
    if (!insumoSeleccionado) return;

    this.detallesAAgregar.push({
      id_insumo: id_insumo,
      nombre_insumo: insumoSeleccionado.nombre,
      cantidad_recibida: cantidad_recibida,
      costo_total_compra: costo_total_compra
    });

    this.detalleActual = { id_insumo: null, cantidad_recibida: null, costo_total_compra: null };
  }

  eliminarDetalle(index: number) {
    this.detallesAAgregar.splice(index, 1);
  }

  guardarEntradaCompleta() {
    if (this.isSaving) return;
    if (!this.entradaMaestro.id_empleado) {
      this.mostrarNotificacion('Campo Requerido', 'Debes seleccionar quién recibe los insumos.');
      return;
    }
    if (this.detallesAAgregar.length === 0) {
      this.mostrarNotificacion('Sin Detalles', 'Debes agregar al menos un insumo a la entrada.');
      return;
    }
    
    this.isSaving = true;

    const payload = {
        maestro: this.entradaMaestro,
        detalles: this.detallesAAgregar
    };

    this.http.post('http://localhost:3000/api/entradas-insumo', payload).subscribe({
      next: () => {
        sessionStorage.setItem('notificacion', '¡Entrada de insumos registrada exitosamente!');
        this.isSaving = false;
        this.router.navigate(['/admin/entradas-insumo']);
      },
      error: err => {
        this.mostrarNotificacion('Error', `Error al registrar la entrada: ${err.error.message}`, 'error');
        this.isSaving = false;
      }
    });
  }

  regresar() {
    this.location.back();
  }
}