import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { catchError, EMPTY } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CATALOG_NOT_FOUND_URL, CATALOG_URL, ROUTE_ID_PARAMETER } from '../app/app-paths';
import { CatalogProduct } from './catalog-product.model';
import { CatalogService } from './catalog.service';

export const catalogResolver: ResolveFn<CatalogProduct> = route => {
  const catalogService = inject(CatalogService);
  const router = inject(Router);
  const id = route.paramMap.get(ROUTE_ID_PARAMETER);

  if (id === null) {
    void router.navigate([CATALOG_NOT_FOUND_URL]);
    return EMPTY;
  }

  return catalogService.getById(id).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 404) {
        void router.navigate([CATALOG_NOT_FOUND_URL]);
      } else {
        void router.navigate([CATALOG_URL]);
      }

      return EMPTY;
    })
  );
};
