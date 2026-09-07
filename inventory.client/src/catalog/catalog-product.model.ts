export interface CatalogProduct {
  id: string;
  name: string | null;
  brand: string | null;
  modelNumber: string | null;
  category: string | null;
  manualUrl: string | null;
  msrpPrice: number | null;
  createdAt: string;
  updatedAt: string | null;
}
