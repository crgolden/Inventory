import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { InventoryItemView } from './inventory-item.model';
import { ProductService } from './product.service';

export const productListResolver: ResolveFn<InventoryItemView[] | null> = (): Observable<
  InventoryItemView[] | null
> => inject(ProductService).getAll().pipe(catchError(() => of(null)));
