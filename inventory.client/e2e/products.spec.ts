import { test, expect } from '@playwright/test';
import { createProduct, deleteProductThroughTheList, newProduct } from './ci-products';
import { productIdFromDetailPage, showOnlyProduct, type ListedProduct } from './product-list';
import { NEW_PRODUCT_URL, PRODUCTS_NOT_FOUND_URL, PRODUCTS_URL } from '../src/app/app-paths';
import { viewProductId } from '../src/view-product-ids';
import { PRODUCT_ROW_ID_PREFIX, confirmDeleteProductId, deleteProductId } from '../src/product-row-ids';
import { newId } from '@crgolden/modules/testing';

const NO_ROWS = 0;

test.describe('Products', () => {
  test('product list loads and shows the table', async ({ page }) => {
    const product = await createProduct(page);

    await page.goto(PRODUCTS_URL);
    await expect(page.locator('#products-table')).toBeVisible();

    await deleteProductThroughTheList(page, product);
  });

  test('an empty product list shows the empty state instead of a table', async ({ page }) => {
    await page.goto(PRODUCTS_URL);

    await expect(page.locator('#products-empty-state')).toBeVisible();
    await expect(page.locator('#products-table')).toHaveCount(NO_ROWS);
  });

  test('navigating to /products/new shows the create form', async ({ page }) => {
    await page.goto(NEW_PRODUCT_URL);
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#product-form-submit')).toBeVisible();
  });

  test('create form submit button is disabled when name is empty', async ({ page }) => {
    await page.goto(NEW_PRODUCT_URL);
    await expect(page.locator('#product-form-submit')).toBeDisabled();
  });

  test('create form submit button enables when every required field is filled', async ({ page }) => {
    const product = newProduct();
    await page.goto(NEW_PRODUCT_URL);
    await page.locator('#name').fill(product.name);
    await page.locator('#brand').fill(product.brand);
    await page.locator('#modelNumber').fill(product.modelNumber);
    await expect(page.locator('#product-form-submit')).toBeEnabled();
  });

  test('an unknown product id lands on the product not-found page', async ({ page }) => {
    await page.goto(`${PRODUCTS_URL}/${newId()}`);

    await expect(page.locator('#product-not-found-heading')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${PRODUCTS_NOT_FOUND_URL}$`));
  });

  test('editing the name updates the product and returns to its detail page', async ({ page }) => {
    const product = await createProduct(page);
    const renamed = newProduct();

    await page.goto(`/products/${product.id}/edit`);
    const nameInput = page.locator('#name');
    await nameInput.clear();
    await nameInput.fill(renamed.name);
    await page.locator('#product-form-submit').click();

    await expect(page).toHaveURL(new RegExp(`/products/${product.id}$`));
    await expect(page.locator('#product-detail-heading')).toHaveAttribute('data-product-id', product.id);

    await deleteProductThroughTheList(page, { id: product.id, name: renamed.name });
  });

  test('confirming a delete removes the row from the list', async ({ page }) => {
    const product = await createProduct(page);

    await showOnlyProduct(page, product);

    await page.locator(`#${deleteProductId(0)}`).click();
    await page.locator(`#${confirmDeleteProductId(0)}`).click();

    await expect(page.locator(`[id^="${PRODUCT_ROW_ID_PREFIX}"]`)).toHaveCount(NO_ROWS);
    await expect(page.locator('#products-empty-state')).toBeVisible();
  });

  test.describe('with a created product', () => {
    let created: ListedProduct;

    test.beforeEach(async ({ page }) => {
      const product = newProduct();
      await page.goto(NEW_PRODUCT_URL);
      await page.locator('#name').fill(product.name);
      await page.locator('#brand').fill(product.brand);
      await page.locator('#modelNumber').fill(product.modelNumber);
      await page.locator('#product-form-submit').click();
      created = { id: await productIdFromDetailPage(page), name: product.name };
    });

    test.afterEach(async ({ page }) => {
      await deleteProductThroughTheList(page, created);
    });

    test('created product appears in the list', async ({ page }) => {
      await showOnlyProduct(page, created);
    });

    test('inline delete confirmation appears on Delete click', async ({ page }) => {
      await showOnlyProduct(page, created);
      await page.locator(`#${deleteProductId(0)}`).click();
      await expect(page.locator(`#${confirmDeleteProductId(0)}`)).toBeVisible();
    });

    test('product detail page shows the product', async ({ page }) => {
      await showOnlyProduct(page, created);
      await page.locator(`#${viewProductId(0)}`).click();
      await expect(page.locator('#product-detail-heading')).toHaveAttribute('data-product-id', created.id);
      await expect(page.locator('#edit-product-link')).toBeVisible();
    });

    test('"Find Manual" navigates to the edit form (which embeds the manual finder)', async ({ page }) => {
      await showOnlyProduct(page, created);
      await page.locator(`#${viewProductId(0)}`).click();
      await page.locator('#edit-product-link').click();
      await expect(page).toHaveURL(/\/products\/.+\/edit$/);
      await expect(page.locator('#manual-chat-toggle')).toBeVisible();
    });
  });
});
