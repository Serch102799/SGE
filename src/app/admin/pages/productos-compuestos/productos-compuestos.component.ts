import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { startWith, debounceTime, switchMap, map, catchError } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { environment } from '../../../../environments/environments';

// Interfaz unificada para el buscador
interface ItemBuscador { 
  id: number; 
  nombre: string; 
  tipo: 'Refacción' | 'Insumo'; 
}

// Interfaz adaptada para soportar IDs de insumos y refacciones
interface Componente { 
  id_componente?: number; 
  id_refaccion_hijo?: number | null; 
  id_insumo_hijo?: number | null; 
  tipo?: 'Refacción' | 'Insumo';
  nombre_componente: string; 
  cantidad_necesaria: number; 
}

@Component({
  selector: 'app-productos-compuestos',
  standalone: false,
  templateUrl: './productos-compuestos.component.html',
  styleUrls: ['./productos-compuestos.component.css']
})
export class ProductosCompuestosComponent implements OnInit {
  
  private apiUrl = environment.apiUrl;
  
  // Para el buscador del producto "Padre" (Sigue siendo solo Refacciones)
  productoPadreControl = new FormControl();
  filteredProductosPadre$: Observable<ItemBuscador[]>;
  productoPadreSeleccionado: ItemBuscador | null = null;
  
  // Para el buscador de los "Hijos" (Ahora busca Refacciones E Insumos)
  componenteControl = new FormControl();
  filteredComponentes$: Observable<ItemBuscador[]>;
  
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
    // Buscador del Padre (Artículos Armados / Refacciones)
    this.filteredProductosPadre$ = this.productoPadreControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      switchMap(value => this._buscarRefaccion(value || ''))
    );

    // Buscador Mixto de Componentes (Hijos)
    this.filteredComponentes$ = this.componenteControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      switchMap(value => this._buscarComponenteGlobal(value || ''))
    );
  }

  ngOnInit(): void {}
  
  // Busca únicamente refacciones (Para el producto principal a armar)
  private _buscarRefaccion(term: any): Observable<ItemBuscador[]> {
    const searchTerm = typeof term === 'string' ? term : term.nombre;
    if (!searchTerm || searchTerm.length < 2) return of([]);
    
    return this.http.get<any[]>(`${this.apiUrl}/refacciones/buscar`, { params: { term: searchTerm } })
      .pipe(
        map(res => res.map(item => ({ 
          id: item.id_refaccion, 
          nombre: item.nombre, 
          tipo: 'Refacción' 
        })))
      );
  }

  // Busca refacciones E insumos simultáneamente (Para las piezas de la receta)
  private _buscarComponenteGlobal(term: any): Observable<ItemBuscador[]> {
    const searchTerm = typeof term === 'string' ? term : term.nombre;
    if (!searchTerm || searchTerm.length < 2) return of([]);

    const reqRefacciones = this.http.get<any[]>(`${this.apiUrl}/refacciones/buscar`, { params: { term: searchTerm } }).pipe(catchError(() => of([])));
    const reqInsumos = this.http.get<any[]>(`${this.apiUrl}/insumos/buscar`, { params: { term: searchTerm } }).pipe(catchError(() => of([])));

    // Ejecuta ambas consultas al mismo tiempo y las une
    return forkJoin([reqRefacciones, reqInsumos]).pipe(
      map(([refacciones, insumos]) => {
        const refs: ItemBuscador[] = refacciones.map(r => ({
          id: r.id_refaccion,
          nombre: `[REF] ${r.nombre}`, // Le ponemos etiqueta para distinguirlos
          tipo: 'Refacción'
        }));
        const ins: ItemBuscador[] = insumos.map(i => ({
          id: i.id_insumo,
          nombre: `[INS] ${i.nombre}`, // Le ponemos etiqueta para distinguirlos
          tipo: 'Insumo'
        }));
        
        return [...refs, ...ins]; // Devolvemos el arreglo combinado
      })
    );
  }

  displayFn(item: ItemBuscador): string {
    return item && item.nombre ? item.nombre : '';
  }

  onProductoPadreSelected(event: MatAutocompleteSelectedEvent): void {
    this.productoPadreSeleccionado = event.option.value as ItemBuscador;
    this.cargarRecetaExistente();
  }

  cargarRecetaExistente(): void {
    if (!this.productoPadreSeleccionado) return;
    this.http.get<any[]>(`${this.apiUrl}/productos-compuestos/${this.productoPadreSeleccionado.id}`)
      .subscribe(data => {
        // Mapeamos los datos que vengan de la base de datos a nuestra nueva interfaz
        this.componentesReceta = data.map(d => ({
          id_componente: d.id_componente,
          id_refaccion_hijo: d.id_refaccion_hijo || null,
          id_insumo_hijo: d.id_insumo_hijo || null,
          tipo: d.id_insumo_hijo ? 'Insumo' : 'Refacción',
          nombre_componente: d.nombre_componente || d.nombre,
          cantidad_necesaria: d.cantidad_necesaria
        }));
      });
  }

  agregarComponente(): void {
    const componenteSeleccionado = this.componenteControl.value as ItemBuscador;
    
    // Validación estricta para asegurar que seleccionó algo de la lista
    if (!componenteSeleccionado || !componenteSeleccionado.id || !this.cantidadComponente || this.cantidadComponente <= 0) {
      alert('Selecciona un componente válido de la lista y una cantidad mayor a 0.');
      return;
    }
    
    this.componentesReceta.push({
      id_refaccion_hijo: componenteSeleccionado.tipo === 'Refacción' ? componenteSeleccionado.id : null,
      id_insumo_hijo: componenteSeleccionado.tipo === 'Insumo' ? componenteSeleccionado.id : null,
      tipo: componenteSeleccionado.tipo,
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
      this.mostrarNotificacion('Atención', 'Debes seleccionar un producto principal y agregar al menos un componente.', 'advertencia');
      return;
    }

    this.isSaving = true;
    
    const payload = {
      componentes: this.componentesReceta.map(c => ({
        id_refaccion_hijo: c.id_refaccion_hijo || null,
        id_insumo_hijo: c.id_insumo_hijo || null,
        cantidad_necesaria: c.cantidad_necesaria
      }))
    };

    this.http.post(`${this.apiUrl}/productos-compuestos/${this.productoPadreSeleccionado.id}`, payload).subscribe({
      next: () => {
        this.mostrarNotificacion('¡Éxito!', 'Receta guardada exitosamente.', 'exito');
        this.isSaving = false;
        
        this.limpiarFormulario();
      },
      error: (err) => {
        this.mostrarNotificacion('Error', err.error?.message || 'Error al guardar la receta.', 'error');
        this.isSaving = false;
      }
    });
  }
  limpiarFormulario(): void {
    this.productoPadreControl.setValue('');
    this.productoPadreSeleccionado = null;
    
    this.componenteControl.setValue('');
    
    this.componentesReceta = [];
    
    this.cantidadComponente = 1;
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}