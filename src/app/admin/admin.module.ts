// src/app/admin/admin.module.ts

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { AdminComponent } from './admin.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { BaseChartDirective } from 'ng2-charts';
import { UsuariosComponent } from './pages/usuarios/usuarios.component';
import { AdminRoutingModule } from './admin.routing.module';
import { RefaccionesComponent } from './pages/refacciones/refacciones.component';
import { EntradasComponent } from './pages/entradas/entradas.component';
import { RegistroEntradaComponent } from './pages/registro-entrada/registro-entrada.component';
import { SalidasComponent } from './pages/salidas/salidas.component';
import { RegistroSalidaComponent } from './pages/registro-salida/registro-salida.component';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { AutobusesComponent } from './pages/autobuses/autobuses.component';
import { ProveedoresComponent } from './pages/proveedores/proveedores.component';
import { InsumosComponent } from './pages/insumos/insumos.component';
import { EntradasInsumoComponent } from './pages/entradas-insumo/entradas-insumo.component';
import { RegistroEntradaInsumoComponent } from './pages/registro-entrada-insumo/registro-entrada-insumo.component';
import { PerfilComponent } from './pages/perfil/perfil.component';
import { ReportesComponent } from './pages/reportes/reportes.component'; 

@NgModule({
  declarations: [
    AdminComponent,
    DashboardComponent,
    UsuariosComponent,
    RefaccionesComponent,
    EntradasComponent,
    RegistroEntradaComponent,
    SalidasComponent,
    RegistroSalidaComponent,
    AutobusesComponent,
    ProveedoresComponent,
    InsumosComponent,
    EntradasInsumoComponent,
    RegistroEntradaInsumoComponent,
    PerfilComponent,
    ReportesComponent
  ],
  imports: [
    HttpClientModule,
    CommonModule,
    FormsModule,
    BaseChartDirective, 
    ReactiveFormsModule,
    RouterModule,
    AdminRoutingModule,
    
  ],
  providers: [
    provideCharts(withDefaultRegisterables())
  ]
  // Si AdminComponent o DashboardComponent son usados fuera de este módulo, deberías exportarlos
  // exports: [
  //   AdminComponent,
  //   DashboardComponent
  // ]
})
export class AdminModule {}