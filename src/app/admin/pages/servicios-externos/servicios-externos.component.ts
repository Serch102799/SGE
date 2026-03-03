import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';

@Component({
  selector: 'app-servicios-externos',
  standalone: false,
  templateUrl: './servicios-externos.component.html',
  styleUrls: ['./servicios-externos.component.css']
})
export class ServiciosExternosComponent implements OnInit {
  
  servicios: any[] = [];
  proveedores: any[] = []; // Ya no necesitamos almacenar 'autobuses' localmente
  
  isLoading = false;
  modalVisible = false;

  // Autocompletar Autobús
  // el control puede devolver un string o un objeto autobús, tipamos con any
  busControl = new FormControl<any>('');
  filteredAutobuses$!: Observable<any[]>;

  nuevoServicio: any = {
    id_autobus: null,
    kilometraje_autobus: null,
    id_proveedor: null,
    fecha_servicio: new Date().toISOString().split('T')[0],
    descripcion: '',
    subtotal: null,
    aplica_iva: false,
    iva_monto: 0,
    costo_total: 0,
    factura_nota: '',
    tiene_garantia: false,
    dias_garantia: null,
    fecha_vencimiento_garantia: null
  };

  mostrarModalNotificacion = false;
  notificacion = { titulo: '', mensaje: '', tipo: 'exito' as 'exito' | 'error' | 'advertencia' };

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarServicios();
    this.cargarCatalogos();

    // Filtro reactivo conectado directo al backend (Buscador dinámico)
    this.filteredAutobuses$ = this.busControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => this._buscarAutobusApi(value || ''))
    );
  }

  // --- LÓGICA DE BÚSQUEDA EN EL BACKEND ---
  private _buscarAutobusApi(term: any): Observable<any[]> {
    const searchTerm = typeof term === 'string' ? term : term?.economico;
    if (!searchTerm) { return of([]); }
    return this.http.get<any[]>(`${this.apiUrl}/autobuses/buscar`, { params: { term: searchTerm } }).pipe(
      catchError(() => of([]))
    );
  }

  displayFnBus(bus: any): string {
    return bus && bus.economico ? `Bus ${bus.economico}` : '';
  }

  seleccionarAutobus(event: any) {
    const bus = event.option.value;
    this.nuevoServicio.id_autobus = bus.id_autobus;
    this.nuevoServicio.kilometraje_autobus = bus.kilometraje_actual || bus.kilometraje_ultima_carga || 0;
  }

  cargarServicios() {
    this.isLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/servicios-externos`).subscribe({
      next: (data) => {
        this.servicios = data;
        this.isLoading = false;
      },
      error: () => {
        this.mostrarNotificacion('Error', 'No se pudieron cargar los servicios.', 'error');
        this.isLoading = false;
      }
    });
  }

  cargarCatalogos() {
    // Ya solo cargamos los proveedores al inicio. Los autobuses se buscan on-demand.
    this.http.get<any[]>(`${this.apiUrl}/proveedores`).subscribe(data => this.proveedores = data);
  }

  calcularTotales() {
    const sub = parseFloat(this.nuevoServicio.subtotal) || 0;
    if (this.nuevoServicio.aplica_iva) {
      this.nuevoServicio.iva_monto = sub * 0.16;
    } else {
      this.nuevoServicio.iva_monto = 0;
    }
    this.nuevoServicio.costo_total = sub + this.nuevoServicio.iva_monto;
  }
  

  // --- LÓGICA DE GARANTÍAS PARA LA TABLA ---
  getEstadoGarantiaClass(servicio: any): string {
    if (servicio.estatus === 'Cancelado') return 'fila-cancelada';
    if (!servicio.tiene_garantia || !servicio.fecha_vencimiento_garantia) return '';

    const hoy = new Date();
    hoy.setHours(0,0,0,0); 
    const vencimiento = new Date(servicio.fecha_vencimiento_garantia);
    vencimiento.setMinutes(vencimiento.getMinutes() + vencimiento.getTimezoneOffset());
    vencimiento.setHours(0,0,0,0);

    const diffTime = vencimiento.getTime() - hoy.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'garantia-vencida';
    if (diffDays <= 15) return 'garantia-por-vencer'; // Amarillo (Quedan 15 días o menos)
    return 'garantia-activa'; // Verde
  }

  abrirModal() {
    this.busControl.setValue('');
    this.nuevoServicio = {
      id_autobus: null, kilometraje_autobus: null, id_proveedor: null,
      fecha_servicio: new Date().toISOString().split('T')[0],
      descripcion: '', subtotal: null, aplica_iva: false, iva_monto: 0, costo_total: 0,
      factura_nota: '', tiene_garantia: false, 
      dias_garantia: null, 
      fecha_vencimiento_garantia: null
    };
    this.modalVisible = true;
    document.body.style.overflow = 'hidden';
  }

  cerrarModal() {
    this.modalVisible = false;
    document.body.style.overflow = 'auto';
  }

  guardarServicio() {
    if (!this.nuevoServicio.id_autobus || !this.nuevoServicio.descripcion || !this.nuevoServicio.subtotal) {
      this.mostrarNotificacion('Campos incompletos', 'Selecciona el autobús, la descripción y el subtotal.', 'advertencia');
      return;
    }

    if (this.nuevoServicio.tiene_garantia && !this.nuevoServicio.fecha_vencimiento_garantia) {
      this.mostrarNotificacion('Garantía', 'Debes establecer la fecha de vencimiento de la garantía.', 'advertencia');
      return;
    }

    this.http.post(`${this.apiUrl}/servicios-externos`, this.nuevoServicio).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Servicio externo registrado correctamente.', 'exito');
        this.cerrarModal();
        this.cargarServicios();
      },
      error: () => this.mostrarNotificacion('Error', 'Ocurrió un error al guardar.', 'error')
    });
  }

  cancelarServicio(id: number) {
    if (confirm('¿Estás seguro de cancelar este servicio?')) {
      this.http.put(`${this.apiUrl}/servicios-externos/${id}/cancelar`, {}).subscribe({
        next: () => {
          this.mostrarNotificacion('Cancelado', 'El servicio fue cancelado.', 'exito');
          this.cargarServicios();
        },
        error: () => this.mostrarNotificacion('Error', 'No se pudo cancelar.', 'error')
      });
    }
  }

  calcularFechaGarantia() {
    if (this.nuevoServicio.tiene_garantia && this.nuevoServicio.dias_garantia > 0 && this.nuevoServicio.fecha_servicio) {
      // 1. Desarmar la fecha para evitar bugs de zona horaria
      const [year, month, day] = this.nuevoServicio.fecha_servicio.split('-');
      const fecha = new Date(Number(year), Number(month) - 1, Number(day));
      
      // 2. Sumarle los días ingresados
      fecha.setDate(fecha.getDate() + this.nuevoServicio.dias_garantia);
      
      // 3. Volver a armar la fecha en formato YYYY-MM-DD
      const y = fecha.getFullYear();
      const m = String(fecha.getMonth() + 1).padStart(2, '0');
      const d = String(fecha.getDate()).padStart(2, '0');
      
      this.nuevoServicio.fecha_vencimiento_garantia = `${y}-${m}-${d}`;
    } else {
      this.nuevoServicio.fecha_vencimiento_garantia = null;
    }
  }
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}