import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Product } from './product.model';
import { ProductService } from './product.service';

export const productListResolver: ResolveFn<Product[]> = () => inject(ProductService).getAll();
