import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import buildQuery from 'odata-query';
import { CatalogProduct } from './catalog-product.model';
import { ODATA_COUNT, ODataCountResponse } from '../odata';
import { CATALOG_ODATA_URL, CatalogSortColumn, nameContainsFilter } from './catalog-api';
import { CatalogSortDirection } from './catalog-sort-directions';

export interface CatalogParams {
  search?: string;
  orderBy: CatalogSortColumn;
  orderDir: CatalogSortDirection;
  page: number;
  pageSize: number;
}

export interface CatalogPage {
  items: CatalogProduct[];
  total: number;
}

interface ApiCatalogProduct {
  Id: string;
  Name: string | null;
  Brand: string | null;
  ModelNumber: string | null;
  Category: string | null;
  ManualUrl: string | null;
  MsrpPrice: number | null;
  CreatedAt: string;
  UpdatedAt: string | null;
}

function fromApi(raw: ApiCatalogProduct): CatalogProduct {
  return {
    id: raw.Id,
    name: raw.Name,
    brand: raw.Brand,
    modelNumber: raw.ModelNumber,
    category: raw.Category,
    manualUrl: raw.ManualUrl,
    msrpPrice: raw.MsrpPrice,
    createdAt: raw.CreatedAt,
    updatedAt: raw.UpdatedAt,
  };
}

@Injectable({ providedIn: 'root' })
export class CatalogService {

  private readonly http = inject(HttpClient);

  getAll(params: CatalogParams): Observable<CatalogPage> {
    const term = params.search?.trim();
    const filter = term ? nameContainsFilter(term) : undefined;
    const skip = (params.page - 1) * params.pageSize;
    const qs = buildQuery({
      filter,
      orderBy: `${params.orderBy} ${params.orderDir}`,
      top: params.pageSize,
      skip,
      count: true,
    });
    return this.http
      .get<ODataCountResponse<ApiCatalogProduct>>(`${CATALOG_ODATA_URL}${qs}`)
      .pipe(map(r => ({ items: r.value.map(fromApi), total: r[ODATA_COUNT] ?? 0 })));
  }

  getById(id: string): Observable<CatalogProduct> {
    return this.http.get<ApiCatalogProduct>(`${CATALOG_ODATA_URL}(${id})`).pipe(map(fromApi));
  }
}
