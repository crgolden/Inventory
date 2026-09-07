import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { InventoryItemView } from './inventory-item.model';
import { ProductService } from './product.service';

export const productListResolver: ResolveFn<InventoryItemView[]> = () => inject(ProductService).getAll();
