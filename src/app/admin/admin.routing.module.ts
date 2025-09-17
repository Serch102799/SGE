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
import { InventarioInicialComponent } from './pages/inventario-inicial/inventario-inicial.component';
import { SuperadminPanelComponent } from './pages/superadmin-panel/superadmin-panel.component';

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
        data: { roles: ['Admin', 'Almacenista','SuperUsuario'] }
      },
      {
        path: 'refacciones',
        component: RefaccionesComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista','SuperUsuario'] }
      },
      {
        path: 'entradas',
        component: EntradasComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista','SuperUsuario'] }
      },
      {
        path: 'registro-entrada',
        component: RegistroEntradaComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista','SuperUsuario'] }
      },
      {
        path: 'salidas',
        component: SalidasComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista','SuperUsuario'] }
      },
      {
        path: 'registro-salida',
        component: RegistroSalidaComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista','SuperUsuario'] }
      },
      {
        path: 'usuarios',
        component: UsuariosComponent,
        canActivate: [RoleGuard],
        data: { roles: ['SuperUsuario'] }
      },
      {
        path: 'proveedores',
        component: ProveedoresComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin','SuperUsuario'] }
      },
      {
        path: 'autobuses',
        component: AutobusesComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'SuperUsuario'] }
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
        data: { roles: ['Admin', 'SuperUsuario'] }
      },
      {
        path: 'entradas-insumo',
        component: EntradasInsumoComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'SuperUsuario', 'Almacenista'] }
      },
      {
        path: 'registro-entrada-insumo',
        component: RegistroEntradaInsumoComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'SuperUsuario', 'Almacenista'] }
      },
      {
        path: 'perfil',
        component: PerfilComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'SuperUsuario', 'Almacenista'] }
      },
      {
        path: 'reportes',
        component: ReportesComponent,
        canActivate: [RoleGuard],
        data: { roles: ['SuperUsuario'] } 
      },
      {
        path: 'inventario-inicial',
        component: InventarioInicialComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'SuperUsuario'] } 
      },
      {
    path: 'superadmin',
    component: SuperadminPanelComponent,
    canActivate: [AuthGuard], // El guard que ya usas para proteger rutas
    data: { roles: ['SuperUsuario'] } // Especifica que solo este rol puede entrar
  },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule { }