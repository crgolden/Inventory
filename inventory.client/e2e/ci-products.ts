import { expect, type Page } from '@playwright/test';
import { newDisplayName, newText } from '@crgolden/modules/testing';
import { CSRF_HEADERS } from './product-sweep';
import { showOnlyProduct, type ListedProduct } from './product-list';
import { INVENTORY_ITEMS_URL } from '../src/products/products-api';
import { PRODUCT_ROW_ID_PREFIX, confirmDeleteProductId, deleteProductId } from '../src/product-row-ids';

const NO_ROWS = 0;

export interface NewProduct {
  readonly name: string;
  readonly brand: string;
  readonly modelNumber: string;
}

export function newProduct(): NewProduct {
  return {
    name: newDisplayName(),
    brand: newDisplayName(),
    modelNumber: newText(),
  };
}

export async function deleteProductThroughTheList(page: Page, product: ListedProduct): Promise<void> {
  await showOnlyProduct(page, product);
  await page.locator(`#${deleteProductId(0)}`).click();
  await page.locator(`#${confirmDeleteProductId(0)}`).click();
  await expect(page.locator(`[id^="${PRODUCT_ROW_ID_PREFIX}"]`)).toHaveCount(NO_ROWS);
}

export interface CreatedProduct extends NewProduct {
  readonly id: string;
  readonly catalogProductId: string;
}

export async function createProduct(page: Page): Promise<CreatedProduct> {
  const product = newProduct();
  const created = await page.request.post(INVENTORY_ITEMS_URL, {
    headers: CSRF_HEADERS,
    data: { name: product.name, brand: product.brand, modelNumber: product.modelNumber },
  });
  if (!created.ok()) {
    throw new Error(
      `Could not seed ${product.name}: ${created.status()} from ${INVENTORY_ITEMS_URL}. ` +
        'A spec that cannot seed its own row would otherwise assert against whatever the shared store already held.',
    );
  }
  const body = (await created.json()) as { id?: string; catalogProductId?: string };
  if (body.id === undefined || body.catalogProductId === undefined) {
    throw new Error(
      `Seeding ${product.name} returned neither an id nor a catalogProductId, so nothing can address the row it made.`,
    );
  }
  return { ...product, id: body.id, catalogProductId: body.catalogProductId };
}
