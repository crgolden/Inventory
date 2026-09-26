export const CATALOG_ROW_ID_PREFIX = 'catalog-row-';

const CATALOG_NAME_ID_PREFIX = 'catalog-name-';

export function catalogRowId(index: number): string {
  return `${CATALOG_ROW_ID_PREFIX}${index}`;
}

export function catalogNameId(index: number): string {
  return `${CATALOG_NAME_ID_PREFIX}${index}`;
}
