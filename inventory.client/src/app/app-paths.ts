export const AppPaths = {
  catalog: 'catalog',
  products: 'products',
  userSession: 'user-session',
  notFound: 'not-found',
  newProduct: 'new',
  edit: 'edit',
} as const;

export const ROUTE_ID_PARAMETER = 'id';

export const CATALOG_URL = `/${AppPaths.catalog}`;

export const PRODUCTS_URL = `/${AppPaths.products}`;

export const CATALOG_NOT_FOUND_URL = `${CATALOG_URL}/${AppPaths.notFound}`;

export const PRODUCTS_NOT_FOUND_URL = `${PRODUCTS_URL}/${AppPaths.notFound}`;

export const NEW_PRODUCT_URL = `${PRODUCTS_URL}/${AppPaths.newProduct}`;
