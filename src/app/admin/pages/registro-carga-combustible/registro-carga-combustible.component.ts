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
interface Ruta { id_ruta: number; nombre_ruta: string; kilometraje_vuelta: number; }
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

  // --- Lógica de Autocomplete ---
  autobusControl = new FormControl();
  operadorControl = new FormControl();
  filteredAutobuses$: Observable<Autobus[]>;
  filteredOperadores$: Observable<Operador[]>;

  // --- Lógica de Rutas ---
  detalleRutaActual = { id_ruta: null as number | null, vueltas: 1 };
  rutas_realizadas: RutaRealizada[] = [];

  // --- Campos Calculados en Tiempo Real ---
  km_inicial: number | null = null;
  km_recorridos: number = 0;
  km_esperados: number = 0;
  desviacion_km: number = 0;
  rendimiento_calculado: number = 0;
  umbral_km: number = 15;

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
    // Solo se cargan los catálogos que se usan en dropdowns estáticos
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

  recalcularValores() {
    this.km_esperados = this.rutas_realizadas.reduce((acc, ruta) => acc + (ruta.kilometraje * ruta.vueltas), 0);
    this.km_recorridos = (this.cargaMaestro.km_final && this.km_inicial !== null) ? this.cargaMaestro.km_final - this.km_inicial : 0;
    this.desviacion_km = this.km_recorridos - this.km_esperados;
    this.rendimiento_calculado = (this.cargaMaestro.litros_cargados && this.km_recorridos > 0) ? this.km_recorridos / this.cargaMaestro.litros_cargados : 0;
  }

  guardarCarga() {
    if (this.isSaving) return;
    if (!this.cargaMaestro.id_autobus || !this.cargaMaestro.km_final || !this.cargaMaestro.litros_cargados || !this.cargaMaestro.id_ubicacion) {
      this.mostrarNotificacion('Datos Incompletos', 'Autobús, Ubicación, KM Final y Litros son requeridos.');
      return;
    }
    if (Math.abs(this.desviacion_km) > this.umbral_km && !this.cargaMaestro.motivo_desviacion) {
      this.mostrarNotificacion('Motivo Requerido', 'La desviación de kilometraje es alta. Por favor, escribe un motivo.');
      return;
    }

    this.isSaving = true;
    const payload = {
      ...this.cargaMaestro,
      rutas_realizadas: this.rutas_realizadas.map(r => ({ id_ruta: r.id_ruta, vueltas: r.vueltas }))
    };

    this.http.post(`${this.apiUrl}/cargas-combustible`, payload).subscribe({
      next: () => {
        sessionStorage.setItem('notificacion', '¡Carga de combustible registrada exitosamente!');
        this.router.navigate(['/admin/historial-combustible']);
      },
      error: err => {
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