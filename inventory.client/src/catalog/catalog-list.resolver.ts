import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { CatalogPage, CatalogService } from './catalog.service';
import {
  CATALOG_PAGE_SIZE,
  catalogOrderByFrom,
  catalogOrderDirFrom,
  catalogPageFrom,
  catalogSearchFrom,
} from './catalog-query';

export { CATALOG_PAGE_SIZE } from './catalog-query';

export const catalogListResolver: ResolveFn<CatalogPage | null> = (
  route: ActivatedRouteSnapshot,
): Observable<CatalogPage | null> =>
  inject(CatalogService)
    .getAll({
      search: catalogSearchFrom(route.queryParams) || undefined,
      orderBy: catalogOrderByFrom(route.queryParams),
      orderDir: catalogOrderDirFrom(route.queryParams),
      page: catalogPageFrom(route.queryParams),
      pageSize: CATALOG_PAGE_SIZE,
    })
    .pipe(catchError(() => of(null)));
