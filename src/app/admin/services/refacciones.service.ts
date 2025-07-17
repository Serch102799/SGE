import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Define una interfaz para la estructura de tu Refacción
export interface Refaccion {
  id_refaccion: string; // Asumiendo que el ID es un string/UUID en tu DB
  nombre: string;
  numero_parte_fabricante: string;
  categoria: string;
  marca: string;
  unidad_medida: string;
  ubicacion_almacen: string;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number;
  precio_costo: number;
  fecha_ultima_entrada: string; // Puedes usar Date si necesitas objetos Date
  proveedor_principal_id: string; // Asumiendo que ID de proveedor es string
}

@Injectable({
  providedIn: 'root'
})
export class RefaccionesService {
  // Asegúrate de que esta URL base sea correcta para tu backend
  // Si tu API está en localhost:3000 y el router de refacciones está bajo '/api/refacciones'
  private apiUrl = 'http://localhost:3000/api/refacciones';

  constructor(private http: HttpClient) { }

  /**
   * Obtiene todas las refacciones del backend.
   */
  getRefacciones(): Observable<Refaccion[]> {
    return this.http.get<Refaccion[]>(this.apiUrl);
  }

  /**
   * Obtiene una refacción por nombre.
   */
  getRefaccionPorNombre(nombre: string): Observable<Refaccion> {
    return this.http.get<Refaccion>(`${this.apiUrl}/nombre/${nombre}`);
  }

  /**
   * Obtiene refacciones por categoría.
   */
  getRefaccionesPorCategoria(categoria: string): Observable<Refaccion[]> {
    return this.http.get<Refaccion[]>(`${this.apiUrl}/categoria/${categoria}`);
  }

  /**
   * Obtiene refacciones por marca.
   */
  getRefaccionesPorMarca(marca: string): Observable<Refaccion[]> {
    return this.http.get<Refaccion[]>(`${this.apiUrl}/marca/${marca}`);
  }

  /**
   * Crea una nueva refacción.
   */
  crearRefaccion(refaccion: Omit<Refaccion, 'id_refaccion'>): Observable<Refaccion> {
    // Nota: Omit<Refaccion, 'id_refaccion'> porque el ID lo genera la DB
    return this.http.post<Refaccion>(this.apiUrl, refaccion);
  }

  /**
   * Actualiza una refacción por nombre.
   */
  actualizarRefaccion(nombre: string, updates: Partial<Refaccion>): Observable<{ message: string, refaccion: Refaccion }> {
    // Partial<Refaccion> permite enviar solo las propiedades a actualizar
    return this.http.put<{ message: string, refaccion: Refaccion }>(`${this.apiUrl}/nombre/${nombre}`, updates);
  }

  /**
   * Elimina una refacción por nombre.
   */
  eliminarRefaccion(nombre: string): Observable<{ message: string, refaccion: Refaccion }> {
    return this.http.delete<{ message: string, refaccion: Refaccion }>(`${this.apiUrl}/nombre/${nombre}`);
  }
}