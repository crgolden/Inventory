import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { catchError, EMPTY, switchMap, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { PRODUCTS_NOT_FOUND_URL, PRODUCTS_URL, ROUTE_ID_PARAMETER } from '../app/app-paths';
import { InventoryItemView } from './inventory-item.model';
import { ProductService } from './product.service';

export const productResolver: ResolveFn<InventoryItemView> = route => {
  const productService = inject(ProductService);
  const router = inject(Router);
  const id = route.paramMap.get(ROUTE_ID_PARAMETER);

  if (id === null) {
    void router.navigate([PRODUCTS_NOT_FOUND_URL]);
    return EMPTY;
  }

  return productService.getById(id).pipe(
    switchMap(item => {
      if (item === null) {
        void router.navigate([PRODUCTS_NOT_FOUND_URL]);
        return EMPTY;
      }

      return of(item);
    }),
    catchError((err: HttpErrorResponse) => {
      if (err.status === 404) {
        void router.navigate([PRODUCTS_NOT_FOUND_URL]);
      } else {
        void router.navigate([PRODUCTS_URL]);
      }

      return EMPTY;
    })
  );
};
