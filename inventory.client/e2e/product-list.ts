import { expect, type Page } from '@playwright/test';
import { PRODUCTS_URL } from '../src/app/app-paths';
import { productRowId } from '../src/product-row-ids';

export interface ListedProduct {
  readonly id: string;
  readonly name: string;
}

export async function showOnlyProduct(page: Page, product: ListedProduct): Promise<void> {
  await page.goto(PRODUCTS_URL);
  await page.locator('#product-search').fill(product.name);
  await expect(page.locator(`#${productRowId(0)}`)).toHaveAttribute('data-product-id', product.id);
}

export async function productIdFromDetailPage(page: Page): Promise<string> {
  const heading = page.locator('#product-detail-heading');
  await expect(heading).toHaveAttribute('data-product-id', /\S/);
  const id = await heading.getAttribute('data-product-id');
  if (id === null) {
    throw new Error(`${page.url()} rendered a detail heading with no product id, so nothing can address the row the form created.`);
  }
  return id;
}
