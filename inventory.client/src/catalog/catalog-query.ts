import { Params } from '@angular/router';
import { CatalogSortColumn } from './catalog.service';

export const CATALOG_PAGE_SIZE = 20;

export const DEFAULT_CATALOG_SORT: CatalogSortColumn = 'Name';

const SORT_COLUMNS: ReadonlySet<string> = new Set<CatalogSortColumn>([
  'Name',
  'Brand',
  'Category',
  'MsrpPrice',
]);

export function catalogSearchFrom(params: Params): string {
  const value: unknown = params['q'];
  return typeof value === 'string' ? value : '';
}

export function catalogOrderByFrom(params: Params): CatalogSortColumn {
  const value: unknown = params['orderBy'];
  return typeof value === 'string' && SORT_COLUMNS.has(value)
    ? (value as CatalogSortColumn)
    : DEFAULT_CATALOG_SORT;
}

export function catalogOrderDirFrom(params: Params): 'asc' | 'desc' {
  return params['orderDir'] === 'desc' ? 'desc' : 'asc';
}

export function catalogPageFrom(params: Params): number {
  const requested = Number(params['page']);
  return Number.isInteger(requested) && requested > 0 ? requested : 1;
}
