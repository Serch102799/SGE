import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { environment } from '../../../../environments/environments';

interface RefaccionSimple { id: number; nombre: string; }
interface Componente { id_componente?: number; id_refaccion_hijo: number; nombre_componente: string; cantidad_necesaria: number; }

@Component({
  selector: 'app-productos-compuestos',
  standalone: false,
  templateUrl: './productos-compuestos.component.html',
  styleUrls: ['./productos-compuestos.component.css']
})
export class ProductosCompuestosComponent implements OnInit {
  
  private apiUrl = environment.apiUrl;
  
  // Para el buscador del producto "Padre"
  productoPadreControl = new FormControl();
  filteredProductosPadre$: Observable<RefaccionSimple[]>;
  productoPadreSeleccionado: RefaccionSimple | null = null;
  
  // Para el buscador de los "Hijos" (componentes)
  componenteControl = new FormControl();
  filteredComponentes$: Observable<RefaccionSimple[]>;
  
  // Lista de componentes de la receta
  componentesReceta: Componente[] = [];
  cantidadComponente: number = 1;
  isSaving = false;

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  constructor(private http: HttpClient) {
    this.filteredProductosPadre$ = this.productoPadreControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      switchMap(value => this._buscarRefaccion(value || ''))
    );
    this.filteredComponentes$ = this.componenteControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      switchMap(value => this._buscarRefaccion(value || ''))
    );
  }

  ngOnInit(): void {}
  

  private _buscarRefaccion(term: any): Observable<RefaccionSimple[]> {
    const searchTerm = typeof term === 'string' ? term : term.nombre;
    if (!searchTerm || searchTerm.length < 2) return of([]);
    return this.http.get<any[]>(`${this.apiUrl}/refacciones/buscar`, { params: { term: searchTerm } })
      .pipe(map(res => res.map(item => ({ id: item.id_refaccion, nombre: item.nombre }))));
  }

  displayFn(item: RefaccionSimple): string {
    return item ? item.nombre : '';
  }

  onProductoPadreSelected(event: MatAutocompleteSelectedEvent): void {
    this.productoPadreSeleccionado = event.option.value as RefaccionSimple;
    this.cargarRecetaExistente();
  }

  cargarRecetaExistente(): void {
    if (!this.productoPadreSeleccionado) return;
    this.http.get<Componente[]>(`${this.apiUrl}/productos-compuestos/${this.productoPadreSeleccionado.id}`)
      .subscribe(data => this.componentesReceta = data);
  }

  agregarComponente(): void {
    const componenteSeleccionado = this.componenteControl.value as RefaccionSimple;
    if (!componenteSeleccionado || !this.cantidadComponente || this.cantidadComponente <= 0) {
      alert('Selecciona un componente y una cantidad válida.');
      return;
    }
    
    this.componentesReceta.push({
      id_refaccion_hijo: componenteSeleccionado.id,
      nombre_componente: componenteSeleccionado.nombre,
      cantidad_necesaria: this.cantidadComponente
    });

    this.componenteControl.setValue('');
    this.cantidadComponente = 1;
  }

  eliminarComponente(index: number): void {
    this.componentesReceta.splice(index, 1);
  }

  guardarReceta(): void {
    if (!this.productoPadreSeleccionado || this.componentesReceta.length === 0) {
      alert('Debes seleccionar un producto y agregar al menos un componente.');
      return;
    }

    this.isSaving = true;
    const payload = {
      componentes: this.componentesReceta.map(c => ({
        id_refaccion_hijo: c.id_refaccion_hijo,
        cantidad_necesaria: c.cantidad_necesaria
      }))
    };

    this.http.post(`${this.apiUrl}/productos-compuestos/${this.productoPadreSeleccionado.id}`, payload).subscribe({
      next: () => {
        alert('Receta guardada exitosamente.');
        this.isSaving = false;
      },
      error: (err) => {
        alert(err.error?.message || 'Error al guardar la receta.');
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