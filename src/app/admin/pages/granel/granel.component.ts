import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { environment } from '../../../../environments/environments';

@Component({
  selector: 'app-granel',
  standalone: false,
  templateUrl: './granel.component.html',
  styleUrls: ['./granel.component.css']
})
export class GranelComponent implements OnInit {
  apiUrl = `${environment.apiUrl}/granel`;
  
  tamboresAbiertos: any[] = [];
  tamboresCerrados: any[] = [];
  isLoading = false;
  isSaving = false;

  // 🚀 NUEVO: Control de Insumo vs Refacción
  tipoArticulo: 'insumo' | 'refaccion' = 'insumo';

  articuloControl = new FormControl();
  filteredArticulos$!: Observable<any[]>;
  articuloSeleccionado: any = null;

  modalActivo: string = '';
  tamborAConfirmar: any = null;
  tipoCierre: 'tradicional' | 'global' = 'tradicional'; // Controla qué endpoint llamar

  mostrarModalNotificacion = false;
  notificacion = { titulo: '', mensaje: '', tipo: 'advertencia' };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarPanel();

    this.filteredArticulos$ = this.articuloControl.valueChanges.pipe(
      startWith(''),
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(value => {
        const term = typeof value === 'string' ? value : value?.nombre;
        if (!term || term.length < 2) return of([]);
        
        // Dependiendo del radio button, busca en una ruta u otra
        const rutaBusqueda = this.tipoArticulo === 'insumo' ? 'insumos' : 'refacciones';
        return this.http.get<any[]>(`${environment.apiUrl}/${rutaBusqueda}/buscar`, { params: { term } }).pipe(
          catchError(() => of([]))
        );
      })
    );
  }

  cambiarTipoArticulo(tipo: 'insumo' | 'refaccion') {
    this.tipoArticulo = tipo;
    this.articuloControl.setValue('');
    this.articuloSeleccionado = null;
  }

  displayArticulo(item: any): string {
    if (!item) return '';
    if (this.tipoArticulo === 'insumo') return `${item.nombre} (Stock: ${item.stock_actual})`;
    return `${item.nombre} (No. Parte: ${item.numero_parte || 'S/N'})`;
  }

  onArticuloSelected(event: MatAutocompleteSelectedEvent): void {
    this.articuloSeleccionado = event.option.value;
  }

  cargarPanel() {
    this.isLoading = true;
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.tamboresAbiertos = data.filter(t => t.estado === 'Abierto');
        this.tamboresCerrados = data.filter(t => t.estado === 'Cerrado');
        this.isLoading = false;
      },
      error: () => {
        this.mostrarNotificacion('Error', 'No se pudieron cargar los datos.', 'error');
        this.isLoading = false;
      }
    });
  }

  abrirModalNuevo() {
    this.modalActivo = 'nuevo';
    this.articuloControl.setValue('');
    this.articuloSeleccionado = null;
  }

  abrirModalConfirmacion(tambor: any, tipo: 'tradicional' | 'global') {
    this.tamborAConfirmar = tambor;
    this.tipoCierre = tipo;
    this.modalActivo = 'confirmarCierre';
  }

  cerrarModal() {
    this.modalActivo = '';
    this.tamborAConfirmar = null;
  }

  guardarNuevoTambor() {
    if (!this.articuloSeleccionado) {
      this.mostrarNotificacion('Atención', 'Debes seleccionar un artículo del catálogo.', 'advertencia');
      return;
    }

    this.isSaving = true;
    const payload = { 
      id_item: this.tipoArticulo === 'insumo' ? this.articuloSeleccionado.id_insumo : this.articuloSeleccionado.id_refaccion,
      tipo_item: this.tipoArticulo
    };

    this.http.post(`${this.apiUrl}/abrir`, payload).subscribe({
      next: () => {
        this.mostrarNotificacion('¡Éxito!', 'El artículo se ha movido al piso de taller.', 'exito');
        this.cerrarModal();
        this.cargarPanel();
        this.isSaving = false;
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'No se pudo abrir el artículo.', 'error');
        this.isSaving = false;
      }
    });
  }

  liquidarTambor() {
    if (!this.tamborAConfirmar) return;
    this.isSaving = true;

    // Decidimos a qué endpoint pegarle
    const ruta = this.tipoCierre === 'global' ? 'prorrateo-global' : 'cerrar-prorratear';

    this.http.post<any>(`${this.apiUrl}/${this.tamborAConfirmar.id_consumible_granel}/${ruta}`, {}).subscribe({
      next: (res) => {
        const msj = `Liquidación Exitosa. El costo se dividió entre ${res.vehiculos_impactados} vehículos impactados ($${parseFloat(res.costo_asignado_por_vehiculo).toLocaleString()} a cada uno).`;
        this.mostrarNotificacion('¡Ajuste Contable!', msj, 'exito');
        this.cerrarModal();
        this.cargarPanel();
        this.isSaving = false;
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'Error al liquidar.', 'error');
        this.isSaving = false;
      }
    });
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: string) {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}