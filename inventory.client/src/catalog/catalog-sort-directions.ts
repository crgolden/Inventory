export const CatalogSortDirections = {
  asc: 'asc',
  desc: 'desc',
} as const;

export type CatalogSortDirection = (typeof CatalogSortDirections)[keyof typeof CatalogSortDirections];
