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
    } else if (url.includes('refacciones') || url.includes('insumos')) {
      this.ayudaActual = { 
        titulo: 'Inventario de Almacén', 
        icono: 'fa-box-open',
        descripcion: 'Administra el catálogo de piezas o insumos, consulta existencias y mantén el stock óptimo.',
        pasos: [
          'Busca una pieza por nombre o número de parte.',
          'Usa el botón de edición para ajustar el nivel de "Stock Mínimo".',
          'Si el stock baja del mínimo, verás una alerta en el dashboard.'
        ],
        tip: 'Mantén las categorías y ubicaciones (pasillos/anaqueles) actualizados para facilitar los inventarios físicos.' 
      };
    } else if (url.includes('recuperados')) {
      this.ayudaActual = { 
        titulo: 'Piezas Recuperadas', 
        icono: 'fa-recycle',
        descripcion: 'Tablero Kanban para gestionar el flujo de piezas usadas o reparables (Yonque, Reparación, Stock, Instaladas).',
        pasos: [
          'Agrega una pieza al "Yonque" cuando se baje de una unidad.',
          'Envíala a reparar asignando un proveedor.',
          'Recibe la pieza con su factura y costo.',
          'Asígnala a una nueva unidad cuando esté lista.'
        ],
        tip: 'Al recibir la pieza, el costo de reparación se añade automáticamente al valor de tu inventario global.' 
      };
    } else if (url.includes('mantenimiento') || url.includes('taller')) {
      this.ayudaActual = { 
        titulo: 'Agenda de Taller', 
        icono: 'fa-calendar-check',
        descripcion: 'Visualiza y gestiona los servicios preventivos y correctivos de las unidades.',
        pasos: [
          'Revisa las alertas rojas para servicios urgentes o atrasados.',
          'Abre la tarjeta del servicio para surtir los vales de refacciones.',
          'Al finalizar, cierra el servicio y actualiza el kilometraje.'
        ],
        tip: 'Si una unidad reporta una falla grave en el camino, crea un servicio correctivo inmediato desde la vista principal.' 
      };
    } else if (url.includes('dashboard')) {
      this.ayudaActual = { 
        titulo: 'Dashboard Inteligente', 
        icono: 'fa-chart-line',
        descripcion: 'Tu centro de mando global con proyecciones operativas y estados críticos.',
        pasos: [
          'Revisa el "Stock Bajo" y atiende las alertas rojas de mantenimiento.',
          'Observa la "Proyección Operativa" para anticipar compras necesarias.',
          'Filtra por fechas en la sección financiera para auditar gastos.'
        ],
        tip: 'La inteligencia predictiva sugiere compras automáticamente basándose en los servicios agendados para los próximos 30 días.' 
      };
    } else {
      this.ayudaActual = { 
        titulo: 'Asistente Global', 
        icono: 'fa-robot',
        descripcion: 'Navega por las distintas pantallas del sistema. Al entrar a un módulo específico, esta ventana cambiará automáticamente para darte instrucciones paso a paso.',
        tip: '¿Algo falló o tienes una duda grave? Usa la pestaña "Reportar Falla" para enviar un ticket directo a sistemas.'
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