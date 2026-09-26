import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  AddToInventoryRequest,
  CatalogProductEdit,
  InventoryItemEdit,
  InventoryItemView,
} from './inventory-item.model';
import {
  AUTHORIZED_CATALOG_ODATA_URL,
  INVENTORY_ITEMS_URL,
  INVENTORY_ODATA_URL,
  SEARCH_PARAMETER,
} from './products-api';

@Injectable({ providedIn: 'root' })
export class ProductService {

  private readonly http = inject(HttpClient);

  getAll(search?: string): Observable<InventoryItemView[]> {
    const term = search?.trim();
    const params = term ? new HttpParams().set(SEARCH_PARAMETER, term) : new HttpParams();
    return this.http.get<InventoryItemView[]>(INVENTORY_ITEMS_URL, { params });
  }

  getById(id: string): Observable<InventoryItemView | null> {
    return this.http
      .get<InventoryItemView[]>(INVENTORY_ITEMS_URL)
      .pipe(map(items => items.find(item => item.id === id) ?? null));
  }

  create(request: AddToInventoryRequest): Observable<string | null> {
    return this.http
      .post<InventoryItemView>(INVENTORY_ITEMS_URL, request, { observe: 'response' })
      .pipe(map(response => response.body?.id ?? null));
  }

  patch(id: string, changes: Partial<InventoryItemEdit>): Observable<void> {
    return this.http.patch<void>(`${INVENTORY_ODATA_URL}(${id})`, changes);
  }

  patchCatalogProduct(
    catalogProductId: string,
    changes: Partial<CatalogProductEdit>
  ): Observable<void> {
    return this.http.patch<void>(`${AUTHORIZED_CATALOG_ODATA_URL}(${catalogProductId})`, changes);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${INVENTORY_ODATA_URL}(${id})`);
  }
}
