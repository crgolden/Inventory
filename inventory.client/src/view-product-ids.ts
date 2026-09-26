export const VIEW_PRODUCT_ID_PREFIX = 'view-product-';

export function viewProductId(index: number): string {
  return `${VIEW_PRODUCT_ID_PREFIX}${index}`;
}
