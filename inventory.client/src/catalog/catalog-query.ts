import { Params } from '@angular/router';
import { CatalogSortColumn, CatalogSortColumns } from './catalog-api';
import { CatalogSortDirection, CatalogSortDirections } from './catalog-sort-directions';

export { CATALOG_PAGE_SIZE } from './catalog-page-size';

export const DEFAULT_CATALOG_SORT: CatalogSortColumn = CatalogSortColumns.name;

const SORT_COLUMNS: ReadonlySet<string> = new Set<CatalogSortColumn>(Object.values(CatalogSortColumns));

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

export function catalogOrderDirFrom(params: Params): CatalogSortDirection {
  return params['orderDir'] === CatalogSortDirections.desc ? CatalogSortDirections.desc : CatalogSortDirections.asc;
}

export function catalogPageFrom(params: Params): number {
  const requested = Number(params['page']);
  return Number.isInteger(requested) && requested > 0 ? requested : 1;
}
