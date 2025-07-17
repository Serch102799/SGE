// app/admin/pages/dashboard/dashboard.component.ts

import { Component, OnInit } from '@angular/core';
import { RefaccionesService, Refaccion } from '../../services/refacciones.service'; // Asegúrate de que esta ruta sea correcta
import { HttpErrorResponse } from '@angular/common/http'; // Para manejo de errores más específico

@Component({
  selector: 'app-dashboard',
standalone: false,
templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'] // Asegúrate de que este archivo CSS exista
})
export class DashboardComponent implements OnInit {

  refacciones: Refaccion[] = []; // Array para almacenar las refacciones
  isLoading: boolean = true; // Para mostrar un spinner mientras se cargan los datos
  errorMessage: string | null = null; // Para mostrar mensajes de error

  // Inyectamos el RefaccionesService aquí, NO HttpClient directamente si el servicio ya lo encapsula
  constructor(private refaccionesService: RefaccionesService) { }

  ngOnInit(): void {
    this.cargarRefacciones();
  }

  cargarRefacciones(): void {
    this.isLoading = true; // Empieza la carga, activa el spinner
    this.errorMessage = null; // Limpia cualquier mensaje de error anterior

    this.refaccionesService.getRefacciones().subscribe({
      next: (data: Refaccion[]) => { // Esperamos un array de Refaccion
        this.refacciones = data;
        this.isLoading = false; // Datos cargados, oculta el spinner
        console.log('Refacciones cargadas correctamente:', this.refacciones);
      },
      error: (error: HttpErrorResponse) => { // Manejo de errores más detallado
        this.isLoading = false; // Termina la carga (incluso si hay error)
        console.error('Error al cargar refacciones:', error);

        // Mensaje de error más amigable para el usuario
        let userMessage = 'Hubo un problema al cargar el inventario. Por favor, inténtalo de nuevo más tarde.';
        if (error.status === 0) {
            userMessage = 'No se pudo conectar con el servidor. Asegúrate de que el backend esté funcionando y la URL sea correcta.';
        } else if (error.status >= 400 && error.status < 500) {
            userMessage = `Error de cliente (${error.status}): ${error.error?.message || error.message}`;
        } else if (error.status >= 500) {
            userMessage = `Error del servidor (${error.status}): ${error.error?.message || error.message}`;
        }
        this.errorMessage = userMessage; // Asigna el mensaje de error para mostrar en el HTML
      }
    });
  }

  /**
   * Método de ayuda para obtener refacciones con stock bajo.
   * Esto filtra el array `refacciones` ya cargado.
   */
  getRefaccionesConStockBajo(): Refaccion[] {
    // Asegúrate de que los nombres de las propiedades coincidan con la interfaz Refaccion
    // y con los datos que recibes de tu API (ej. 'stock_actual', 'stock_minimo' en minúsculas si así vienen)
    return this.refacciones.filter(r => r.stock_actual <= r.stock_minimo);
  }

  // Puedes añadir aquí otros métodos relacionados con la interactividad del dashboard,
  // como navegación a detalles, filtros, etc.
}