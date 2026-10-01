import type { Params } from '@angular/router';

export const PRODUCT_SEARCH_PARAM = 'q';

export function productSearchFrom(params: Params): string {
  const value: unknown = params[PRODUCT_SEARCH_PARAM];
  return typeof value === 'string' ? value : '';
}
