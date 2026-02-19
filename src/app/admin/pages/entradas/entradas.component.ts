import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject, Subscription, forkJoin } from 'rxjs';
import { debounceTime, startWith, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environments';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Interfaz para la lista de entradas
export interface Entrada {
  idEntrada: number;
  idProveedor: number;
  factura_proveedor: string;
  vale_interno: string;
  valor_neto: number;
  observaciones: string;
  recibidoPorID: number;
  fechaEntrada: string;
  nombreProveedor: string;
  nombreEmpleado: string;
  estado?: string; // Nuevo campo para saber si está CANCELADO
}

@Component({
  selector: 'app-entradas',
  standalone: false,
  templateUrl: './entradas.component.html',
  styleUrls: ['./entradas.component.css']
})
export class EntradasComponent implements OnInit, OnDestroy {

  private apiUrl = `${environment.apiUrl}/entradas`;

  // --- Estado de la Tabla ---
  entradas: Entrada[] = [];
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;

  // --- Filtros ---
  terminoBusqueda: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';
  private searchSubject: Subject<void> = new Subject<void>();
  private searchSubscription?: Subscription;

  // --- CANCELACIÓN ---
  mostrarModalCancelar = false;
  entradaACancelar: any = null;
  motivoCancelacion: string = '';
  motivoDetalle: string = '';
  isCanceling = false;
  // --- Modales y Notificaciones ---
  mostrarModalDetalles = false;
  valorNetoEntradaSeleccionada: number = 0;
  detallesSeleccionados: any[] = [];
  entradaSeleccionadaId: number | null = null;

  mostrarModalNotificacion = false;
  notificacion = {
    titulo: 'Aviso',
    mensaje: '',
    tipo: 'advertencia' as 'exito' | 'error' | 'advertencia'
  };

  // --- NUEVO: Estado para Edición Histórica ---
  mostrarModalEdicion = false;
  proveedores: any[] = []; // Para el dropdown del modal
  entradaEdicion: any = {
    id_entrada: 0,
    id_proveedor: null,
    fecha_operacion: '',
    factura_proveedor: '',
    observaciones: '',
    items: [] // { id_detalle, nombre, tipo, cantidad_original, cantidad_nueva, costo_original, costo_nuevo, cantidad_usada }
  };

  constructor(private http: HttpClient, private router: Router, public authService: AuthService) { }

  ngOnInit(): void {
    this.revisarNotificaciones();

    this.searchSubscription = this.searchSubject.pipe(
      startWith(undefined),
      debounceTime(400)
    ).subscribe(() => {
      this.currentPage = 1;
      this.obtenerEntradas();
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  obtenerEntradas() {
    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('limit', this.itemsPerPage.toString())
      .set('search', this.terminoBusqueda.trim());

    if (this.fechaInicio) params = params.set('fechaInicio', this.fechaInicio);
    if (this.fechaFin) params = params.set('fechaFin', this.fechaFin);

    this.http.get<{ total: number, data: any[] }>(this.apiUrl, { params }).subscribe({
      next: (response) => {
        this.entradas = (response.data || []).map(item => ({
          idEntrada: item.id_entrada,
          fechaEntrada: item.fecha_operacion,
          idProveedor: item.id_proveedor,
          nombreProveedor: item.nombre_proveedor,
          factura_proveedor: item.factura_proveedor,
          vale_interno: item.vale_interno,
          recibidoPorID: item.recibido_por_id,
          nombreEmpleado: item.nombre_empleado,
          observaciones: item.observaciones,
          valor_neto: parseFloat(item.valor_neto) || 0,
          estado: item.estado || 'ACTIVO' // Mapear el estado
        }));
        this.totalItems = response.total || 0;
      },
      error: (err) => {
        console.error('Error al obtener las entradas', err);
        this.mostrarNotificacion('Error', 'No se pudo cargar el historial de entradas.', 'error');
        this.entradas = [];
        this.totalItems = 0;
      }
    });
  }

  onFiltroChange(): void {
    this.searchSubject.next();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.obtenerEntradas();
  }

  registrarNuevaEntrada() {
    this.router.navigate(['/admin/registro-entrada']);
  }

  // ==========================================
  // LÓGICA DE DETALLES (SOLO LECTURA)
  // ==========================================
  verDetalles(entrada: Entrada) {
    this.entradaSeleccionadaId = entrada.idEntrada;

    this.http.get<{ detalles: any[], valorNeto: number }>(`${this.apiUrl}/detalles/${entrada.idEntrada}`).subscribe({
      next: (respuesta) => {
        this.detallesSeleccionados = respuesta.detalles;
        this.valorNetoEntradaSeleccionada = respuesta.valorNeto;
        this.mostrarModalDetalles = true;
      },
      error: (err) => this.mostrarNotificacion('Error', 'No se pudieron cargar los detalles.', 'error')
    });
  }

  cerrarModalDetalles() {
    this.mostrarModalDetalles = false;
  }

  cargarProveedores() {
    if (this.proveedores.length > 0) return;
    this.http.get<any[]>(`${environment.apiUrl}/proveedores`).subscribe({
      next: (data) => this.proveedores = data,
      error: (err) => console.error('Error al cargar proveedores', err)
    });
  }

  abrirEdicionHistorica(entrada: Entrada) {
    this.cargarProveedores();

    // Formatear fecha para el input datetime-local (YYYY-MM-DDTHH:mm)
    // Es necesario cortar los segundos y milisegundos para que el input lo lea bien
    const fecha = new Date(entrada.fechaEntrada);
    // Ajuste de zona horaria simple para que no se mueva la hora al editar
    const fechaLocal = new Date(fecha.getTime() - (fecha.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

    // Preparar objeto base
    this.entradaEdicion = {
      id_entrada: entrada.idEntrada,
      id_proveedor: entrada.idProveedor,
      fecha_operacion: fechaLocal,
      factura_proveedor: entrada.factura_proveedor,
      observaciones: entrada.observaciones,
      items: []
    };

    // Obtener items con datos detallados
    this.http.get<{ detalles: any[] }>(`${this.apiUrl}/detalles/${entrada.idEntrada}`).subscribe({
      next: (res) => {
        // Mapeamos la respuesta del backend para el formulario
        this.entradaEdicion.items = res.detalles.map(d => ({
          id_detalle: d.id_detalle_entrada || d.id_detalle,
          id_item: d.id_refaccion || d.id_insumo, // Asegúrate de que tu backend mande estos IDs
          nombre: d.descripcion, // O nombre_item
          tipo: d.tipo_item.toLowerCase(), // 'refaccion' o 'insumo'

          // Valores Originales (referencia)
          cantidad_original: Number(d.cantidad),
          costo_original: Number(d.costo),

          // Valores Editables (Inicialmente iguales)
          cantidad_nueva: Number(d.cantidad),
          costo_nuevo: Number(d.costo),

          // Validaciones de stock (Si el backend no lo manda, asumimos 0 por seguridad visual)
          cantidad_usada: Number(d.cantidad_usada || 0)
        }));
        this.mostrarModalEdicion = true;
      },
      error: (err) => this.mostrarNotificacion('Error', 'No se pudieron cargar los datos para edición.', 'error')
    });
  }
  guardarEdicionHistorica() {
    if (!confirm('¿Confirmas que deseas aplicar estos cambios históricos? El stock actual se verá afectado.')) return;

    this.http.put(`${this.apiUrl}/${this.entradaEdicion.id_entrada}/editar-completo`, this.entradaEdicion).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Entrada actualizada correctamente.', 'exito');
        this.cerrarModalEdicion();
        this.obtenerEntradas(); // Recargar tabla
      },
      error: (err) => {
        console.error(err);
        this.mostrarNotificacion('Error', 'No se pudo actualizar la entrada: ' + (err.error?.message || err.message), 'error');
      }
    });
  }

  cerrarModalEdicion() {
    this.mostrarModalEdicion = false;
    this.entradaEdicion = { items: [] }; // Limpiar
  }
  cancelarEntrada(entrada: Entrada) {
    if (!confirm(`ATENCIÓN: Estás a punto de CANCELAR la entrada #${entrada.idEntrada}. \n\nEsto restará del stock actual todos los items de esta entrada. \nSi algún item ya fue utilizado, la operación fallará. \n\n¿Deseas continuar?`)) {
      return;
    }

    this.http.put(`${this.apiUrl}/${entrada.idEntrada}/cancelar`, {}).subscribe({
      next: () => {
        this.mostrarNotificacion('Éxito', 'Entrada cancelada correctamente.', 'exito');
        this.obtenerEntradas(); // Recargar tabla
      },
      error: (err) => {
        console.error(err);
        this.mostrarNotificacion('Error', 'No se pudo cancelar: ' + (err.error?.message || 'Error desconocido'), 'error');
      }
    });
  }
  abrirModalCancelar(entrada: any) {
    this.entradaACancelar = entrada;
    this.motivoCancelacion = '';
    this.motivoDetalle = '';
    this.mostrarModalCancelar = true;
  }

  cerrarModalCancelar() {
    if (this.isCanceling) return; // No dejar cerrar si está procesando
    this.mostrarModalCancelar = false;
    this.entradaACancelar = null;
  }

  confirmarCancelacion() {
    if (!this.motivoCancelacion) return;

    // Armar el motivo final
    let motivoFinal = this.motivoCancelacion;
    if (this.motivoCancelacion === 'Otro') {
      if (!this.motivoDetalle.trim()) {
        this.mostrarNotificacion('Atención', 'Debes especificar el motivo detallado.', 'advertencia');
        return;
      }
      motivoFinal = `Otro: ${this.motivoDetalle}`;
    }

    this.isCanceling = true; // Activar el spinner y bloquear botones

    // Ajusta 'idEntrada' según cómo se llame tu propiedad (puede ser id_entrada o idEntrada)
    const id = this.entradaACancelar.id_entrada || this.entradaACancelar.idEntrada;

    this.http.put(`${this.apiUrl}/${id}/cancelar`, { motivo: motivoFinal }).subscribe({
      next: (res: any) => {
        this.isCanceling = false;
        this.cerrarModalCancelar();
        this.mostrarNotificacion('Cancelación Exitosa', res.message || 'La entrada y el stock han sido revertidos.', 'exito');
        this.obtenerEntradas(); // Llama a tu método que recarga la tabla
      },
      error: (err) => {
        this.isCanceling = false;
        // Aquí mostraremos el error si el backend detecta que ya se usó el stock
        const mensajeError = err.error?.message || 'Error al intentar cancelar la entrada.';
        this.mostrarNotificacion('Error de Cancelación', mensajeError, 'error');
      }
    });
  }

  // ==========================================
  // EXPORTACIÓN (EXCEL / PDF)
  // ==========================================

  exportarAExcelCompleto() {
    this.mostrarNotificacion('Generando Reporte', 'Recopilando información y detalles...', 'exito');

    let params = new HttpParams()
      .set('page', '1')
      .set('limit', '100000')
      .set('search', this.terminoBusqueda.trim());

    if (this.fechaInicio) params = params.set('fechaInicio', this.fechaInicio);
    if (this.fechaFin) params = params.set('fechaFin', this.fechaFin);

    this.http.get<{ data: any[] }>(this.apiUrl, { params }).pipe(
      switchMap(response => {
        const entradas = response.data || [];

        if (entradas.length === 0) throw new Error('No hay datos para exportar');

        const peticionesDetalles = entradas.map(entrada =>
          this.http.get<{ detalles: any[] }>(`${this.apiUrl}/detalles/${entrada.id_entrada}`).pipe(
            map(res => ({ cabecera: entrada, detalles: res.detalles || [] }))
          )
        );
        return forkJoin(peticionesDetalles);
      })
    ).subscribe({
      next: (dataCompleta) => {
        const filasExcel: any[] = [];
        dataCompleta.forEach(item => {
          const cab = item.cabecera;

          filasExcel.push({
            'ID Entrada': cab.id_entrada,
            'Fecha': new Date(cab.fecha_operacion).toLocaleString(),
            'Proveedor': cab.nombre_proveedor,
            'Documento': cab.factura_proveedor || cab.vale_interno,
            'Recibido Por': cab.nombre_empleado,
            'Estado': cab.estado || 'ACTIVO',
            'Total Entrada': Number(cab.valor_neto),
            'Tipo Item': '', 'Descripción Item': '', 'Cantidad': '', 'Costo Unitario': ''
          });

          item.detalles.forEach(det => {
            filasExcel.push({
              'ID Entrada': '', 'Fecha': '', 'Proveedor': '', 'Documento': '', 'Recibido Por': '', 'Estado': '', 'Total Entrada': '',
              'Tipo Item': det.tipo_item,
              'Descripción Item': det.descripcion,
              'Cantidad': Number(det.cantidad),
              'Costo Unitario': Number(det.costo)
            });
          });
          filasExcel.push({});
        });

        const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(filasExcel);
        const wscols = [{ wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 30 }, { wch: 10 }, { wch: 12 }];
        ws['!cols'] = wscols;

        const wb: XLSX.WorkBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte Detallado');
        const fecha = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Entradas_Detalladas_${fecha}.xlsx`);
        this.mostrarNotificacion('Éxito', 'Reporte descargado correctamente.', 'exito');
      },
      error: (err) => {
        if (err.message === 'No hay datos para exportar') {
          this.mostrarNotificacion('Sin Datos', 'No hay registros con los filtros actuales.', 'advertencia');
        } else {
          this.mostrarNotificacion('Error', 'Error al generar el reporte.', 'error');
        }
      }
    });
  }

  exportarAPDFCompleto() {
    this.mostrarNotificacion('Generando PDF', 'Procesando documentos...', 'exito');

    let params = new HttpParams()
      .set('page', '1').set('limit', '100000').set('search', this.terminoBusqueda.trim());

    if (this.fechaInicio) params = params.set('fechaInicio', this.fechaInicio);
    if (this.fechaFin) params = params.set('fechaFin', this.fechaFin);

    this.http.get<{ data: any[] }>(this.apiUrl, { params }).pipe(
      switchMap(response => {
        const entradas = response.data || [];
        if (entradas.length === 0) throw new Error('No hay datos');
        const peticionesDetalles = entradas.map(entrada =>
          this.http.get<{ detalles: any[] }>(`${this.apiUrl}/detalles/${entrada.id_entrada}`).pipe(
            map(res => ({ cabecera: entrada, detalles: res.detalles || [] }))
          )
        );
        return forkJoin(peticionesDetalles);
      })
    ).subscribe({
      next: (dataCompleta) => {
        const doc = new jsPDF();
        let yPos = 20;

        doc.setFontSize(18);
        doc.text('Reporte de Entradas a Almacén', 14, yPos);
        yPos += 10;
        doc.setFontSize(10);
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, yPos);
        yPos += 15;

        dataCompleta.forEach((item) => {
          const cab = item.cabecera;
          if (yPos > 270) { doc.addPage(); yPos = 20; }

          // Cabecera
          doc.setFillColor(240, 240, 240);
          doc.rect(14, yPos - 5, 182, 18, 'F');

          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(`Entrada #${cab.id_entrada} | ${new Date(cab.fecha_operacion).toLocaleDateString()}`, 16, yPos);
          if (cab.estado === 'CANCELADO') {
            doc.setTextColor(220, 53, 69);
            doc.text('(CANCELADO)', 90, yPos);
            doc.setTextColor(0, 0, 0);
          }

          doc.setFont('helvetica', 'normal');
          doc.text(`Prov: ${cab.nombre_proveedor}`, 16, yPos + 5);
          doc.text(`Doc: ${cab.factura_proveedor || cab.vale_interno || 'S/D'}`, 80, yPos + 5);
          doc.setFont('helvetica', 'bold');
          doc.text(`Total: $${Number(cab.valor_neto).toFixed(2)}`, 165, yPos + 5);

          yPos += 15;

          autoTable(doc, {
            startY: yPos,
            head: [['Tipo', 'Descripción', 'Cant.', 'Costo U.', 'Subtotal']],
            body: item.detalles.map(det => [
              det.tipo_item,
              det.descripcion,
              det.cantidad,
              `$${Number(det.costo).toFixed(2)}`,
              `$${(Number(det.cantidad) * Number(det.costo)).toFixed(2)}`
            ]),
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 1 },
            headStyles: { fillColor: [68, 128, 211], textColor: 255, fontSize: 8 },
            margin: { left: 20 },
            didDrawPage: (data) => { yPos = data.cursor ? data.cursor.y : yPos; }
          });

          yPos = (doc as any).lastAutoTable.finalY + 10;
          doc.setDrawColor(200);
          doc.line(14, yPos - 5, 196, yPos - 5);
        });

        const fecha = new Date().toISOString().slice(0, 10);
        doc.save(`Reporte_Entradas_${fecha}.pdf`);
        this.mostrarNotificacion('Éxito', 'PDF generado correctamente.', 'exito');
      },
      error: (err) => {
        console.error(err);
        this.mostrarNotificacion('Error', 'No se pudo generar el PDF.', 'error');
      }
    });
  }

  // --- Métodos de utilidad ---
  revisarNotificaciones() {
    const notificacionMsg = sessionStorage.getItem('notificacion');
    if (notificacionMsg) {
      this.mostrarNotificacion('Éxito', notificacionMsg, 'exito');
      sessionStorage.removeItem('notificacion');
    }
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: 'exito' | 'error' | 'advertencia' = 'advertencia') {
    this.notificacion = { titulo, mensaje, tipo };
    this.mostrarModalNotificacion = true;
  }

  cerrarModalNotificacion() {
    this.mostrarModalNotificacion = false;
  }
}