export interface InventoryItemView {
  id: string;
  catalogProductId: string;

  name: string | null;
  brand: string | null;
  modelNumber: string | null;
  category: string | null;
  manualUrl: string | null;

  /** Manufacturer list price from the shared catalog record, not what this owner paid. */
  msrpPrice: number | null;

  serialNumber: string | null;

  /** ISO 8601 datetime string, e.g. `"2024-01-15T00:00:00Z"`. */
  purchaseDate: string | null;

  /** What this owner paid, as opposed to the catalog record's `msrpPrice`. */
  pricePaid: number | null;

  description: string | null;

  createdAt: string;
  updatedAt: string | null;
}

export type InventoryItemEdit = Pick<
  InventoryItemView,
  'serialNumber' | 'purchaseDate' | 'pricePaid' | 'description'
>;

export type CatalogProductEdit = Pick<
  InventoryItemView,
  'name' | 'brand' | 'modelNumber' | 'category' | 'manualUrl' | 'msrpPrice'
>;

export interface AddToInventoryRequest {
  name: string | null;
  brand: string | null;
  modelNumber: string | null;
  category: string | null;
  manualUrl: string | null;
  msrpPrice: number | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  pricePaid: number | null;
  description: string | null;
}
