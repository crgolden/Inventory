import { Routes } from '@angular/router';
import { AppPaths, ROUTE_ID_PARAMETER } from '../app/app-paths';
import { productResolver } from './product.resolver';
import { productListResolver } from './product-list.resolver';

export const productRoutes: Routes = [
  {
    path: '',
    runGuardsAndResolvers: 'paramsOrQueryParamsChange',
    resolve: { products: productListResolver },
    loadComponent: () =>
      import('./product-list/product-list.component').then(m => m.ProductListComponent),
  },
  {
    path: AppPaths.newProduct,
    loadComponent: () =>
      import('./product-form/product-form.component').then(m => m.ProductFormComponent),
  },
  {
    path: AppPaths.notFound,
    loadComponent: () =>
      import('./product-not-found/product-not-found.component').then(m => m.ProductNotFoundComponent),
  },
  {
    path: `:${ROUTE_ID_PARAMETER}`,
    resolve: { product: productResolver },
    loadComponent: () =>
      import('./product-detail/product-detail.component').then(m => m.ProductDetailComponent),
  },
  {
    path: `:${ROUTE_ID_PARAMETER}/${AppPaths.edit}`,
    resolve: { product: productResolver },
    loadComponent: () =>
      import('./product-form/product-form.component').then(m => m.ProductFormComponent),
  },
];
