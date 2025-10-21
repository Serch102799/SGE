import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin, Observable, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';

// --- Interfaces ---
interface Operador { id_operador: number; nombre_completo: string; }
interface Autobus { id_autobus: number; economico: string; kilometraje_ultima_carga: number; }
interface Ruta { id_ruta: number; nombre_ruta: string; kilometraje_vuelta: number; vueltas_diarias_promedio?: number; }
interface Ubicacion { id_ubicacion: number; nombre_ubicacion: string; }
interface RutaRealizada { id_ruta: number; nombre_ruta: string; vueltas: number; kilometraje: number; }

@Component({
  selector: 'app-registro-carga-combustible',
  standalone: false,
  templateUrl: './registro-carga-combustible.component.html',
  styleUrls: ['./registro-carga-combustible.component.css']
})
export class RegistroCargaCombustibleComponent implements OnInit {

  Math = Math;
  private apiUrl = environment.apiUrl;

  // --- Catálogos ---
  operadores: Operador[] = [];
  rutas: Ruta[] = [];
  ubicaciones: Ubicacion[] = [];

  // --- Formulario Maestro ---
  cargaMaestro = {
    id_autobus: null as number | null,
    id_empleado_operador: null as number | null,
    id_ubicacion: null as number | null,
    fecha_operacion: this.getFormattedCurrentDateTime(),
    km_final: null as number | null,
    litros_cargados: null as number | null,
    motivo_desviacion: ''
  };

  // --- Modo de Cálculo ---
  tipo_calculo: 'dias' | 'vueltas' = 'vueltas'; // Valor por defecto

  // --- Lógica de Autocomplete ---
  autobusControl = new FormControl();
  operadorControl = new FormControl();
  filteredAutobuses$: Observable<Autobus[]>;
  filteredOperadores$: Observable<Operador[]>;

  // --- Modo VUELTAS (Original) ---
  detalleRutaActual = { id_ruta: null as number | null, vueltas: 1 };
  rutas_realizadas: RutaRealizada[] = [];

  // --- Modo DÍAS ---
  id_ruta_principal: number | null = null;
  dias_laborados: number = 1;
  rutaPrincipalSeleccionada: Ruta | undefined;

  // --- Campos Calculados en Tiempo Real ---
  km_inicial: number | null = null;
  km_recorridos: number = 0;
  km_esperados: number = 0;
  desviacion_km: number = 0;
  rendimiento_calculado: number = 0;
  umbral_km: number = 22;

  isSaving = false;
  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };

  constructor(
    private http: HttpClient,
    private router: Router,
    private location: Location,
    public authService: AuthService
  ) {
    this.filteredAutobuses$ = this.autobusControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => this._buscarApi('autobuses', value || ''))
    );
    this.filteredOperadores$ = this.operadorControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => this._buscarApi('operadores', value || ''))
    );
  }

  ngOnInit(): void {
    this.cargarCatalogos();
    this.recalcularValores();
  }

  private getFormattedCurrentDateTime(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  private _buscarApi(tipo: 'autobuses' | 'operadores', term: any): Observable<any[]> {
    const searchTerm = typeof term === 'string' ? term : term.economico || term.nombre_completo;
    if (!searchTerm) { return of([]); }
    return this.http.get<any[]>(`${this.apiUrl}/${tipo}/buscar`, { params: { term: searchTerm } });
  }

  displayFn(item: any): string {
    return item ? (item.economico || item.nombre_completo) : '';
  }

  onAutobusSelected(event: MatAutocompleteSelectedEvent): void {
    const autobus = event.option.value as Autobus;
    this.cargaMaestro.id_autobus = autobus.id_autobus;
    this.km_inicial = autobus.kilometraje_ultima_carga;
    this.recalcularValores();
  }

  onOperadorSelected(event: MatAutocompleteSelectedEvent): void {
    const operador = event.option.value as Operador;
    this.cargaMaestro.id_empleado_operador = operador.id_operador;
  }

  cargarCatalogos() {
    const peticiones: [Observable<Ruta[]>, Observable<Ubicacion[]>] = [
      this.http.get<Ruta[]>(`${this.apiUrl}/rutas`),
      this.http.get<Ubicacion[]>(`${this.apiUrl}/ubicaciones`)
    ];
    
    forkJoin(peticiones).subscribe({
      next: ([rutas, ubicaciones]) => {
        this.rutas = (rutas as any).data || rutas;
        this.ubicaciones = (ubicaciones as any).data || ubicaciones;
      },
      error: (err) => {
        this.mostrarNotificacion('Error de Carga', 'No se pudieron cargar los catálogos necesarios.', 'error');
      }
    });
  }

  // --- MÉTODOS MODO VUELTAS ---
  agregarRuta() {
    const { id_ruta, vueltas } = this.detalleRutaActual;
    if (!id_ruta || !vueltas || vueltas <= 0) return;
    
    const rutaSeleccionada = this.rutas.find(r => r.id_ruta === id_ruta);
    if (!rutaSeleccionada) return;

    if (this.rutas_realizadas.some(r => r.id_ruta === id_ruta)) {
      this.mostrarNotificacion('Ruta Duplicada', 'Esta ruta ya ha sido agregada a la lista.');
      return;
    }

    this.rutas_realizadas.push({
      id_ruta: rutaSeleccionada.id_ruta,
      nombre_ruta: rutaSeleccionada.nombre_ruta,
      vueltas: vueltas,
      kilometraje: rutaSeleccionada.kilometraje_vuelta
    });

    this.detalleRutaActual = { id_ruta: null, vueltas: 1 };
    this.recalcularValores();
  }

  eliminarRuta(index: number) {
    this.rutas_realizadas.splice(index, 1);
    this.recalcularValores();
  }

  // --- MÉTODOS MODO DÍAS ---
  onRutaPrincipalSelected(event: any): void {
    this.rutaPrincipalSeleccionada = this.rutas.find(r => r.id_ruta === this.id_ruta_principal);
    this.recalcularValores();
  }

  onDiasLaboradosChange(): void {
    this.recalcularValores();
  }

  // --- RECÁLCULO INTELIGENTE ---
  recalcularValores() {
    if (this.tipo_calculo === 'dias') {
      this.recalcularValoresDias();
    } else {
      this.recalcularValoresVueltas();
    }
  }

  private recalcularValoresVueltas() {
    this.km_esperados = this.rutas_realizadas.reduce((acc, ruta) => acc + (ruta.kilometraje * ruta.vueltas), 0);
    this.km_recorridos = (this.cargaMaestro.km_final && this.km_inicial !== null) ? this.cargaMaestro.km_final - this.km_inicial : 0;
    this.desviacion_km = this.km_recorridos - this.km_esperados;
    this.rendimiento_calculado = (this.cargaMaestro.litros_cargados && this.km_recorridos > 0) ? this.km_recorridos / this.cargaMaestro.litros_cargados : 0;
  }

  private recalcularValoresDias() {
    // Limpiar valores primero
    this.km_esperados = 0;
    this.km_recorridos = 0;
    this.desviacion_km = 0;
    this.rendimiento_calculado = 0;

    // Si no hay ruta o días válidos, salir
    if (!this.id_ruta_principal || this.dias_laborados <= 0) {
      return;
    }

    // Buscar la ruta seleccionada
    const ruta = this.rutas.find(r => r.id_ruta === this.id_ruta_principal);
    this.rutaPrincipalSeleccionada = ruta;
    
    // Si encontramos la ruta y tiene vueltas diarias
    if (ruta && ruta.vueltas_diarias_promedio) {
      this.km_esperados = this.dias_laborados * ruta.vueltas_diarias_promedio * ruta.kilometraje_vuelta;
    }

    // Calcular km recorridos
    this.km_recorridos = (this.cargaMaestro.km_final && this.km_inicial !== null) ? this.cargaMaestro.km_final - this.km_inicial : 0;
    this.desviacion_km = this.km_recorridos - this.km_esperados;
    this.rendimiento_calculado = (this.cargaMaestro.litros_cargados && this.km_recorridos > 0) ? this.km_recorridos / this.cargaMaestro.litros_cargados : 0;
  }

  // --- CAMBIO DE MODO ---
  cambiarModoCalculo(nuevoModo: 'dias' | 'vueltas') {
    this.tipo_calculo = nuevoModo;
    // Limpiar datos del modo anterior
    if (nuevoModo === 'dias') {
      this.rutas_realizadas = [];
      this.detalleRutaActual = { id_ruta: null, vueltas: 1 };
    } else {
      this.id_ruta_principal = null;
      this.dias_laborados = 1;
      this.rutaPrincipalSeleccionada = undefined;
    }
    this.recalcularValores();
  }

  // --- VALIDACIÓN Y GUARDADO ---
  guardarCarga() {
    if (this.isSaving) return;

    // Validaciones comunes
    if (!this.cargaMaestro.id_autobus || !this.cargaMaestro.km_final || !this.cargaMaestro.litros_cargados || !this.cargaMaestro.id_ubicacion) {
      this.mostrarNotificacion('Datos Incompletos', 'Autobús, Ubicación, KM Final y Litros son requeridos.');
      return;
    }

    // Validaciones específicas del modo
    if (this.tipo_calculo === 'dias') {
      if (!this.id_ruta_principal || this.dias_laborados <= 0) {
        this.mostrarNotificacion('Datos Incompletos', 'Ruta Principal y Días Laborados son requeridos.');
        return;
      }
    } else {
      if (this.rutas_realizadas.length === 0) {
        this.mostrarNotificacion('Datos Incompletos', 'Debes agregar al menos una ruta.');
        return;
      }
    }

    // Validar motivo de desviación si es necesario
    if (Math.abs(this.desviacion_km) > this.umbral_km && !this.cargaMaestro.motivo_desviacion) {
      this.mostrarNotificacion('Motivo Requerido', 'La desviación de kilometraje es alta. Por favor, escribe un motivo.');
      return;
    }

    this.isSaving = true;

    // Construir payload dinámico según el modo
    let payload: any = {
      id_autobus: this.cargaMaestro.id_autobus,
      id_empleado_operador: this.cargaMaestro.id_empleado_operador,
      id_ubicacion: this.cargaMaestro.id_ubicacion,
      fecha_operacion: this.cargaMaestro.fecha_operacion,
      km_final: this.cargaMaestro.km_final,
      litros_cargados: this.cargaMaestro.litros_cargados,
      motivo_desviacion: this.cargaMaestro.motivo_desviacion,
      tipo_calculo: this.tipo_calculo
    };

    if (this.tipo_calculo === 'dias') {
      payload.id_ruta_principal = this.id_ruta_principal;
      payload.dias_laborados = this.dias_laborados;
    } else {
      payload.rutas_realizadas = this.rutas_realizadas.map(r => ({ id_ruta: r.id_ruta, vueltas: r.vueltas }));
    }

    console.log('Payload enviado:', payload);

    this.http.post(`${this.apiUrl}/cargas-combustible`, payload).subscribe({
      next: () => {
        sessionStorage.setItem('notificacion', '¡Carga de combustible registrada exitosamente!');
        this.router.navigate(['/admin/historial-combustible']);
      },
      error: err => {
        console.error('Error del servidor:', err);
        this.mostrarNotificacion('Error', err.error?.message || 'Error al guardar la carga.', 'error');
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