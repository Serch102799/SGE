import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environments';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-recuperados',
  standalone: false,
  templateUrl: './recuperados.component.html',
  styleUrls: ['./recuperados.component.css']
})
export class RecuperadosComponent implements OnInit {
  apiUrl = `${environment.apiUrl}/recuperados`;
  
  // ==========================================
  // ESTADOS Y VISTAS
  // ==========================================
  vistaActual: 'kanban' | 'tabla' = 'kanban';
  todasLasPiezas: any[] = []; // El respaldo de la BD original
  piezasFiltradas: any[] = []; // Lo que se muestra en pantalla

  // Filtros de búsqueda
  textoBusqueda: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';

  // Paginación de Tabla
  paginaActual: number = 1;
  itemsPorPagina: number = 10;

  // Listas del Kanban
  yonque: any[] = [];
  enReparacion: any[] = [];
  disponibles: any[] = [];
  instaladas: any[] = [];

  // ==========================================
  // CATÁLOGOS Y AUTOCOMPLETES
  // ==========================================
  refacciones: any[] = []; autobuses: any[] = []; proveedores: any[] = [];
  refaccionControl = new FormControl('');
  autobusOrigenControl = new FormControl('');
  autobusDestinoControl = new FormControl('');
  proveedorControl = new FormControl('');

  filteredRefacciones$!: Observable<any[]>;
  filteredAutobusesOrigen$!: Observable<any[]>;
  filteredAutobusesDestino$!: Observable<any[]>;
  filteredProveedores$!: Observable<any[]>;

  modalActivo: string = ''; 
  piezaSeleccionada: any = null;
  formData: any = {};
  isSaving = false;

  mostrarModalNotificacion = false;
  notificacion = { titulo: '', mensaje: '', tipo: 'advertencia' };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarPiezas();
    this.cargarCatalogos();
  }

  // --- CARGA DE DATOS ORIGINAL (Igual que antes) ---
  cargarCatalogos() {
    this.http.get<any>(`${environment.apiUrl}/refacciones`).subscribe({
      next: (res) => {
        this.refacciones = Array.isArray(res) ? res : (res.data || []);
        this.filteredRefacciones$ = this.refaccionControl.valueChanges.pipe(
          startWith(''), map((value: any) => typeof value === 'string' ? value : value?.nombre),
          map(name => name ? this._filterRefacciones(name) : this.refacciones.slice())
        );
      }
    });

    this.http.get<any>(`${environment.apiUrl}/autobuses`).subscribe({
      next: (res) => {
        this.autobuses = Array.isArray(res) ? res : (res.data || []);
        this.filteredAutobusesOrigen$ = this.autobusOrigenControl.valueChanges.pipe(
          startWith(''), map((value: any) => typeof value === 'string' ? value : value?.economico),
          map(name => name ? this._filterAutobuses(name) : this.autobuses.slice())
        );
        this.filteredAutobusesDestino$ = this.autobusDestinoControl.valueChanges.pipe(
          startWith(''), map((value: any) => typeof value === 'string' ? value : value?.economico),
          map(name => name ? this._filterAutobuses(name) : this.autobuses.slice())
        );
      }
    });

    this.http.get<any>(`${environment.apiUrl}/proveedores`).subscribe({
      next: (res) => {
        this.proveedores = Array.isArray(res) ? res : (res.data || []);
        this.filteredProveedores$ = this.proveedorControl.valueChanges.pipe(
          startWith(''), map((value: any) => typeof value === 'string' ? value : value?.nombre_proveedor),
          map(name => name ? this._filterProveedores(name) : this.proveedores.slice())
        );
      }
    });
  }

  // Lógica de filtrado inteligente (Ordenado por precisión)
  private _filterRefacciones(name: string): any[] {
    const filterValue = name.toLowerCase().trim();

    // 1. Obtener todas las que contengan la palabra
    let coincidencias = this.refacciones.filter(option => 
      option.nombre.toLowerCase().includes(filterValue) || 
      (option.numero_parte && option.numero_parte.toLowerCase().includes(filterValue))
    );

    return coincidencias.sort((a, b) => {
      const nombreA = a.nombre.toLowerCase();
      const nombreB = b.nombre.toLowerCase();
      if (nombreA === filterValue) return -1;
      if (nombreB === filterValue) return 1;

      const empiezaConA = nombreA.startsWith(filterValue);
      const empiezaConB = nombreB.startsWith(filterValue);
      if (empiezaConA && !empiezaConB) return -1;
      if (!empiezaConA && empiezaConB) return 1;

      return nombreA.localeCompare(nombreB);
    });
  }
  private _filterAutobuses(name: string): any[] { return this.autobuses.filter(o => o.economico.toLowerCase().includes(name.toLowerCase())); }
  private _filterProveedores(name: string): any[] { return this.proveedores.filter(o => o.nombre_proveedor.toLowerCase().includes(name.toLowerCase())); }

  displayRefaccion(refaccion: any): string { return refaccion ? `${refaccion.numero_parte || 'S/N'} - ${refaccion.nombre}` : ''; }
  displayAutobus(autobus: any): string { return autobus ? autobus.economico : ''; }
  displayProveedor(proveedor: any): string { return proveedor ? proveedor.nombre_proveedor : ''; }

  onRefaccionSelected(event: MatAutocompleteSelectedEvent) { this.formData.id_refaccion = event.option.value.id_refaccion; }
  onAutobusOrigenSelected(event: MatAutocompleteSelectedEvent) { this.formData.id_autobus_origen = event.option.value.id_autobus; }
  onAutobusDestinoSelected(event: MatAutocompleteSelectedEvent) { this.formData.id_autobus_destino = event.option.value.id_autobus; }
  onProveedorSelected(event: MatAutocompleteSelectedEvent) { this.formData.id_proveedor_reparacion = event.option.value.id_proveedor; }

  // ==========================================
  // LÓGICA DE FILTRADO, PAGINACIÓN Y TABLERO
  // ==========================================
  cargarPiezas() {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.todasLasPiezas = data;
        this.aplicarFiltros(); // En lugar de distribuir directo, primero filtramos
      },
      error: () => this.mostrarNotificacion('Error', 'No se pudieron cargar las piezas', 'error')
    });
  }

  aplicarFiltros() {
    let filtrado = this.todasLasPiezas;

    // Filtro por texto (Busca en nombre, autobus o proveedor)
    if (this.textoBusqueda) {
      const termino = this.textoBusqueda.toLowerCase();
      filtrado = filtrado.filter(p => 
        (p.nombre_pieza && p.nombre_pieza.toLowerCase().includes(termino)) ||
        (p.origen_economico && p.origen_economico.toLowerCase().includes(termino)) ||
        (p.proveedor_nombre && p.proveedor_nombre.toLowerCase().includes(termino))
      );
    }

    // Filtro por Fechas (Usamos la fecha_baja como referencia principal)
    if (this.fechaInicio) {
      filtrado = filtrado.filter(p => new Date(p.fecha_baja) >= new Date(this.fechaInicio));
    }
    if (this.fechaFin) {
      const fin = new Date(this.fechaFin);
      fin.setHours(23, 59, 59); // Cubrir todo el último día
      filtrado = filtrado.filter(p => new Date(p.fecha_baja) <= fin);
    }

    this.piezasFiltradas = filtrado;
    this.distribuirKanban();
    this.paginaActual = 1; // Reseteamos la página al buscar
  }

  limpiarFiltros() {
    this.textoBusqueda = ''; this.fechaInicio = ''; this.fechaFin = '';
    this.aplicarFiltros();
  }

  distribuirKanban() {
    this.yonque = []; this.enReparacion = []; this.disponibles = []; this.instaladas = [];
    this.piezasFiltradas.forEach(pieza => {
      if (pieza.estado === 'Yonque') this.yonque.push(pieza);
      else if (pieza.estado === 'En Reparación') this.enReparacion.push(pieza);
      else if (pieza.estado === 'Disponible') this.disponibles.push(pieza);
      else if (pieza.estado === 'Instalada') this.instaladas.push(pieza);
    });
  }

  // Getters para la paginación de la tabla
  get piezasPaginadas() {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.piezasFiltradas.slice(inicio, inicio + this.itemsPorPagina);
  }
  
  get totalPaginas() { return Math.ceil(this.piezasFiltradas.length / this.itemsPorPagina); }
  cambiarPagina(delta: number) {
    const nueva = this.paginaActual + delta;
    if (nueva >= 1 && nueva <= this.totalPaginas) this.paginaActual = nueva;
  }

  // ==========================================
  // EXPORTACIONES BÁSICAS
  // ==========================================
  exportarCSV() {
    const encabezados = "ID,Pieza,Estado,Costo Reparacion,Origen,Destino,Proveedor\n";
    const filas = this.piezasFiltradas.map(p => 
      `${p.id_pieza_recuperada},"${p.nombre_pieza}","${p.estado}",${p.costo_reparacion || 0},"${p.origen_economico || 'N/A'}","${p.destino_economico || 'N/A'}","${p.proveedor_nombre || 'N/A'}"`
    ).join("\n");
    
    const blob = new Blob([encabezados + filas], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Recuperados_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  }

  exportarPDF() {
    // 1. Crear el documento
    const doc = new jsPDF('p', 'mm', 'letter');
    
    // 2. Encabezado del Documento
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42); // Azul muy oscuro
    doc.text('Reporte de Cascos y Piezas Recuperadas', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 14, 30);

    // Si hay filtros activos, lo indicamos en el PDF
    if (this.textoBusqueda || this.fechaInicio || this.fechaFin) {
      doc.text(`* Reporte filtrado por criterios de búsqueda.`, 14, 36);
    }

    // 3. Preparar los datos para la tabla (¡AÑADIMOS DESTINO AQUÍ!)
    const datosTabla = this.piezasFiltradas.map(p => [
      `#${p.id_pieza_recuperada}`,
      p.nombre_pieza,
      p.estado,
      p.origen_economico || 'N/A',
      p.destino_economico || 'N/A', // <--- Nueva columna de Destino
      p.proveedor_nombre || 'N/A',
      `$${p.costo_reparacion || 0}`
    ]);

    // 4. Dibujar la tabla
    autoTable(doc, {
      startY: 42, 
      // ¡AÑADIMOS "Destino" A LAS CABECERAS!
      head: [['ID', 'Pieza / Componente', 'Estado', 'Origen', 'Destino', 'Taller/Proveedor', 'Costo']],
      body: datosTabla,
      theme: 'grid',
      headStyles: { 
        fillColor: [68, 128, 211], 
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 247, 250] }, 
      margin: { top: 40, left: 14, right: 14 }
    });

    // 5. Descargar el archivo
    const nombreArchivo = `Reporte_Recuperados_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(nombreArchivo);
    
    this.mostrarNotificacion('¡Listo!', 'El PDF se ha descargado correctamente.', 'exito');
  }

  // --- MODALES Y GUARDADO (Igual que antes) ---
  abrirModal(tipo: string, pieza: any = null) {
    this.modalActivo = tipo; this.piezaSeleccionada = pieza; this.formData = {}; 
    this.refaccionControl.setValue(''); this.autobusOrigenControl.setValue('');
    this.autobusDestinoControl.setValue(''); this.proveedorControl.setValue('');
  }
  cerrarModal() { this.modalActivo = ''; this.piezaSeleccionada = null; }

  guardarIngreso() {
    this.isSaving = true;
    this.http.post(this.apiUrl, this.formData).subscribe({
      next: () => { this.cerrarModal(); this.cargarPiezas(); this.isSaving = false; },
      error: () => { this.isSaving = false; }
    });
  }

  avanzarEstado(nuevoEstado: string) {
    this.isSaving = true;
    const payload = { estado: nuevoEstado, ...this.formData };
    this.http.put(`${this.apiUrl}/${this.piezaSeleccionada.id_pieza_recuperada}`, payload).subscribe({
      next: () => { this.cerrarModal(); this.cargarPiezas(); this.isSaving = false; },
      error: () => { this.isSaving = false; }
    });
  }

  mostrarNotificacion(titulo: string, mensaje: string, tipo: string) {
    this.notificacion = { titulo, mensaje, tipo }; this.mostrarModalNotificacion = true;
  }
  cerrarModalNotificacion() { this.mostrarModalNotificacion = false; }
}