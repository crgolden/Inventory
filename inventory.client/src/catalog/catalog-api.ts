import { escapeODataLiteral } from '../odata';

export const CATALOG_ODATA_URL = '/catalog/api/odata/CatalogProducts';

export const CatalogSortColumns = {
  name: 'Name',
  brand: 'Brand',
  category: 'Category',
  msrpPrice: 'MsrpPrice',
} as const;

export type CatalogSortColumn = (typeof CatalogSortColumns)[keyof typeof CatalogSortColumns];

export function nameContainsFilter(term: string): string {
  return `contains(tolower(Name), tolower('${escapeODataLiteral(term)}'))`;
}
