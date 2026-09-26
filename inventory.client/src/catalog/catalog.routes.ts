import { Routes } from '@angular/router';
import { AppPaths, ROUTE_ID_PARAMETER } from '../app/app-paths';
import { catalogResolver } from './catalog.resolver';
import { catalogListResolver } from './catalog-list.resolver';

export const catalogRoutes: Routes = [
  {
    path: '',
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    resolve: { catalog: catalogListResolver },
    loadComponent: () =>
      import('./catalog-list/catalog-list.component').then(m => m.CatalogListComponent),
  },
  {
    path: AppPaths.notFound,
    loadComponent: () =>
      import('./catalog-not-found/catalog-not-found.component').then(m => m.CatalogNotFoundComponent),
  },
  {
    path: `:${ROUTE_ID_PARAMETER}`,
    resolve: { product: catalogResolver },
    loadComponent: () =>
      import('./catalog-detail/catalog-detail.component').then(m => m.CatalogDetailComponent),
  },
];
