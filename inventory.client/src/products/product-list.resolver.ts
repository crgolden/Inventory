import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { InventoryItemView } from './inventory-item.model';
import { ProductService } from './product.service';
import { productSearchFrom } from './product-query';

export const productListResolver: ResolveFn<InventoryItemView[] | null> = (
  route: ActivatedRouteSnapshot,
): Observable<InventoryItemView[] | null> =>
  inject(ProductService)
    .getAll(productSearchFrom(route.queryParams) || undefined)
    .pipe(catchError(() => of(null)));
