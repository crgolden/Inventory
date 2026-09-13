export interface InventoryItemView {
  id: string;
  catalogProductId: string;

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
