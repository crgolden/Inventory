export const PRODUCT_ROW_ID_PREFIX = 'product-row-';

const PRODUCT_NAME_ID_PREFIX = 'product-name-';

const EDIT_PRODUCT_ID_PREFIX = 'edit-product-';

const DELETE_PRODUCT_ID_PREFIX = 'delete-product-';

const CONFIRM_DELETE_PRODUCT_ID_PREFIX = 'confirm-delete-product-';

export function productRowId(index: number): string {
  return `${PRODUCT_ROW_ID_PREFIX}${index}`;
}

export function productNameId(index: number): string {
  return `${PRODUCT_NAME_ID_PREFIX}${index}`;
}

export function editProductId(index: number): string {
  return `${EDIT_PRODUCT_ID_PREFIX}${index}`;
}

export function deleteProductId(index: number): string {
  return `${DELETE_PRODUCT_ID_PREFIX}${index}`;
}

export function confirmDeleteProductId(index: number): string {
  return `${CONFIRM_DELETE_PRODUCT_ID_PREFIX}${index}`;
}
