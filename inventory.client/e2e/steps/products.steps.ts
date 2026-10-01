import { expect } from '@playwright/test';
import { newId } from '@crgolden/modules/testing';
import { createProduct, newProduct } from '../ci-products';
import { productIdFromDetailPage, showOnlyProduct } from '../product-list';
import { CSRF_HEADERS } from '../product-sweep';
import { AppPaths, NEW_PRODUCT_URL, PRODUCTS_NOT_FOUND_URL, PRODUCTS_URL } from '../../src/app/app-paths';
import { PRODUCT_ROW_ID_PREFIX, confirmDeleteProductId, deleteProductId } from '../../src/product-row-ids';
import { INVENTORY_ITEMS_URL } from '../../src/products/products-api';
import { viewProductId } from '../../src/view-product-ids';
import { Given, Then, When } from './fixtures';

const NO_ROWS = 0;

Given('I own a product', async ({ page, ctx }) => {
  ctx.ownedProduct = await createProduct(page);
});

Given('I own no products', async ({ page }) => {
  const listed = await page.request.get(INVENTORY_ITEMS_URL, { headers: CSRF_HEADERS });
  expect(listed.ok(), `listing the account's products answered ${listed.status()}`).toBe(true);
  expect(await listed.json(), 'the account still owns products the run-start sweep should have removed').toEqual([]);
});

Given('I am adding a product', async ({ page }) => {
  await page.goto(NEW_PRODUCT_URL);
  await expect(page.locator('#name')).toBeVisible();
  await expect(page.locator('#product-form-submit')).toBeVisible();
});

Given('a product that does not exist', ({ ctx }) => {
  ctx.absentId = newId();
});

When('I open my products', async ({ page }) => {
  await page.goto(PRODUCTS_URL);
});

When('I save a new product', async ({ page, ctx }) => {
  const product = newProduct();
  await page.locator('#name').fill(product.name);
  await page.locator('#brand').fill(product.brand);
  await page.locator('#modelNumber').fill(product.modelNumber);
  await page.locator('#product-form-submit').click();
  ctx.ownedProduct = { id: await productIdFromDetailPage(page), name: product.name };
});

When('I view that product from my list', async ({ page, ctx }) => {
  await showOnlyProduct(page, ctx.ownedProduct);
  await page.locator(`#${viewProductId(0)}`).click();
});

When('I rename that product', async ({ page, ctx }) => {
  const product = ctx.ownedProduct;
  const renamed = newProduct();
  await page.goto(`${PRODUCTS_URL}/${product.id}/${AppPaths.edit}`);
  const nameInput = page.locator('#name');
  await nameInput.clear();
  await nameInput.fill(renamed.name);
  await page.locator('#product-form-submit').click();
  ctx.ownedProduct = { id: product.id, name: renamed.name };
});

When('I delete that product from my list', async ({ page, ctx }) => {
  await showOnlyProduct(page, ctx.ownedProduct);
  await page.locator(`#${deleteProductId(0)}`).click();
  await page.locator(`#${confirmDeleteProductId(0)}`).click();
});

When('I open that product', async ({ page, ctx }) => {
  await page.goto(`${PRODUCTS_URL}/${ctx.absentId}`);
});

When("I choose to find that product's manual", async ({ page, ctx }) => {
  await showOnlyProduct(page, ctx.ownedProduct);
  await page.locator(`#${viewProductId(0)}`).click();
  await page.locator('#edit-product-link').click();
});

Then('I see that product in my list', async ({ page, ctx }) => {
  await showOnlyProduct(page, ctx.ownedProduct);
  await expect(page.locator('#products-table')).toBeVisible();
});

Then('I see that product in my list under its new name', async ({ page, ctx }) => {
  await showOnlyProduct(page, ctx.ownedProduct);
});

Then('I am told I have no products', async ({ page }) => {
  await expect(page.locator('#products-empty-state')).toBeVisible();
  await expect(page.locator('#products-table')).toHaveCount(NO_ROWS);
});

Then("I see that product's page", async ({ page, ctx }) => {
  const product = ctx.ownedProduct;
  await expect(page).toHaveURL(new RegExp(`${PRODUCTS_URL}/${product.id}$`));
  await expect(page.locator('#product-detail-heading')).toHaveAttribute('data-product-id', product.id);
  await expect(page.locator('#edit-product-link')).toBeVisible();
});

Then('that product is no longer in my list', async ({ page, ctx }) => {
  await expect(page.locator(`[id^="${PRODUCT_ROW_ID_PREFIX}"]`)).toHaveCount(NO_ROWS);
  await expect(page.locator('#products-empty-state')).toBeVisible();
  ctx.forgetOwnedProduct();
});

Then('I am told the product was not found', async ({ page }) => {
  await expect(page.locator('#product-not-found-heading')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${PRODUCTS_NOT_FOUND_URL}$`));
});

Then("I see the manual finder beside that product's details", async ({ page, ctx }) => {
  await expect(page).toHaveURL(new RegExp(`${PRODUCTS_URL}/${ctx.ownedProduct.id}/${AppPaths.edit}$`));
  await expect(page.locator('#manual-chat-toggle')).toBeVisible();
});
