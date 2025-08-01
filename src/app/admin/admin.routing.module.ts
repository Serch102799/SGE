import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Guards
import { AuthGuard } from '../guards/guard.guard';
import { RoleGuard } from '../guards/role.guard';

// Componentes
import { AdminComponent } from './admin.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { UsuariosComponent } from './pages/usuarios/usuarios.component';
import { RefaccionesComponent } from './pages/refacciones/refacciones.component';
import { EntradasComponent } from './pages/entradas/entradas.component';
import { RegistroEntradaComponent } from './pages/registro-entrada/registro-entrada.component';
import { SalidasComponent } from './pages/salidas/salidas.component';
import { RegistroSalidaComponent } from './pages/registro-salida/registro-salida.component';
import { AutobusesComponent } from './pages/autobuses/autobuses.component';
import { ProveedoresComponent } from './pages/proveedores/proveedores.component';
import { InsumosComponent } from './pages/insumos/insumos.component';
import { EntradasInsumoComponent } from './pages/entradas-insumo/entradas-insumo.component';
import { RegistroEntradaInsumoComponent } from './pages/registro-entrada-insumo/registro-entrada-insumo.component';
import { PerfilComponent } from './pages/perfil/perfil.component';
import { ReportesComponent } from './pages/reportes/reportes.component';

const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista'] }
      },
      {
        path: 'refacciones',
        component: RefaccionesComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin'] }
      },
      {
        path: 'entradas',
        component: EntradasComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista'] }
      },
      {
        path: 'registro-entrada',
        component: RegistroEntradaComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista'] }
      },
      {
        path: 'salidas',
        component: SalidasComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista'] }
      },
      {
        path: 'registro-salida',
        component: RegistroSalidaComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista'] }
      },
      {
        path: 'usuarios',
        component: UsuariosComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin'] }
      },
      {
        path: 'proveedores',
        component: ProveedoresComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin'] }
      },
      {
        path: 'autobuses',
        component: AutobusesComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin'] }
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'insumos',
        component: InsumosComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin'] }
      },
      {
        path: 'entradas-insumo',
        component: EntradasInsumoComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista'] }
      },
      {
        path: 'registro-entrada-insumo',
        component: RegistroEntradaInsumoComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista'] }
      },
      {
        path: 'perfil',
        component: PerfilComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista'] }
      },
      {
        path: 'reportes',
        component: ReportesComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin'] } 
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule { }