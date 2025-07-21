import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
// No necesitas importar DashboardComponent aquí si se carga vía AdminModule

const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },
  {
    path: 'auth', // Aquí se carga tu AuthModule (que contiene el login)
    loadChildren: () =>
      import('./auth/auth.module').then((m) => m.AuthModule),
  },
  {
    path: 'admin', // Aquí se carga tu AdminModule
    loadChildren: () =>
      import('./admin/admin.module').then((m) => m.AdminModule),
    // Aquí es donde podrías poner un AuthGuard para proteger toda la sección /admin
    // canLoad: [AuthGuard]
  },
  {
    path: '**', // Si la ruta no coincide con ninguna, redirige al login
    redirectTo: 'auth/login',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}