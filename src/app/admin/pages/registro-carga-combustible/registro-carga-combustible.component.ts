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
interface Autobus { id_autobus: number; economico: string; kilometraje_ultima_carga: number; modelo?: string; } // 👈 Agregamos modelo
interface Ruta { id_ruta: number; nombre_ruta: string; kilometraje_vuelta: number; vueltas_diarias_promedio?: number; }
interface Ubicacion { id_ubicacion: number; nombre_ubicacion: string; }
interface RutaRealizada { id_ruta: number; nombre_ruta: string; vueltas: number; kilometraje: number; }
interface Rendimiento {
  modelo?: string;
  ruta?: string;
  bueno?: string | number;
  id_ruta?: number;
  nombre_ruta?: string;
  modelo_autobus?: string;
  rendimiento_bueno?: string | number;
}

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
  rendimientos: Rendimiento[] = [];
  tanques: any[] = [];

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

  tipo_calculo: 'dias' | 'vueltas' = 'vueltas';

  autobusControl = new FormControl();
  operadorControl = new FormControl();
  filteredAutobuses$: Observable<Autobus[]>;
  filteredOperadores$: Observable<Operador[]>;

  detalleRutaActual = { id_ruta: null as number | null, vueltas: 1 };
  rutas_realizadas: RutaRealizada[] = [];

  id_ruta_principal: number | null = null;
  dias_laborados: number = 1;
  rutaPrincipalSeleccionada: Ruta | undefined;

  // --- Campos Calculados en Tiempo Real ---
  km_inicial: number | null = null;
  modeloAutobusActual: string = '';

  km_recorridos: number = 0;
  km_esperados: number = 0;
  desviacion_km: number = 0;
  rendimiento_calculado: number = 0;

  litros_desviacion: number = 0;

  umbral_km: number = 15;

  isSaving = false;
  mostrarModalNotificacion = false;
  notificacion = { titulo: 'Aviso', mensaje: '', tipo: 'advertencia' as 'exito' | 'error' | 'advertencia' };
  mostrarModalConfirmacion = false;
  datosConfirmacion: any = {};

  constructor(private http: HttpClient, private router: Router, private location: Location, public authService: AuthService) {
    this.filteredAutobuses$ = this.autobusControl.valueChanges.pipe(
      startWith(''), debounceTime(300), distinctUntilChanged(),
      switchMap(value => this._buscarApi('autobuses', value || ''))
    );
    this.filteredOperadores$ = this.operadorControl.valueChanges.pipe(
      startWith(''), debounceTime(300), distinctUntilChanged(),
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
    if (!searchTerm) return of([]);
    return this.http.get<any[]>(`${this.apiUrl}/${tipo}/buscar`, { params: { term: searchTerm } });
  }

  displayFn(item: any): string { return item ? (item.economico || item.nombre_completo) : ''; }

  onAutobusSelected(event: MatAutocompleteSelectedEvent): void {
    const autobus = event.option.value as Autobus;
    this.cargaMaestro.id_autobus = autobus.id_autobus;
    this.km_inicial = autobus.kilometraje_ultima_carga;
    this.modeloAutobusActual = autobus.modelo || 'Desconocido';
    this.recalcularValores();
  }

  onOperadorSelected(event: MatAutocompleteSelectedEvent): void {
    const operador = event.option.value as Operador;
    this.cargaMaestro.id_empleado_operador = operador.id_operador;
  }

  cargarCatalogos() {
    const peticiones: [Observable<Ruta[]>, Observable<Ubicacion[]>, Observable<Rendimiento[]>, Observable<any>] = [
      this.http.get<Ruta[]>(`${this.apiUrl}/rutas`),
      this.http.get<Ubicacion[]>(`${this.apiUrl}/ubicaciones`),
      this.http.get<Rendimiento[]>(`${this.apiUrl}/rendimientos`),
      this.http.get<any>(`${this.apiUrl}/tanques`)
    ];

    forkJoin(peticiones).subscribe({
      next: ([rutas, ubicaciones, rendimientos, respuestaTanques]) => {
        this.rutas = (rutas as any).data || rutas;
        this.ubicaciones = (ubicaciones as any).data || ubicaciones;
        this.rendimientos = (rendimientos as any).data || rendimientos;
        this.tanques = respuestaTanques.tanques || [];
      },
      error: () => this.mostrarNotificacion('Error de Carga', 'No se pudieron cargar los catálogos.', 'error')
    });
  }

  get tanqueNivelDisponible(): number | null {
    if (!this.cargaMaestro.id_ubicacion) return null;
    const tanquesUbicacion = this.tanques.filter(t => t.id_ubicacion === this.cargaMaestro.id_ubicacion);
    if (tanquesUbicacion.length === 0) return null;
    const tanquePrincipal = tanquesUbicacion.sort((a, b) => a.id_tanque - b.id_tanque)[0];
    return tanquePrincipal ? tanquePrincipal.nivel_actual_litros : null;
  }

  get tanqueNombre(): string {
     if (!this.cargaMaestro.id_ubicacion) return '';
    const tanquesUbicacion = this.tanques.filter(t => t.id_ubicacion === this.cargaMaestro.id_ubicacion);
    if (tanquesUbicacion.length === 0) return '';
    const tanquePrincipal = tanquesUbicacion.sort((a, b) => a.id_tanque - b.id_tanque)[0];
    return tanquePrincipal ? tanquePrincipal.nombre_tanque : '';
  }

  // --- MÉTODOS MODO VUELTAS ---
  agregarRuta() {
    const { id_ruta, vueltas } = this.detalleRutaActual;
    if (!id_ruta || !vueltas || vueltas <= 0) return;
    const rutaSeleccionada = this.rutas.find(r => r.id_ruta === id_ruta);
    if (!rutaSeleccionada) return;
    if (this.rutas_realizadas.some(r => r.id_ruta === id_ruta)) { this.mostrarNotificacion('Ruta Duplicada', 'Esta ruta ya ha sido agregada.'); return; }

    this.rutas_realizadas.push({ id_ruta: rutaSeleccionada.id_ruta, nombre_ruta: rutaSeleccionada.nombre_ruta, vueltas: vueltas, kilometraje: rutaSeleccionada.kilometraje_vuelta });
    this.detalleRutaActual = { id_ruta: null, vueltas: 1 };
    this.recalcularValores();
  }

  eliminarRuta(index: number) { this.rutas_realizadas.splice(index, 1); this.recalcularValores(); }

  // --- MÉTODOS MODO DÍAS ---
  onRutaPrincipalSelected(event: any): void { this.rutaPrincipalSeleccionada = this.rutas.find(r => r.id_ruta === this.id_ruta_principal); this.recalcularValores(); }
  onDiasLaboradosChange(): void { this.recalcularValores(); }

  cambiarModoCalculo(nuevoModo: 'dias' | 'vueltas') {
    this.tipo_calculo = nuevoModo;
    if (nuevoModo === 'dias') { this.rutas_realizadas = []; this.detalleRutaActual = { id_ruta: null, vueltas: 1 }; }
    else { this.id_ruta_principal = null; this.dias_laborados = 1; this.rutaPrincipalSeleccionada = undefined; }
    this.recalcularValores();
  }

  // ====================================================
  // 🧠 CEREBRO DE CÁLCULOS (TELEMETRÍA + RENDIMIENTOS)
  // ====================================================
  recalcularValores() {
    if (this.tipo_calculo === 'dias') { this.recalcularValoresDias(); }
    else { this.recalcularValoresVueltas(); }
  }

  private calcularKPIsBase() {
    this.km_recorridos = (this.cargaMaestro.km_final && this.km_inicial !== null) ? this.cargaMaestro.km_final - this.km_inicial : 0;
    this.desviacion_km = this.km_recorridos - this.km_esperados;
    this.rendimiento_calculado = (this.cargaMaestro.litros_cargados && this.km_recorridos > 0) ? this.km_recorridos / this.cargaMaestro.litros_cargados : 0;
  }

  private recalcularValoresVueltas() {
    this.km_esperados = this.rutas_realizadas.reduce((acc, ruta) => acc + (ruta.kilometraje * ruta.vueltas), 0);
    this.calcularKPIsBase();

    let litrosIdealesTeoricos = 0;

    // 🕵️‍♂️ LOG 1: ¿Qué autobús y catálogo tenemos?
    /*  console.log('--- DEPURANDO CRUCE DE RENDIMIENTO ---');
     console.log('Modelo Autobús Seleccionado:', this.modeloAutobusActual);
     console.log('Catálogo de Rendimientos cargado:', this.rendimientos); */

    for (const r of this.rutas_realizadas) {
      const kmRuta = r.kilometraje * r.vueltas;

      // 🕵️‍♂️ LOG 2: ¿Qué ruta estamos buscando?
      /*  console.log('Buscando configuración para Ruta:', r.nombre_ruta); */

      // BÚSQUEDA A PRUEBA DE MAYÚSCULAS/ESPACIOS
      const rendConfig = this.rendimientos.find(x =>
        // Cruzamos por ID de ruta (más seguro) o por nombre por si acaso
        (x.id_ruta === r.id_ruta || String(x.ruta || x.nombre_ruta).trim().toLowerCase() === String(r.nombre_ruta).trim().toLowerCase())
        &&
        // Cruzamos el modelo permitiendo ambos nombres de columna
        String(x.modelo || x.modelo_autobus).trim().toLowerCase() === String(this.modeloAutobusActual).trim().toLowerCase()
      );

      // 🕵️‍♂️ LOG 3: ¿Encontró la configuración?
      /*  console.log('Resultado de la búsqueda (rendConfig):', rendConfig); */

      const rendimientoBueno = rendConfig ? parseFloat(String(rendConfig.bueno || rendConfig.rendimiento_bueno)) : 3.5;
      /* console.log(`Aplicando Rendimiento: ${rendimientoBueno} km/L para ${r.nombre_ruta}`); */

      litrosIdealesTeoricos += (kmRuta / rendimientoBueno);
    }

    const rendimientoPromedioEsperado = litrosIdealesTeoricos > 0 ? (this.km_esperados / litrosIdealesTeoricos) : 3.5;
    const litrosIdealesReales = rendimientoPromedioEsperado > 0 ? (this.km_recorridos / rendimientoPromedioEsperado) : 0;

    if (this.cargaMaestro.litros_cargados && litrosIdealesReales > 0) {
      this.litros_desviacion = this.cargaMaestro.litros_cargados - litrosIdealesReales;
    } else {
      this.litros_desviacion = 0;
    }
  }

  private recalcularValoresDias() {
    this.km_esperados = 0;
    if (this.id_ruta_principal && this.dias_laborados > 0) {
      const ruta = this.rutas.find(r => r.id_ruta === this.id_ruta_principal);
      this.rutaPrincipalSeleccionada = ruta;
      if (ruta && ruta.vueltas_diarias_promedio) this.km_esperados = this.dias_laborados * ruta.vueltas_diarias_promedio * ruta.kilometraje_vuelta;
    }
    this.calcularKPIsBase();

    // 🚀 MAGIA: Cálculo de Desviación de Diésel (Días)
    if (this.rutaPrincipalSeleccionada && this.km_recorridos > 0) {
      // 🕵️‍♂️ BÚSQUEDA A PRUEBA DE COLUMNAS DE BD (MODO DÍAS)
      const rendConfig = this.rendimientos.find(x =>
        (x.id_ruta === this.id_ruta_principal || String(x.ruta || x.nombre_ruta).trim().toLowerCase() === String(this.rutaPrincipalSeleccionada?.nombre_ruta).trim().toLowerCase())
        &&
        String(x.modelo || x.modelo_autobus).trim().toLowerCase() === String(this.modeloAutobusActual).trim().toLowerCase()
      );

      const rendimientoBueno = rendConfig ? parseFloat(String(rendConfig.bueno || rendConfig.rendimiento_bueno)) : 3.5;
      const litrosIdealesReales = this.km_recorridos / rendimientoBueno;

      if (this.cargaMaestro.litros_cargados) {
        this.litros_desviacion = this.cargaMaestro.litros_cargados - litrosIdealesReales;
      } else {
        this.litros_desviacion = 0;
      }
    } else {
      this.litros_desviacion = 0;
    }
  }

  // ====================================================

  prepararGuardado() {
    if (!this.cargaMaestro.id_autobus || !this.cargaMaestro.km_final || !this.cargaMaestro.litros_cargados || !this.cargaMaestro.id_ubicacion) {
      this.mostrarNotificacion('Datos Incompletos', 'Autobús, Ubicación, KM Final y Litros son requeridos.', 'error'); return;
    }

    if (this.tanqueNivelDisponible !== null && this.cargaMaestro.litros_cargados > this.tanqueNivelDisponible) {
        this.mostrarNotificacion('Stock Insuficiente', `El tanque principal de esta ubicación (${this.tanqueNombre}) solo tiene ${this.tanqueNivelDisponible.toFixed(2)} litros disponibles.`, 'error');
        return;
    }

    if (this.tipo_calculo === 'dias' && (!this.id_ruta_principal || this.dias_laborados <= 0)) {
      this.mostrarNotificacion('Datos Incompletos', 'Ruta Principal y Días Laborados son requeridos.', 'error'); return;
    } else if (this.tipo_calculo === 'vueltas' && this.rutas_realizadas.length === 0) {
      this.mostrarNotificacion('Datos Incompletos', 'Debes agregar al menos una ruta.', 'error'); return;
    }
    if (Math.abs(this.desviacion_km) > this.umbral_km && !this.cargaMaestro.motivo_desviacion) {
      this.mostrarNotificacion('Motivo Requerido', 'La desviación de kilometraje es alta. Por favor, escribe un motivo.', 'advertencia'); return;
    }

    const autobus = this.autobusControl.value;
    const operador = this.operadorControl.value;
    const ubicacion = this.ubicaciones.find(u => u.id_ubicacion === this.cargaMaestro.id_ubicacion);

    let rutaTexto = '';
    if (this.tipo_calculo === 'dias') {
      const ruta = this.rutas.find(r => r.id_ruta === this.id_ruta_principal);
      rutaTexto = `${ruta?.nombre_ruta || 'N/A'} (${this.dias_laborados} días)`;
    } else {
      rutaTexto = this.rutas_realizadas.map(r => `${r.nombre_ruta} (${r.vueltas})`).join(', ');
      if (rutaTexto.length > 50) rutaTexto = rutaTexto.substring(0, 47) + '...';
    }

    this.datosConfirmacion = {
      unidad: typeof autobus === 'object' ? autobus.economico : autobus,
      operador: typeof operador === 'object' ? operador.nombre_completo : (operador || 'Sin asignar'),
      ubicacion: ubicacion?.nombre_ubicacion || 'Desconocida', fecha: this.cargaMaestro.fecha_operacion,
      litros: this.cargaMaestro.litros_cargados, km_anterior: this.km_inicial, km_actual: this.cargaMaestro.km_final,
      recorrido: this.km_recorridos, rendimiento: this.rendimiento_calculado, ruta: rutaTexto,
      desviacion: this.desviacion_km,
      litros_desviacion: this.litros_desviacion // 👈 Mandamos el KPI al resumen
    };
    this.mostrarModalConfirmacion = true;
  }

  confirmarYGuardar() {
    this.mostrarModalConfirmacion = false;
    this.isSaving = true;

    let payload: any = {
      id_autobus: this.cargaMaestro.id_autobus, id_empleado_operador: this.cargaMaestro.id_empleado_operador, id_ubicacion: this.cargaMaestro.id_ubicacion,
      fecha_operacion: this.cargaMaestro.fecha_operacion, km_final: this.cargaMaestro.km_final, litros_cargados: this.cargaMaestro.litros_cargados,
      motivo_desviacion: this.cargaMaestro.motivo_desviacion, tipo_calculo: this.tipo_calculo,
      litros_desviacion: this.litros_desviacion, // 👈 Enviamos el KPI a la BD
      ...(this.tipo_calculo === 'dias' ? { id_ruta_principal: this.id_ruta_principal, dias_laborados: this.dias_laborados } : { rutas_realizadas: this.rutas_realizadas.map(r => ({ id_ruta: r.id_ruta, vueltas: r.vueltas })) })
    };

    this.http.post(`${this.apiUrl}/cargas-combustible`, payload).subscribe({
      next: () => { sessionStorage.setItem('notificacion', '¡Carga registrada exitosamente!'); this.router.navigate(['/admin/historial-combustible']); },
      error: err => { console.error('Error:', err); this.mostrarNotificacion('Error', err.error?.message || 'Error al guardar.', 'error'); this.isSaving = false; }
    });
  }

  cancelarConfirmacion() { this.mostrarModalConfirmacion = false; }
  regresar() { this.location.back(); }
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') { this.notificacion = { titulo, mensaje, tipo }; this.mostrarModalNotificacion = true; }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}