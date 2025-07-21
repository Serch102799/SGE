import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';

interface Autobus { id_autobus: number; economico: string; kilometraje_actual: number; }
interface Empleado { id_empleado: number; nombre: string; }
interface RefaccionSimple { id_refaccion: number; nombre: string; stock_actual: number; }
interface InsumoSimple { id_insumo: number; nombre: string; stock_actual: number; unidad_medida: string; }
interface DetalleRefaccionTemporal { id_refaccion: number; nombre_refaccion: string; cantidad_despachada: number; }
interface DetalleInsumoTemporal { id_insumo: number; nombre_insumo: string; cantidad_usada: number; }

@Component({
  selector: 'app-registro-salida',
  standalone: false,
  templateUrl: './registro-salida.component.html',
  styleUrls: ['./registro-salida.component.css']
})
export class RegistroSalidaComponent implements OnInit {

  autobuses: Autobus[] = [];
  empleados: Empleado[] = [];
  refacciones: RefaccionSimple[] = [];
  insumos: InsumoSimple[] = [];

  salidaMaestro = {
    tipoSalida: 'Mantenimiento Correctivo',
    idAutobus: null as number | null,
    solicitadoPorID: null as number | null,
    observaciones: '',
    kilometraje: null as number | null
  };
  detalleActualRefaccion = { id_refaccion: null as number | null, cantidad_despachada: null as number | null };
  detalleActualInsumo = { id_insumo: null as number | null, cantidad_usada: null as number | null };
  
  detallesRefaccionesAAgregar: DetalleRefaccionTemporal[] = [];
  detallesInsumosAAgregar: DetalleInsumoTemporal[] = [];
  isSaving = false;

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

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
      this.http.get<Autobus[]>('http://localhost:3000/api/autobuses'),
      this.http.get<Empleado[]>('http://localhost:3000/api/empleados'),
      this.http.get<RefaccionSimple[]>('http://localhost:3000/api/refacciones'),
      this.http.get<InsumoSimple[]>('http://localhost:3000/api/insumos')
    ];
    forkJoin(peticiones).subscribe({
      next: ([autobuses, empleados, refacciones, insumos]) => {
        this.autobuses = autobuses as Autobus[];
        this.empleados = empleados as Empleado[];
        this.refacciones = refacciones as RefaccionSimple[];
        this.insumos = insumos as InsumoSimple[];
      },
      error: err => this.mostrarNotificacion('Error de Carga', 'No se pudieron cargar los catálogos.', 'error')
    });
  }
  
  onBusSelect() {
    if (this.salidaMaestro.idAutobus) {
      const autobusSeleccionado = this.autobuses.find(a => a.id_autobus === this.salidaMaestro.idAutobus);
      if (autobusSeleccionado) {
        this.salidaMaestro.kilometraje = autobusSeleccionado.kilometraje_actual;
      }
    }
  }

  agregarDetalleRefaccion() {
    const { id_refaccion, cantidad_despachada } = this.detalleActualRefaccion;
    if (!id_refaccion || !cantidad_despachada || cantidad_despachada <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Selecciona una refacción y cantidad válida.'); return;
    }
    const refaccion = this.refacciones.find(r => r.id_refaccion === id_refaccion);
    if (!refaccion) return;
    if (cantidad_despachada > refaccion.stock_actual) {
      this.mostrarNotificacion('Stock Insuficiente', `Disponibles: ${refaccion.stock_actual}`); return;
    }
    this.detallesRefaccionesAAgregar.push({ id_refaccion, nombre_refaccion: refaccion.nombre, cantidad_despachada });
    this.detalleActualRefaccion = { id_refaccion: null, cantidad_despachada: null };
  }
  eliminarDetalleRefaccion(index: number) {
    this.detallesRefaccionesAAgregar.splice(index, 1);
  }

  agregarDetalleInsumo() {
    const { id_insumo, cantidad_usada } = this.detalleActualInsumo;
    if (!id_insumo || !cantidad_usada || cantidad_usada <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Selecciona un insumo y cantidad válida.'); return;
    }
    const insumo = this.insumos.find(i => i.id_insumo === id_insumo);
    if (!insumo) return;
    if (cantidad_usada > insumo.stock_actual) {
      this.mostrarNotificacion('Stock Insuficiente', `Disponibles: ${insumo.stock_actual}`); return;
    }
    this.detallesInsumosAAgregar.push({ id_insumo, nombre_insumo: insumo.nombre, cantidad_usada });
    this.detalleActualInsumo = { id_insumo: null, cantidad_usada: null };
  }
  eliminarDetalleInsumo(index: number) {
    this.detallesInsumosAAgregar.splice(index, 1);
  }

  guardarSalidaCompleta() {
    if (this.isSaving) return;
    if (!this.salidaMaestro.idAutobus || !this.salidaMaestro.solicitadoPorID || !this.salidaMaestro.tipoSalida) {
      this.mostrarNotificacion('Datos Incompletos', 'Completa los datos del vale de salida.'); return;
    }
    if (this.detallesRefaccionesAAgregar.length === 0 && this.detallesInsumosAAgregar.length === 0) {
      this.mostrarNotificacion('Sin Detalles', 'Agrega al menos una refacción o insumo.'); return;
    }
    if (this.salidaMaestro.idAutobus && this.salidaMaestro.kilometraje) {
      const autobusSeleccionado = this.autobuses.find(a => a.id_autobus === this.salidaMaestro.idAutobus);
      if (autobusSeleccionado && this.salidaMaestro.kilometraje < autobusSeleccionado.kilometraje_actual) {
        this.mostrarNotificacion('Dato Inválido', `El kilometraje ingresado no puede ser menor al actual del autobús (${autobusSeleccionado.kilometraje_actual}).`); return;
      }
    }
    
    this.isSaving = true;
    const payloadMaestro = {
      Tipo_Salida: this.salidaMaestro.tipoSalida,
      ID_Autobus: this.salidaMaestro.idAutobus,
      Solicitado_Por_ID: this.salidaMaestro.solicitadoPorID,
      Observaciones: this.salidaMaestro.observaciones,
      Kilometraje_Autobus: this.salidaMaestro.kilometraje
    };

    this.http.post<any>('http://localhost:3000/api/salidas', payloadMaestro).subscribe({
      next: (respuestaMaestro) => {
        const nuevaSalidaID = respuestaMaestro.id_salida;
        const peticionesDetalle = [];

        for (const detalle of this.detallesRefaccionesAAgregar) {
          const payload = { ID_Salida: nuevaSalidaID, ID_Refaccion: detalle.id_refaccion, Cantidad_Despachada: detalle.cantidad_despachada };
          peticionesDetalle.push(this.http.post('http://localhost:3000/api/detalleSalida', payload));
        }

        for (const detalle of this.detallesInsumosAAgregar) {
            const payload = { id_salida: nuevaSalidaID, id_insumo: detalle.id_insumo, cantidad_usada: detalle.cantidad_usada };
            peticionesDetalle.push(this.http.post('http://localhost:3000/api/detalle-salida-insumo', payload));
        }

        if (peticionesDetalle.length === 0) { this.finalizarGuardado(); return; }

        forkJoin(peticionesDetalle).subscribe({
          next: () => this.finalizarGuardado(),
          error: err => { this.mostrarNotificacion('Error', `Error al guardar los detalles: ${err.error.message}`, 'error'); this.isSaving = false; }
        });
      },
      error: err => { this.mostrarNotificacion('Error', `Error al crear la salida principal: ${err.error.message}`, 'error'); this.isSaving = false; }
    });
  }

  private finalizarGuardado() {
    sessionStorage.setItem('notificacion', '¡Salida registrada exitosamente!');
    this.isSaving = false;
    this.router.navigate(['/admin/salidas']);
  }

  regresar() { this.location.back(); }
}