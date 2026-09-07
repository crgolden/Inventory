import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { catchError, EMPTY, switchMap, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { InventoryItemView } from './inventory-item.model';
import { ProductService } from './product.service';

export const productResolver: ResolveFn<InventoryItemView> = route => {
  const productService = inject(ProductService);
  const router = inject(Router);
  const id = route.paramMap.get('id');

  if (id === null) {
    void router.navigate(['/products/not-found']);
    return EMPTY;
  }

  return productService.getById(id).pipe(
    switchMap(item => {
      if (item === null) {
        void router.navigate(['/products/not-found']);
        return EMPTY;
      }

      return of(item);
    }),
    catchError((err: HttpErrorResponse) => {
      if (err.status === 404) {
        void router.navigate(['/products/not-found']);
      } else {
        void router.navigate(['/products']);
      }

      return EMPTY;
    })
  );
};
