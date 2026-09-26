import { Routes } from '@angular/router';
import { authGuard } from '../auth/auth.guard';
import { AppPaths } from './app-paths';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../home/home.component').then(m => m.HomeComponent),
  },
  {
    path: AppPaths.catalog,
    loadChildren: () =>
      import('../catalog/catalog.routes').then(m => m.catalogRoutes),
  },
  {
    path: AppPaths.products,
    canActivate: [authGuard],
    loadChildren: () =>
      import('../products/products.routes').then(m => m.productRoutes),
  },
  {
    path: AppPaths.userSession,
    loadComponent: () =>
      import('../user-session/user-session.component').then(m => m.UserSessionComponent),
  },
];
