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
import { RegistroCargaCombustibleComponent } from './pages/registro-carga-combustible/registro-carga-combustible.component';
import { OperadoresComponent } from './pages/operadores/operadores.component';
import { RutasComponent } from './pages/rutas/rutas.component';
import { TanquesComponent } from './pages/tanques/tanques.component';
import { HistorialCombustibleComponent } from './pages/historial-combustible/historial-combustible.component';
import { EdicionDetallesComponent } from './pages/edicion-detalles/edicion-detalles.component';
import { ProductosCompuestosComponent } from './pages/productos-compuestos/productos-compuestos.component';
import { RegistroProduccionComponent } from './pages/registro-produccion/registro-produccion.component';
import { RendimientosComponent } from './pages/rendimientos/rendimientos.component';
import { AjusteInventarioComponent } from './pages/ajuste-inventario/ajuste-inventario.component';
import { ConteoInventarioComponent } from './pages/conteo-inventario/conteo-inventario.component';
import { AdminPanelComponent } from './pages/admin-panel/admin-panel.component';

const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    canActivate: [AuthGuard],
    children: [

      {
        path: 'refacciones',
        component: RefaccionesComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista', 'SuperUsuario'] }
      },
      {
        path: 'entradas',
        component: EntradasComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista', 'SuperUsuario'] }
      },
      {
        path: 'registro-entrada',
        component: RegistroEntradaComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista', 'SuperUsuario'] }
      },
      {
        path: 'salidas',
        component: SalidasComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista', 'SuperUsuario'] }
      },
      {
        path: 'registro-salida',
        component: RegistroSalidaComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista', 'SuperUsuario'] }
      },
      {
        path: 'usuarios',
        component: UsuariosComponent,
        canActivate: [RoleGuard],
        data: { roles: ['SuperUsuario', 'Admin'] }
      },
      {
        path: 'proveedores',
        component: ProveedoresComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'SuperUsuario'] }
      },
      {
        path: 'autobuses',
        component: AutobusesComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'SuperUsuario'] }
      },
      /* {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      }, */
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
        data: { roles: ['Admin', 'SuperUsuario', 'Almacenista', 'AdminDiesel'] }
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
        path: 'registro-carga-combustible',
        component: RegistroCargaCombustibleComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'SuperUsuario', 'AdminDiesel'] }
      },
      {
        path: 'operadores',
        component: OperadoresComponent,
        canActivate: [RoleGuard],
        data: { roles: ['SuperUsuario', 'Admin'] }
      },
      {
        path: 'rutas',
        component: RutasComponent,
        canActivate: [RoleGuard],
        data: { roles: ['SuperUsuario', 'AdminDiesel', 'Admin'] }
      },
      {
        path: 'tanques',
        component: TanquesComponent,
        canActivate: [RoleGuard],
        data: { roles: ['SuperUsuario', 'AdminDiesel', 'Admin'] }
      },
      {
        path: 'historial-combustible',
        component: HistorialCombustibleComponent,
        canActivate: [RoleGuard],
        data: { roles: ['SuperUsuario', 'AdminDiesel', 'Admin'] }
      },
      {
        path: 'superadmin',
        component: SuperadminPanelComponent,
        canActivate: [AuthGuard], 
        data: { roles: ['SuperUsuario'] } 
      },
      {
        path: 'edicion-detalles',
        component: EdicionDetallesComponent,
        canActivate: [AuthGuard], 
        data: { roles: ['SuperUsuario'] } 
      },
      {
        path: 'productos-compuestos',
        component: ProductosCompuestosComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista', 'SuperUsuario'] }
      },
      {
        path: 'registro-produccion',
        component: RegistroProduccionComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista', 'SuperUsuario'] }
      },
      {
        path: 'rendimientos',
        component: RendimientosComponent,
        canActivate: [AuthGuard], 
        data: { roles: ['SuperUsuario'] } 
      },
      {
        path: 'admin-panel',
        component: AdminPanelComponent,
        canActivate: [AuthGuard], 
        data: { roles: ['SuperUsuario'] } 
      },
      {
        path: 'conteo-inventario',
        component: ConteoInventarioComponent,
        canActivate: [AuthGuard], 
        data: { roles: ['SuperUsuario'] } 
      },
      {
        path: 'ajuste-inventario',
        component: AjusteInventarioComponent,
        canActivate: [AuthGuard], 
        data: { roles: ['SuperUsuario'] } 
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [RoleGuard],
        data: { roles: ['Admin', 'Almacenista', 'SuperUsuario'] }
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule { }