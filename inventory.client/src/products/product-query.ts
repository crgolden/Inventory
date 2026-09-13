import { Params } from '@angular/router';

export function productSearchFrom(params: Params): string {
  const value: unknown = params['q'];
  return typeof value === 'string' ? value : '';
}
