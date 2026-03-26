import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap } from 'rxjs/operators';
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
  todasLasPiezas: any[] = []; 
  piezasFiltradas: any[] = []; 

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
  autobuses: any[] = []; 
  proveedores: any[] = [];
  
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

    // ==========================================
    // BUSCADOR DINÁMICO DE REFACCIONES (BACKEND)
    // ==========================================
    this.filteredRefacciones$ = this.refaccionControl.valueChanges.pipe(
      startWith(''),
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((value: any) => {
        const term = typeof value === 'string' ? value : value?.nombre;
        
        // Si está vacío o tiene menos de 2 letras, no buscamos
        if (!term || term.length < 2) return of([]);
        
        // Petición directa al backend
        return this.http.get<any[]>(`${environment.apiUrl}/refacciones/buscar`, { params: { term } }).pipe(
          map(res => res.map(item => ({
            id_refaccion: item.id_refaccion,
            nombre: item.nombre,
            numero_parte: item.numero_parte || 'S/N',
            marca: item.marca || 'N/A'
          }))),
          catchError(() => of([]))
        );
      })
    );
  }

  // --- CARGA DE DATOS ORIGINAL ---
  cargarCatalogos() {
    // Autobuses (Se cargan en memoria)
    this.http.get<any>(`${environment.apiUrl}/autobuses`).subscribe({
      next: (res) => {
        this.autobuses = Array.isArray(res) ? res : (res.data || []);
        
        this.filteredAutobusesOrigen$ = this.autobusOrigenControl.valueChanges.pipe(
          startWith(''), 
          map((value: any) => typeof value === 'string' ? value : value?.economico),
          map(name => name ? this._filterAutobuses(name) : this.autobuses.slice())
        );
        
        this.filteredAutobusesDestino$ = this.autobusDestinoControl.valueChanges.pipe(
          startWith(''), 
          map((value: any) => typeof value === 'string' ? value : value?.economico),
          map(name => name ? this._filterAutobuses(name) : this.autobuses.slice())
        );
      }
    });

    // Proveedores (Se cargan en memoria)
    this.http.get<any>(`${environment.apiUrl}/proveedores`).subscribe({
      next: (res) => {
        this.proveedores = Array.isArray(res) ? res : (res.data || []);
        this.filteredProveedores$ = this.proveedorControl.valueChanges.pipe(
          startWith(''), 
          map((value: any) => typeof value === 'string' ? value : value?.nombre_proveedor),
          map(name => name ? this._filterProveedores(name) : this.proveedores.slice())
        );
      }
    });
  }

  private _filterAutobuses(name: string): any[] { 
    return this.autobuses.filter(o => o.economico.toLowerCase().includes(name.toLowerCase())); 
  }
  private _filterProveedores(name: string): any[] { 
    return this.proveedores.filter(o => o.nombre_proveedor.toLowerCase().includes(name.toLowerCase())); 
  }

  // Mostrar el texto correcto en los inputs una vez seleccionados
  displayRefaccion(refaccion: any): string { 
    return refaccion ? `${refaccion.numero_parte} - ${refaccion.nombre}` : ''; 
  }
  displayAutobus(autobus: any): string { 
    return autobus ? autobus.economico : ''; 
  }
  displayProveedor(proveedor: any): string { 
    return proveedor ? proveedor.nombre_proveedor : ''; 
  }

  // Guardar IDs al seleccionar
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
        this.aplicarFiltros(); 
      },
      error: () => this.mostrarNotificacion('Error', 'No se pudieron cargar las piezas', 'error')
    });
  }

  aplicarFiltros() {
    let filtrado = this.todasLasPiezas;

    if (this.textoBusqueda) {
      const termino = this.textoBusqueda.toLowerCase();
      filtrado = filtrado.filter(p => 
        (p.nombre_pieza && p.nombre_pieza.toLowerCase().includes(termino)) ||
        (p.origen_economico && p.origen_economico.toLowerCase().includes(termino)) ||
        (p.proveedor_nombre && p.proveedor_nombre.toLowerCase().includes(termino))
      );
    }

    if (this.fechaInicio) {
      filtrado = filtrado.filter(p => new Date(p.fecha_baja) >= new Date(this.fechaInicio));
    }
    if (this.fechaFin) {
      const fin = new Date(this.fechaFin);
      fin.setHours(23, 59, 59); 
      filtrado = filtrado.filter(p => new Date(p.fecha_baja) <= fin);
    }

    this.piezasFiltradas = filtrado;
    this.distribuirKanban();
    this.paginaActual = 1; 
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
    const doc = new jsPDF('p', 'mm', 'letter');
    
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42); 
    doc.text('Reporte de Cascos y Piezas Recuperadas', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 14, 30);

    if (this.textoBusqueda || this.fechaInicio || this.fechaFin) {
      doc.text(`* Reporte filtrado por criterios de búsqueda.`, 14, 36);
    }

    const datosTabla = this.piezasFiltradas.map(p => [
      `#${p.id_pieza_recuperada}`,
      p.nombre_pieza,
      p.estado,
      p.origen_economico || 'N/A',
      p.destino_economico || 'N/A',
      p.proveedor_nombre || 'N/A',
      `$${p.costo_reparacion || 0}`
    ]);

    autoTable(doc, {
      startY: 42, 
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

    const nombreArchivo = `Reporte_Recuperados_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(nombreArchivo);
    
    this.mostrarNotificacion('¡Listo!', 'El PDF se ha descargado correctamente.', 'exito');
  }

  // --- MODALES Y GUARDADO ---
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