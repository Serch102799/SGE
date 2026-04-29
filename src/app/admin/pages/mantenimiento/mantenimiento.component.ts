import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Observable, of, forkJoin } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';
import { AuthService } from '../../../services/auth.service';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

interface RefaccionSimple { id_refaccion: number; nombre: string; numero_parte: string; }
interface InsumoSimple { id_insumo: number; nombre: string; stock_actual: number; }
interface Lote { id_lote: number; cantidad_disponible: number; costo_unitario_compra: number; nombre_proveedor: string; }

@Component({
  selector: 'app-mantenimiento',
  standalone: false,
  templateUrl: './mantenimiento.component.html',
  styleUrls: ['./mantenimiento.component.css']
})
export class MantenimientoComponent implements OnInit {
  apiUrl = `${environment.apiUrl}/servicios`;

  isLoading = true;
  isSaving = false;

  vistaActual: 'kanban' | 'calendario' = 'kanban';
  cambiarVista(vista: 'kanban' | 'calendario') {
    this.vistaActual = vista;
  }
  // Listas de Servicios
  urgentes: any[] = [];
  esteMes: any[] = [];
  futuros: any[] = [];
  completados: any[] = [];

  // Buscador de servicios
  terminoBusqueda: string = '';

  get filtradosUrgentes() {
    return this.urgentes.filter(s => s.economico.toString().toLowerCase().includes(this.terminoBusqueda.toLowerCase()) || s.alerta.toLowerCase().includes(this.terminoBusqueda.toLowerCase()));
  }
  get filtradosEsteMes() {
    return this.esteMes.filter(s => s.economico.toString().toLowerCase().includes(this.terminoBusqueda.toLowerCase()) || s.alerta.toLowerCase().includes(this.terminoBusqueda.toLowerCase()));
  }
  get filtradosFuturos() {
    return this.futuros.filter(s => s.economico.toString().toLowerCase().includes(this.terminoBusqueda.toLowerCase()) || s.alerta.toLowerCase().includes(this.terminoBusqueda.toLowerCase()));
  }
  get filtradosCompletados() {
    return this.completados.filter(s => s.economico.toString().toLowerCase().includes(this.terminoBusqueda.toLowerCase()) || (s.observaciones || '').toLowerCase().includes(this.terminoBusqueda.toLowerCase()));
  }


  // Variables para Modales
  modalActivo: string = '';
  servicioSeleccionado: any = null;
  tipoServicioCalculado: string = 'Mantenimiento Preventivo Normal';
  formData: any = {};


  mostrarModalNotificacion = false;
  notificacion = { titulo: '', mensaje: '', tipo: 'advertencia' };

  // Variables para Modal de Confirmación
  mostrarModalConfirmacion = false;
  servicioAConfirmar: any = null;

  autobusControl = new FormControl<any>('');
  filteredAutobuses$!: Observable<any[]>;

  // ==========================================
  // VARIABLES DE ALMACÉN (REFACCIONES E INSUMOS)
  // ==========================================
  refaccionControl = new FormControl<any>('');
  insumoControl = new FormControl<any>('');
  filteredRefacciones$!: Observable<RefaccionSimple[]>;
  filteredInsumos$!: Observable<InsumoSimple[]>;

  detalleActualRefaccion = { id_refaccion: null as number | null, id_lote: null as number | null, cantidad_despachada: null as number | null };
  lotesDisponibles: Lote[] = [];
  detallesRefaccionesAAgregar: any[] = [];

  detalleActualInsumo = { id_insumo: null as number | null, cantidad_usada: null as number | null };
  detallesInsumosAAgregar: any[] = [];

  constructor(private http: HttpClient, private authService: AuthService) { }

  ngOnInit(): void {
    this.cargarServicios();
    this.configurarBuscadores();
  }

  // ==========================================
  // BUSCADORES
  // ==========================================
  configurarBuscadores() {
    this.filteredAutobuses$ = this.autobusControl.valueChanges.pipe(
      startWith(''), debounceTime(300), distinctUntilChanged(),
      switchMap(val => this._buscarApi('autobuses', val))
    );
    this.filteredRefacciones$ = this.refaccionControl.valueChanges.pipe(
      startWith(''), debounceTime(300), distinctUntilChanged(),
      switchMap(val => this._buscarApi('refacciones', val))
    );
    this.filteredInsumos$ = this.insumoControl.valueChanges.pipe(
      startWith(''), debounceTime(300), distinctUntilChanged(),
      switchMap(val => this._buscarApi('insumos', val))
    );
  }

  private _buscarApi(tipo: string, term: any): Observable<any[]> {
    const searchTerm = typeof term === 'string' ? term : term?.nombre || term?.economico;
    if (!searchTerm) return of([]);
    return this.http.get<any[]>(`${environment.apiUrl}/${tipo}/buscar`, { params: { term: searchTerm } }).pipe(catchError(() => of([])));
  }

  displayAutobus(item: any): string { return item ? `Bus ${item.economico}` : ''; }
  displayItem(item: any): string { return item ? item.nombre || item.numero_parte : ''; }

  onAutobusSeleccionado(event: MatAutocompleteSelectedEvent) { this.formData.id_autobus = event.option.value.id_autobus; }

  // ==========================================
  // LÓGICA DE REFACCIONES Y LOTES
  // ==========================================
  onRefaccionSelected(event: MatAutocompleteSelectedEvent) {
    const refaccion = event.option.value;
    this.detalleActualRefaccion.id_refaccion = refaccion.id_refaccion;
    this.lotesDisponibles = [];
    this.detalleActualRefaccion.id_lote = null;
    this.http.get<Lote[]>(`${environment.apiUrl}/lotes/${refaccion.id_refaccion}`).subscribe(lotes => this.lotesDisponibles = lotes);
  }

  agregarDetalleRefaccion() {
    const { id_lote, cantidad_despachada } = this.detalleActualRefaccion;
    const ref = this.refaccionControl.value;

    if (!ref || typeof ref === 'string' || !ref.id_refaccion) {
      this.mostrarNotificacion('Selección Inválida', 'Por favor, selecciona una refacción de la lista desplegable.', 'advertencia');
      return;
    }

    if (!id_lote || !cantidad_despachada || cantidad_despachada <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Selecciona el Lote/Compra y la cantidad a usar.', 'advertencia');
      return;
    }

    const loteSeleccionadoId = Number(id_lote);
    const lote = this.lotesDisponibles.find(l => l.id_lote === loteSeleccionadoId);

    if (!lote) {
      this.mostrarNotificacion('Error', 'No se encontró el lote seleccionado.', 'error');
      return;
    }

    if (cantidad_despachada > lote.cantidad_disponible) {
      this.mostrarNotificacion('Stock Insuficiente', `Ese lote solo tiene ${lote.cantidad_disponible} piezas disponibles.`, 'error');
      return;
    }

    const costoReal = Number(
      (lote as any).costo_unitario_final ||
      (lote as any).costo_unitario_compra ||
      (lote as any).costo_unitario ||
      0
    );

    console.log("Datos del lote seleccionado:", lote);
    console.log("Costo extraído:", costoReal);

    this.detallesRefaccionesAAgregar.push({
      id_lote: loteSeleccionadoId,
      id_refaccion: ref.id_refaccion,
      nombre_refaccion: ref.nombre,
      numero_parte: ref.numero_parte,
      costo_unitario: costoReal,
      cantidad_despachada: Number(cantidad_despachada)
    });

    this.refaccionControl.setValue('');
    this.detalleActualRefaccion = { id_refaccion: null, id_lote: null, cantidad_despachada: null };
    this.lotesDisponibles = [];
  }
  // ==========================================
  // LÓGICA DE INSUMOS
  // ==========================================
  onInsumoSelected(event: MatAutocompleteSelectedEvent) {
    this.detalleActualInsumo.id_insumo = event.option.value.id_insumo;
  }

  agregarDetalleInsumo() {
    const { cantidad_usada } = this.detalleActualInsumo;
    const insumo = this.insumoControl.value;

    if (!insumo || typeof insumo === 'string' || !insumo.id_insumo) {
      this.mostrarNotificacion('Selección Inválida', 'Por favor, selecciona un insumo de la lista desplegable.', 'advertencia');
      return;
    }

    if (!cantidad_usada || cantidad_usada <= 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Ingresa una cantidad válida.', 'advertencia');
      return;
    }

    this.http.get<InsumoSimple>(`${environment.apiUrl}/insumos/${insumo.id_insumo}`).subscribe(insumoDetalle => {
      if (cantidad_usada > insumoDetalle.stock_actual) {
        this.mostrarNotificacion('Stock Insuficiente', `Solo hay ${insumoDetalle.stock_actual} en stock.`, 'error');
        return;
      }

      this.detallesInsumosAAgregar.push({
        id_insumo: insumo.id_insumo,
        nombre_insumo: insumo.nombre,
        cantidad_usada
      });

      this.insumoControl.setValue('');
      this.detalleActualInsumo = { id_insumo: null, cantidad_usada: null };
    });
  }

  eliminarRefaccion(index: number) { this.detallesRefaccionesAAgregar.splice(index, 1); }
  eliminarInsumo(index: number) { this.detallesInsumosAAgregar.splice(index, 1); }

  calcularTotalSalida(): number {
    return this.detallesRefaccionesAAgregar.reduce((total, item) => total + (item.cantidad_despachada * item.costo_unitario), 0);
  }

  // ==========================================
  // CARGA Y CLASIFICACIÓN
  // ==========================================
  cargarServicios() {
    this.isLoading = true;
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => { this.clasificarServicios(data); this.isLoading = false; },
      error: () => { this.mostrarNotificacion('Error', 'No se pudo cargar la agenda.', 'error'); this.isLoading = false; }
    });
  }

  clasificarServicios(servicios: any[]) {
    this.urgentes = []; this.esteMes = []; this.futuros = []; this.completados = [];
    const hoy = new Date(); const limite = new Date(); limite.setDate(hoy.getDate() + 30);

    servicios.forEach(s => {
      if (s.estado === 'Completado') { this.completados.push(s); return; }
      const d = new Date(s.fecha_proximo_servicio); const km = parseInt(s.km_proximo_servicio); const kmAct = parseInt(s.km_actual_bus) || 0;
      if (d < hoy || kmAct >= km) { s.alerta = d < hoy ? 'Vencido por Tiempo' : 'Vencido por KM'; this.urgentes.push(s); }
      else if (d <= limite || (km - kmAct) <= 2000) { s.alerta = (km - kmAct) <= 2000 ? 'Próximo por KM' : 'Próximo por Fecha'; this.esteMes.push(s); }
      else { s.alerta = 'En regla'; this.futuros.push(s); }
    });
  }

  // ==========================================
  // MODALES
  // ==========================================
  abrirModalAgendar() {
    this.modalActivo = 'agendar'; this.autobusControl.setValue('');
    this.formData = { id_autobus: null, fecha_ultimo_servicio: new Date().toISOString().split('T')[0], km_ultimo_servicio: 0, observaciones: 'Registro inicial' };
  }

  // ==========================================
  // LÓGICA DE MANTENIMIENTO DE OPORTUNIDAD
  // ==========================================
  iniciarRegistroServicio(servicio: any) {
    const kmActual = parseFloat(servicio.km_actual_bus) || 0;

    // Obtenemos el KM del último servicio. Si tu backend no lo manda directo, 
    // lo calculamos restando los 30k al próximo servicio proyectado.
    const kmUltimo = parseFloat(servicio.km_ultimo_servicio) || (parseFloat(servicio.km_proximo_servicio) - 30000);
    const kmRecorridos = kmActual - kmUltimo;

    // Si recorrió menos de 27,000 km, lanzamos la advertencia con el modal personalizado
    if (kmRecorridos >= 0 && kmRecorridos < 27000) {
      this.servicioAConfirmar = servicio;
      this.mostrarModalConfirmacion = true;
    } else {
      // Si ya pasó los 27k, es un servicio totalmente normal
      this.tipoServicioCalculado = 'Mantenimiento Preventivo Normal';
      this.abrirModalCompletar(servicio);
    }
  }

  confirmarAdelanto() {
    this.tipoServicioCalculado = 'Mantenimiento de Oportunidad';
    this.mostrarModalConfirmacion = false;
    this.abrirModalCompletar(this.servicioAConfirmar);
    this.servicioAConfirmar = null;
  }

  cancelarAdelanto() {
    this.mostrarModalConfirmacion = false;
    this.servicioAConfirmar = null;
  }

  abrirModalCompletar(servicio: any) {
    this.servicioSeleccionado = servicio; this.modalActivo = 'completar';
    this.formData.fecha_realizado = new Date().toISOString().split('T')[0];
    this.formData.km_realizado = null;
    this.detallesRefaccionesAAgregar = []; this.detallesInsumosAAgregar = [];
    this.refaccionControl.setValue(''); this.insumoControl.setValue('');
    this.formData = { km_realizado: servicio.km_actual_bus || 0, fecha_realizado: new Date().toISOString().split('T')[0], observaciones: `Servicio completado.` };
  }

  cerrarModal() { this.modalActivo = ''; this.servicioSeleccionado = null; }
  mostrarNotificacion(titulo: string, msj: string, tipo: string) { this.notificacion = { titulo, mensaje: msj, tipo }; this.mostrarModalNotificacion = true; }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }

  // ==========================================
  // GUARDADO MAESTRO
  // ==========================================
  guardarAgendamiento() {
    this.isSaving = true;
    this.http.post(this.apiUrl, this.formData).subscribe({
      next: () => { this.mostrarNotificacion('¡Éxito!', 'Servicio agendado.', 'exito'); this.cerrarModal(); this.cargarServicios(); this.isSaving = false; },
      error: () => { this.mostrarNotificacion('Error', 'Fallo al agendar.', 'error'); this.isSaving = false; }
    });
  }

  guardarServicio() {
    if (this.formData.km_realizado < this.servicioSeleccionado.km_ultimo_servicio) {
      this.mostrarNotificacion('Error', 'El KM no puede ser menor al del último servicio.', 'error'); return;
    }

    this.isSaving = true;
    const hayRefacciones = this.detallesRefaccionesAAgregar.length > 0;
    const hayInsumos = this.detallesInsumosAAgregar.length > 0;
    const idUsuario = this.authService.getCurrentUser()?.id || 1;

    if (hayRefacciones || hayInsumos) {
      const payloadSalida = {
        Tipo_Salida: 'Mantenimiento Preventivo',
        ID_Autobus: this.servicioSeleccionado.id_autobus,
        Solicitado_Por_ID: idUsuario,
        Observaciones: 'Autogenerado por Agenda Taller: ' + this.formData.observaciones,
        Kilometraje_Autobus: this.formData.km_realizado,
        Fecha_Operacion: this.formData.fecha_realizado
      };

      this.http.post<any>(`${environment.apiUrl}/salidas`, payloadSalida).subscribe({
        next: (res) => {
          const idSalida = res.id_salida;
          const peticiones = [];

          for (const ref of this.detallesRefaccionesAAgregar) {
            peticiones.push(this.http.post(`${environment.apiUrl}/detalleSalida`, {
              ID_Salida: idSalida, ID_Refaccion: ref.id_refaccion, Cantidad_Despachada: ref.cantidad_despachada, ID_Lote: ref.id_lote
            }));
          }
          for (const ins of this.detallesInsumosAAgregar) {
            peticiones.push(this.http.post(`${environment.apiUrl}/detalle-salida-insumo`, {
              id_salida: idSalida, id_insumo: ins.id_insumo, cantidad_usada: ins.cantidad_usada
            }));
          }

          forkJoin(peticiones).subscribe({
            next: () => this.finalizarServicio(idSalida),
            error: () => { this.mostrarNotificacion('Error', 'Fallo al guardar detalles de almacén.', 'error'); this.isSaving = false; }
          });
        },
        error: () => { this.mostrarNotificacion('Error', 'Fallo al crear el vale de salida.', 'error'); this.isSaving = false; }
      });
    } else {
      this.finalizarServicio(null);
    }
  }
  finalizarServicio(idSalidaGenerada: number | null) {
    const payload = {
      id_autobus: this.servicioSeleccionado.id_autobus,
      km_realizado: this.formData.km_realizado,
      fecha_realizado: this.formData.fecha_realizado,
      observaciones: this.formData.observaciones,
      id_salida_almacen: idSalidaGenerada,
      tipo_servicio: this.tipoServicioCalculado
    };

    this.http.post(`${this.apiUrl}/${this.servicioSeleccionado.id_servicio}/completar`, payload).subscribe({
      next: (res: any) => {
        this.mostrarNotificacion('¡Listo!', res.message, 'exito');
        this.cerrarModal();
        this.cargarServicios();
        this.isSaving = false;
      },
      error: () => { this.mostrarNotificacion('Error', 'Fallo al cerrar el servicio.', 'error'); this.isSaving = false; }
    });
  }
}