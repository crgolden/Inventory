import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  AddToInventoryRequest,
  CatalogProductEdit,
  InventoryItemEdit,
  InventoryItemView,
} from './inventory-item.model';

const INVENTORY_BASE = '/products/api/inventory/items';
const ODATA_BASE = '/products/api/odata/InventoryItems';
const CATALOG_ODATA_BASE = '/products/api/odata/CatalogProducts';

@Injectable({ providedIn: 'root' })
export class ProductService {

  private readonly http = inject(HttpClient);

  getAll(search?: string): Observable<InventoryItemView[]> {
    const term = search?.trim();
    const params = term ? new HttpParams().set('search', term) : new HttpParams();
    return this.http.get<InventoryItemView[]>(INVENTORY_BASE, { params });
  }

  getById(id: string): Observable<InventoryItemView | null> {
    return this.http
      .get<InventoryItemView[]>(INVENTORY_BASE)
      .pipe(map(items => items.find(item => item.id === id) ?? null));
  }

  create(request: AddToInventoryRequest): Observable<string | null> {
    return this.http
      .post<InventoryItemView>(INVENTORY_BASE, request, { observe: 'response' })
      .pipe(map(response => response.body?.id ?? null));
  }

  patch(id: string, changes: Partial<InventoryItemEdit>): Observable<void> {
    return this.http.patch<void>(`${ODATA_BASE}(${id})`, changes);
  }

  patchCatalogProduct(
    catalogProductId: string,
    changes: Partial<CatalogProductEdit>
  ): Observable<void> {
    return this.http.patch<void>(`${CATALOG_ODATA_BASE}(${catalogProductId})`, changes);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${ODATA_BASE}(${id})`);
  }
}
