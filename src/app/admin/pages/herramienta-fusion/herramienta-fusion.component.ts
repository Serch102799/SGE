import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

@Component({
  selector: 'app-herramienta-fusion',
  standalone: false,
  templateUrl: './herramienta-fusion.component.html',
  styleUrls: ['./herramienta-fusion.component.css']
})
export class HerramientaFusionComponent implements OnInit {
  apiUrl = `${environment.apiUrl}/refacciones`;

  // Controles de búsqueda
  principalControl = new FormControl();
  duplicadoControl = new FormControl();

  filteredPrincipal$: Observable<any[]> = of([]);
  filteredDuplicado$: Observable<any[]> = of([]);

  itemPrincipal: any = null;
  itemDuplicado: any = null;

  isMerging = false;

  // Notificaciones
  mostrarModalNotificacion = false;
  notificacion = { titulo: '', mensaje: '', tipo: 'advertencia' };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.filteredPrincipal$ = this.principalControl.valueChanges.pipe(
      startWith(''), debounceTime(400), distinctUntilChanged(),
      switchMap(value => this.buscarRefaccion(value || ''))
    );

    this.filteredDuplicado$ = this.duplicadoControl.valueChanges.pipe(
      startWith(''), debounceTime(400), distinctUntilChanged(),
      switchMap(value => this.buscarRefaccion(value || ''))
    );
  }

  buscarRefaccion(term: any): Observable<any[]> {
    const searchTerm = typeof term === 'string' ? term : term.nombre;
    if (!searchTerm || searchTerm.length < 2) return of([]);
    
    return this.http.get<any[]>(`${this.apiUrl}/buscar`, { params: { term: searchTerm } }).pipe(
      map(res => res.map(item => ({
        id: item.id_refaccion,
        nombre: item.nombre,
        numero_parte: item.numero_parte || 'S/N',
        marca: item.marca || 'S/M'
      })))
    );
  }

  displayFn(item: any): string { return item ? `${item.nombre} (${item.numero_parte})` : ''; }

  onPrincipalSelected(event: MatAutocompleteSelectedEvent) { this.itemPrincipal = event.option.value; }
  onDuplicadoSelected(event: MatAutocompleteSelectedEvent) { this.itemDuplicado = event.option.value; }

  limpiarSeleccion() {
    this.itemPrincipal = null; this.itemDuplicado = null;
    this.principalControl.setValue(''); this.duplicadoControl.setValue('');
  }

  confirmarFusion() {
    if (!this.itemPrincipal || !this.itemDuplicado) {
      this.mostrarNotificacion('Error', 'Debes seleccionar ambos artículos.', 'advertencia');
      return;
    }
    if (this.itemPrincipal.id === this.itemDuplicado.id) {
      this.mostrarNotificacion('Error', 'No puedes fusionar un artículo consigo mismo.', 'error');
      return;
    }

    if(confirm(`ATENCIÓN: Vas a transferir todo el historial de "${this.itemDuplicado.nombre}" hacia "${this.itemPrincipal.nombre}". El duplicado será eliminado. ¿Proceder?`)) {
      this.isMerging = true;
      this.http.post(`${this.apiUrl}/fusionar`, { 
        id_principal: this.itemPrincipal.id, 
        id_duplicado: this.itemDuplicado.id 
      }).subscribe({
        next: (res: any) => {
          this.isMerging = false;
          this.mostrarNotificacion('Fusión Exitosa', res.message, 'exito');
          this.limpiarSeleccion();
        },
        error: (err) => {
          this.isMerging = false;
          this.mostrarNotificacion('Error de Fusión', err.error?.message || 'Error desconocido', 'error');
        }
      });
    }
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: string) {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}