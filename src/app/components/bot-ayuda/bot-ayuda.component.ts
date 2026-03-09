import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environments'; 

interface ContextoAyuda {
  titulo: string;
  icono: string;
  descripcion: string;
  pasos?: string[]; // Opcional: Lista de pasos
  tip?: string;     // Opcional: Consejo destacado
}

@Component({
  selector: 'app-bot-ayuda',
  standalone: false,
  templateUrl: './bot-ayuda.component.html',
  styleUrls: ['./bot-ayuda.component.css']
})
export class BotAyudaComponent implements OnInit {
  
  isOpen: boolean = false;
  pestanaActiva: 'guia' | 'ticket' = 'guia'; 
  
  nuevoTicket = { asunto: '', descripcion: '' };

  // Variables Notificación
  mostrarModalNotificacion = false;
  notificacion = { titulo: '', mensaje: '', tipo: 'exito' as 'exito' | 'error' | 'advertencia' };

  // Inicializamos la ayuda con el formato nuevo
  ayudaActual: ContextoAyuda = {
    titulo: 'Asistente de S&A Group',
    icono: 'fa-info-circle',
    descripcion: 'Bienvenido al centro de ayuda rápida.',
    pasos: [
      'Navega por el menú lateral para abrir un módulo.',
      'Si tienes dudas, abre este bot para leer la guía rápida.',
      'Si encuentras un error, repórtalo en la pestaña de al lado.'
    ],
    tip: 'Mantén tu sistema actualizado revisando constantemente los reportes de stock.'
  };

  constructor(private router: Router, private http: HttpClient) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.actualizarContextoAyuda(event.urlAfterRedirects);
    });
  }

  ngOnInit(): void {
    this.actualizarContextoAyuda(this.router.url);
  }

  toggleBot() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.pestanaActiva = 'guia';
  }

  cambiarPestana(pestana: 'guia' | 'ticket') { this.pestanaActiva = pestana; }

  // --- INTELIGENCIA CONTEXTUAL MEJORADA ---
  actualizarContextoAyuda(url: string) {
    if (url.includes('servicios-externos')) {
      this.ayudaActual = { 
        titulo: 'Servicios Externos', 
        icono: 'fa-wrench',
        descripcion: 'Registra los mantenimientos o reparaciones realizados por talleres fuera de la empresa.',
        pasos: [
          'Busca el número económico del autobús.',
          'Ingresa el costo del servicio y selecciona si aplica IVA.',
          'Si el taller ofreció garantía, activa el interruptor y escribe los días.'
        ],
        tip: 'El sistema calculará la fecha de vencimiento de la garantía automáticamente y pintará la fila de verde.' 
      };
    } else if (url.includes('reportes')) {
      this.ayudaActual = { 
        titulo: 'Módulo de Reportes', 
        icono: 'fa-chart-pie',
        descripcion: 'Genera auditorías detalladas en formato PDF o Excel listas para imprimir.',
        pasos: [
          'Selecciona el tipo de reporte en la lista desplegable.',
          'Ingresa el rango de fechas a evaluar.',
          'Si es un reporte específico, busca y agrega los autobuses o refacciones.'
        ],
        tip: 'Usa el botón "Limpiar Filtros" (borde gris) para borrar todas tus selecciones rápidamente y empezar de cero.' 
      };
    } else if (url.includes('carga-combustible')) {
      this.ayudaActual = { 
        titulo: 'Cargas de Diésel', 
        icono: 'fa-gas-pump',
        descripcion: 'Controla el consumo de combustible y detecta anomalías de rendimiento.',
        pasos: [
          'Selecciona el autobús y el operador.',
          'Elige tu método de cálculo: por Días o por Vueltas.',
          'Ingresa el kilometraje final y los litros cargados.'
        ],
        tip: 'Si el autobús gastó más diésel del esperado según la ruta, el sistema te pedirá obligatoriamente un "Motivo de desviación".' 
      };
    } else if (url.includes('tickets')) {
      this.ayudaActual = { 
        titulo: 'Centro de Soporte', 
        icono: 'fa-headset',
        descripcion: 'Administra los reportes de error enviados por los usuarios del sistema.',
        pasos: [
          'Revisa los tickets marcados en rojo (Pendientes).',
          'Si estás trabajando en uno, pásalo a "En Revisión" (Lupa).',
          'Una vez solucionado, márcalo como "Resuelto" (Palomita verde).'
        ],
        tip: 'Los tickets resueltos se volverán un poco transparentes y bajarán al fondo de la lista para no estorbar.' 
      };
      } else if (url.includes('refacciones')) {
      this.ayudaActual = { 
        titulo: 'Inventario de Refacciones', 
        icono: 'fa-cogs',
        descripcion: 'Administra el catálogo de piezas de tu almacén, consulta existencias y registra salidas manuales.',
        pasos: [
          'Busca una pieza por nombre, número de parte o usa los filtros de categoría.',
          'Usa el botón "Editar" para actualizar la ubicación en el almacén o el stock mínimo.',
          'Usa el botón "Salida" para descontar piezas que se utilizaron en el taller.'
        ],
        tip: 'Si una pieza llega a su "Stock Mínimo", el sistema te lo notificará en el Dashboard y en los Reportes de Stock Bajo.' 
      };
    }  
    else {
      this.ayudaActual = { 
        titulo: 'Asistente Global', 
        icono: 'fa-robot',
        descripcion: 'Navega por las distintas pantallas del sistema. Al entrar a un módulo específico (como Reportes o Combustible), esta ventana cambiará automáticamente para darte instrucciones paso a paso.',
        tip: '¿Algo falló? Usa la pestaña "Reportar Falla" para enviar un ticket directo a sistemas.'
      };
    }
  }

  // ... (Aquí dejas tus funciones de mostrarNotificacion y enviarTicket igual que antes) ...
  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }

  enviarTicket() {
    if (!this.nuevoTicket.asunto || !this.nuevoTicket.descripcion) {
      this.mostrarNotificacion('Campos Incompletos', 'Por favor, llena ambos campos para poder ayudarte mejor.', 'advertencia');
      return;
    }
    const payload = { asunto: this.nuevoTicket.asunto, descripcion: this.nuevoTicket.descripcion, modulo_origen: this.router.url };
    this.http.post(`${environment.apiUrl}/tickets`, payload).subscribe({
      next: (res: any) => {
        this.mostrarNotificacion('¡Ticket Enviado!', 'Hemos recibido tu reporte. Lo revisaremos a la brevedad posible.', 'exito');
        this.nuevoTicket = { asunto: '', descripcion: '' }; 
        this.toggleBot(); 
      },
      error: (err) => {
        this.mostrarNotificacion('Error de Envío', 'Hubo un error al enviar el ticket. Revisa tu conexión e intenta de nuevo.', 'error');
        console.error('Error al enviar ticket:', err);
      }
    });
  }
}