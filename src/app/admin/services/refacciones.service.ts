// src/app/admin/services/refacciones.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Refaccion {
  id: number;
  nombre: string;
  categoria: string;
  stock_actual: number;
  stock_minimo: number;
  precio_costo: number;
  precio_venta: number;
  proveedor: string;
  descripcion: string;
  fecha_ultima_salida?: string;
  cantidad_ultima_salida?: number;
  fecha_ultima_entrada?: string;
  marca?: string;           
  ubicacion_almacen?: string; 
}

// Interfaces para Entradas (déjalas como están)
export interface EntradaAlmacen {
  ID_Entrada: number;
  ID_Proveedor: number;
  Numero_Factura_Proveedor: string;
  Observaciones: string;
  Recibido_Por_ID: number;
  Fecha_Entrada: string; // Asumiendo que tu DB devuelve la fecha como string
  Nombre_Proveedor?: string;
  Nombre_Empleado?: string;
}

export interface DetalleEntrada {
  ID_Detalle_Entrada: number;
  ID_Entrada: number;
  ID_Refaccion: number;
  Cantidad_Recibida: number;
  Costo_Unitario_Entrada: number;
  Fecha_Caducidad?: string;
}

// --- NUEVAS INTERFACES para tus datos de Salidas ---
export interface SalidaAlmacen {
  ID_Salida: number;
  Tipo_Salida: string;
  ID_Autobus?: number; // Puede ser opcional dependiendo de la salida
  Solicitado_Por_ID: number;
  Observaciones?: string;
  Fecha_Salida: string; // Asumiendo que tu DB añade este campo automáticamente
}

export interface DetalleSalida {
  ID_Detalle_Salida: number;
  ID_Salida: number;
  ID_Refaccion: number;
  Cantidad_Despachada: number;
}


@Injectable({
  providedIn: 'root'
})
export class RefaccionesService {
  private readonly API_BASE_URL = 'http://localhost:3000/api'; // Ajusta la URL base de tu API

  constructor(private http: HttpClient) { }

  getRefacciones(): Observable<Refaccion[]> {
    return this.http.get<Refaccion[]>(`${this.API_BASE_URL}/refacciones`);
  }

  // Métodos para obtener datos de Entradas (déjalos como están)
  getEntradasAlmacen(): Observable<EntradaAlmacen[]> {
    return this.http.get<EntradaAlmacen[]>(`${this.API_BASE_URL}/entradas`);
  }

  getDetallesEntrada(): Observable<DetalleEntrada[]> {
    return this.http.get<DetalleEntrada[]>(`${this.API_BASE_URL}/detalle-entrada`);
  }

  // --- NUEVOS MÉTODOS PARA OBTENER DATOS DE SALIDAS ---

  getSalidasAlmacen(): Observable<SalidaAlmacen[]> {
    return this.http.get<SalidaAlmacen[]>(`${this.API_BASE_URL}/salidas`);
  }

  getDetallesSalida(): Observable<DetalleSalida[]> {
    // Nota: Tu endpoint para detalles de salida es '/api/detalleSalida'
    return this.http.get<DetalleSalida[]>(`${this.API_BASE_URL}/detalleSalida`);
  }
}