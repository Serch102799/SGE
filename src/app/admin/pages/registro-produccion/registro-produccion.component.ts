import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { environment } from '../../../../environments/environments';
import { AuthService } from '../../../services/auth.service';

interface RefaccionSimple { id: number; nombre: string; }
interface Componente { nombre_componente: string; cantidad_necesaria: number; }

@Component({
  selector: 'app-registro-produccion',
  standalone: false,
  templateUrl: './registro-produccion.component.html',
  styleUrls: ['./registro-produccion.component.css']
})
export class RegistroProduccionComponent implements OnInit {

  private apiUrl = environment.apiUrl;

  // Formulario Maestro
  ordenProduccion = {
    id_refaccion_producida: null as number | null,
    cantidad_producida: 1,
    fecha_operacion: this.getFormattedCurrentDateTime(),
    observaciones: ''
  };

  // Buscador de Producto
  productoControl = new FormControl();
  filteredProductos$: Observable<RefaccionSimple[]>;
  productoSeleccionado: RefaccionSimple | null = null;

  // Lista de componentes
  receta: Componente[] = [];
  isLoading = false;
  isSaving = false;

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient, public authService: AuthService) {
    this.filteredProductos$ = this.productoControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      // Filtra solo refacciones que estén marcadas como 'es_compuesto'
      switchMap(value => this._buscarRefaccion(value || '', true))
    );
  }

  ngOnInit(): void { }


  private getFormattedCurrentDateTime(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  private _buscarRefaccion(term: any, soloCompuestos: boolean = false): Observable<RefaccionSimple[]> {
    const searchTerm = typeof term === 'string' ? term : term.nombre;
    if (!searchTerm || searchTerm.length < 2) return of([]);

    // El endpoint de búsqueda debe ser capaz de filtrar por 'es_compuesto'
    const params = { term: searchTerm, es_compuesto: soloCompuestos.toString() };
    return this.http.get<any[]>(`${this.apiUrl}/refacciones/buscar`, { params })
      .pipe(map(res => res.map(item => ({ id: item.id_refaccion, nombre: item.nombre }))));
  }

  displayFn(item: RefaccionSimple): string { return item ? item.nombre : ''; }

  onProductoSelected(event: MatAutocompleteSelectedEvent): void {
    this.productoSeleccionado = event.option.value as RefaccionSimple;
    this.ordenProduccion.id_refaccion_producida = this.productoSeleccionado.id;
    this.cargarReceta();
  }

  cargarReceta(): void {
    if (!this.productoSeleccionado) return;
    this.isLoading = true;
    this.http.get<Componente[]>(`${this.apiUrl}/productos-compuestos/${this.productoSeleccionado.id}`)
      .subscribe(data => {
        this.receta = data;
        this.isLoading = false;
      });
  }

  guardarOrden(): void {
    if (!this.ordenProduccion.id_refaccion_producida || !this.ordenProduccion.cantidad_producida) {
      this.mostrarNotificacion(
        'Error',
        'Selecciona un producto y una cantidad válida antes de continuar.',
        'error'
      );
      return;
    }

    this.isSaving = true;
    this.http.post(`${this.apiUrl}/produccion`, this.ordenProduccion).subscribe({
      next: () => {
        this.mostrarNotificacion(
          'Error',
          'Orden de producción guardada. El inventario ha sido actualizado.',
          'error'
        );
        this.isSaving = false;
        // Resetear formulario
        this.productoControl.setValue('');
        this.productoSeleccionado = null;
        this.receta = [];
        this.ordenProduccion.cantidad_producida = 1;
      },
      error: (err) => {
        this.mostrarNotificacion(
          'Error',
          'Eror al guardar la orden. ' + (err.error?.message || ''),
          'error'
        );
        this.isSaving = false;
      }
    });
  }
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}