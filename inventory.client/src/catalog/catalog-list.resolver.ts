import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { CatalogPage, CatalogService } from './catalog.service';

export const CATALOG_PAGE_SIZE = 20;

export const catalogListResolver: ResolveFn<CatalogPage | null> = (): Observable<CatalogPage | null> =>
  inject(CatalogService)
    .getAll({
      search: undefined,
      orderBy: 'Name',
      orderDir: 'asc',
      page: 1,
      pageSize: CATALOG_PAGE_SIZE,
    })
    .pipe(catchError(() => of(null)));
