import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environments';

interface Autobus { id_autobus: number; economico: string; kilometraje_actual: number; }
interface Empleado { id_empleado: number; nombre: string; }
interface RefaccionSimple { id_refaccion: number; nombre: string; marca: string; numero_parte: string; } 
interface InsumoSimple { id_insumo: number; nombre: string; stock_actual: number; unidad_medida: string; marca: string; tipo: string; }

interface Lote {
  id_lote: number;
  cantidad_disponible: number;
  costo_unitario_compra: number;
  nombre_proveedor: string;
}

interface DetalleRefaccionTemporal { 
  id_lote: number; 
  id_refaccion: number;
  nombre_refaccion: string; 
  nombre_proveedor: string;
  cantidad_despachada: number; 
}
interface DetalleInsumoTemporal { id_insumo: number; nombre_insumo: string; cantidad_usada: number; }

@Component({
  selector: 'app-registro-salida',
  standalone: false,
  templateUrl: './registro-salida.component.html',
  styleUrls: ['./registro-salida.component.css']
})
export class RegistroSalidaComponent implements OnInit {

  // --- URLs de la API ---
  private apiUrl = environment.apiUrl;

  // --- Catálogos ---
  autobuses: Autobus[] = [];
  empleados: Empleado[] = [];
  refacciones: RefaccionSimple[] = [];
  insumos: InsumoSimple[] = [];

  // --- Formularios y Listas ---
  salidaMaestro = {
    tipoSalida: 'Mantenimiento Correctivo',
    idAutobus: null as number | null,
    solicitadoPorID: null as number | null,
    observaciones: '',
    kilometraje: null as number | null
  };
  
  detalleActualRefaccion = { 
    id_refaccion: null as number | null, 
    id_lote: null as number | null,
    cantidad_despachada: null as number | null 
  };
  lotesDisponibles: Lote[] = [];

  detalleActualInsumo = { id_insumo: null as number | null, cantidad_usada: null as number | null };
  
  detallesRefaccionesAAgregar: DetalleRefaccionTemporal[] = [];
  detallesInsumosAAgregar: DetalleInsumoTemporal[] = [];
  isSaving = false;

  // --- Notificaciones ---
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
      this.http.get<Autobus[]>(`${this.apiUrl}/autobuses/lista-simple`),
      this.http.get<Empleado[]>(`${this.apiUrl}/empleados`),
      this.http.get<RefaccionSimple[]>(`${this.apiUrl}/refacciones`),
      this.http.get<InsumoSimple[]>(`${this.apiUrl}/insumos`)
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

  onRefaccionSelect() {
    this.lotesDisponibles = [];
    this.detalleActualRefaccion.id_lote = null;
    const idRefaccion = this.detalleActualRefaccion.id_refaccion;

    if (idRefaccion) {
      this.http.get<Lote[]>(`${this.apiUrl}/lotes/${idRefaccion}`).subscribe(lotes => {
        this.lotesDisponibles = lotes;
      });
    }
  }

  agregarDetalleRefaccion() {
    const { id_refaccion, id_lote, cantidad_despachada } = this.detalleActualRefaccion;
    if (!id_refaccion || !id_lote || !cantidad_despachada || cantidad_despachada <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Selecciona una refacción, un lote y una cantidad válida.');
      return;
    }
    const refaccion = this.refacciones.find(r => r.id_refaccion === id_refaccion);
    const lote = this.lotesDisponibles.find(l => l.id_lote === id_lote);
    if (!refaccion || !lote) return;
    if (cantidad_despachada > lote.cantidad_disponible) {
      this.mostrarNotificacion('Stock Insuficiente', `Stock insuficiente en este lote. Disponible: ${lote.cantidad_disponible}`);
      return;
    }
    this.detallesRefaccionesAAgregar.push({ 
      id_lote, id_refaccion, nombre_refaccion: refaccion.nombre, 
      nombre_proveedor: lote.nombre_proveedor || 'N/A', cantidad_despachada 
    });
    this.detalleActualRefaccion = { id_refaccion: null, id_lote: null, cantidad_despachada: null };
    this.lotesDisponibles = [];
  }

  eliminarDetalleRefaccion(index: number) { this.detallesRefaccionesAAgregar.splice(index, 1); }

  agregarDetalleInsumo() {
    const { id_insumo, cantidad_usada } = this.detalleActualInsumo;
    if (!id_insumo || !cantidad_usada || cantidad_usada <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Selecciona un insumo y cantidad válida.');
      return;
    }
    const insumo = this.insumos.find(i => i.id_insumo === id_insumo);
    if (!insumo) return;
    if (cantidad_usada > insumo.stock_actual) {
      this.mostrarNotificacion('Stock Insuficiente', `Stock insuficiente. Disponible: ${insumo.stock_actual}`);
      return;
    }
    this.detallesInsumosAAgregar.push({ id_insumo, nombre_insumo: insumo.nombre, cantidad_usada });
    this.detalleActualInsumo = { id_insumo: null, cantidad_usada: null };
  }

  eliminarDetalleInsumo(index: number) { this.detallesInsumosAAgregar.splice(index, 1); }

  guardarSalidaCompleta() {
    if (this.isSaving) return;
    if (!this.salidaMaestro.idAutobus || !this.salidaMaestro.solicitadoPorID || !this.salidaMaestro.tipoSalida) {
      this.mostrarNotificacion('Datos Incompletos', 'Completa los datos del vale de salida.');
      return;
    }
    if (!this.salidaMaestro.kilometraje) {
        this.mostrarNotificacion('Dato Requerido', 'El kilometraje es obligatorio.');
        return;
    }
    const autobusSeleccionado = this.autobuses.find(a => a.id_autobus === this.salidaMaestro.idAutobus);
    if (autobusSeleccionado && this.salidaMaestro.kilometraje < autobusSeleccionado.kilometraje_actual) {
      this.mostrarNotificacion('Dato Inválido', `El kilometraje ingresado no puede ser menor al actual del autobús (${autobusSeleccionado.kilometraje_actual}).`);
      return;
    }
    if (this.detallesRefaccionesAAgregar.length === 0 && this.detallesInsumosAAgregar.length === 0) {
      this.mostrarNotificacion('Sin Detalles', 'Agrega al menos una refacción o insumo.');
      return;
    }
    
    this.isSaving = true;
    const payloadMaestro = {
      Tipo_Salida: this.salidaMaestro.tipoSalida,
      ID_Autobus: this.salidaMaestro.idAutobus,
      Solicitado_Por_ID: this.salidaMaestro.solicitadoPorID,
      Observaciones: this.salidaMaestro.observaciones,
      Kilometraje_Autobus: this.salidaMaestro.kilometraje
    };
    this.http.post<any>(`${this.apiUrl}/salidas`, payloadMaestro).subscribe({
      next: (respuestaMaestro) => {
        const nuevaSalidaID = respuestaMaestro.id_salida;
        const peticionesDetalle = [];

        for (const detalle of this.detallesRefaccionesAAgregar) {
          const payload = { 
            ID_Salida: nuevaSalidaID, ID_Refaccion: detalle.id_refaccion, 
            Cantidad_Despachada: detalle.cantidad_despachada, ID_Lote: detalle.id_lote
          };
          peticionesDetalle.push(this.http.post(`${this.apiUrl}/detalleSalida`, payload));
        }
        for (const detalle of this.detallesInsumosAAgregar) {
            const payload = { id_salida: nuevaSalidaID, id_insumo: detalle.id_insumo, cantidad_usada: detalle.cantidad_usada };
            peticionesDetalle.push(this.http.post(`${this.apiUrl}/detalle-salida-insumo`, payload));
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