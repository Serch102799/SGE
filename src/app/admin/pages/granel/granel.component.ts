import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap, catchError, map } from 'rxjs/operators';
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

  // Autocomplete para buscar insumos
  insumoControl = new FormControl();
  filteredInsumos$!: Observable<any[]>;
  insumoSeleccionado: any = null;

  modalActivo: string = '';
  tamborAConfirmar: any = null;

  mostrarModalNotificacion = false;
  notificacion = { titulo: '', mensaje: '', tipo: 'advertencia' };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarPanel();

    this.filteredInsumos$ = this.insumoControl.valueChanges.pipe(
      startWith(''),
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(value => {
        const term = typeof value === 'string' ? value : value?.nombre;
        if (!term || term.length < 2) return of([]);
        return this.http.get<any[]>(`${environment.apiUrl}/insumos/buscar`, { params: { term } }).pipe(
          catchError(() => of([]))
        );
      })
    );
  }

  displayInsumo(insumo: any): string {
    return insumo ? `${insumo.nombre} (Stock: ${insumo.stock_actual})` : '';
  }

  onInsumoSelected(event: MatAutocompleteSelectedEvent): void {
    this.insumoSeleccionado = event.option.value;
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
    this.insumoControl.setValue('');
    this.insumoSeleccionado = null;
  }

  abrirModalConfirmacion(tambor: any) {
    this.tamborAConfirmar = tambor;
    this.modalActivo = 'confirmarCierre';
  }

  cerrarModal() {
    this.modalActivo = '';
    this.tamborAConfirmar = null;
  }

  guardarNuevoTambor() {
    if (!this.insumoSeleccionado) {
      this.mostrarNotificacion('Atención', 'Debes seleccionar un insumo del catálogo.', 'advertencia');
      return;
    }

    this.isSaving = true;
    this.http.post(`${this.apiUrl}/abrir`, { id_insumo: this.insumoSeleccionado.id_insumo }).subscribe({
      next: () => {
        this.mostrarNotificacion('¡Éxito!', 'El insumo se ha movido al piso de taller y está listo para usarse.', 'exito');
        this.cerrarModal();
        this.cargarPanel();
        this.isSaving = false;
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'No se pudo abrir el tambor.', 'error');
        this.isSaving = false;
      }
    });
  }

  liquidarTambor() {
    if (!this.tamborAConfirmar) return;
    this.isSaving = true;

    this.http.post<any>(`${this.apiUrl}/${this.tamborAConfirmar.id_consumible_granel}/cerrar-prorratear`, {}).subscribe({
      next: (res) => {
        const msj = `Tambor liquidado. El costo de $${parseFloat(this.tamborAConfirmar.costo_total_tambor).toLocaleString()} se dividió entre ${res.vehiculos_impactados} vehículos impactados ($${parseFloat(res.costo_asignado_por_vehiculo).toLocaleString()} a cada uno).`;
        this.mostrarNotificacion('¡Prorrateo Exitoso!', msj, 'exito');
        this.cerrarModal();
        this.cargarPanel();
        this.isSaving = false;
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'Error al liquidar el tambor.', 'error');
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