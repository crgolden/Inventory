import { test, expect, Page } from '@playwright/test';

async function showOnlyProductNamed(page: Page, name: string): Promise<void> {
  await page.goto('/products');
  await page.locator('#product-search').fill(name);
  await page.waitForLoadState('networkidle');
}

async function deleteProduct(page: Page, name: string): Promise<void> {
  await showOnlyProductNamed(page, name);
  const deleteBtn = page.locator('#delete-product-0');
  if (await deleteBtn.isVisible()) {
    await deleteBtn.click();
    await page.locator('#confirm-delete-product-0').click();
  }
}

test.describe('Products', () => {
  test('product list loads and shows the table', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('#products-table')).toBeVisible();
  });

  test('navigating to /products/new shows the create form', async ({ page }) => {
    await page.goto('/products/new');
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#product-form-submit')).toBeVisible();
  });

  test('create form submit button is disabled when name is empty', async ({ page }) => {
    await page.goto('/products/new');
    await expect(page.locator('#product-form-submit')).toBeDisabled();
  });

  test('create form submit button enables when name is filled', async ({ page }) => {
    await page.goto('/products/new');
    await page.locator('#name').fill('Test Product');
    await expect(page.locator('#product-form-submit')).toBeEnabled();
  });

  test.describe('with a created product', () => {
    let productName: string;

    test.beforeEach(async ({ page }) => {
      productName = `E2E Product ${Date.now()}`;
      await page.goto('/products/new');
      await page.locator('#name').fill(productName);
      await page.locator('#product-form-submit').click();
      await page.waitForURL(/\/products\/[^/]+$/);
    });

    test.afterEach(async ({ page }) => {
      await deleteProduct(page, productName);
    });

    test('created product appears in the list', async ({ page }) => {
      await showOnlyProductNamed(page, productName);
      await expect(page.locator('#product-name-0')).toHaveText(productName);
    });

    test('inline delete confirmation appears on Delete click', async ({ page }) => {
      await showOnlyProductNamed(page, productName);
      await page.locator('#delete-product-0').click();
      await expect(page.locator('#confirm-delete-product-0')).toBeVisible();
    });

    test('product detail page shows product name', async ({ page }) => {
      await showOnlyProductNamed(page, productName);
      await page.locator('#view-product-0').click();
      await expect(page.locator('#product-detail-heading')).toHaveText(productName);
      await expect(page.locator('#edit-product-link')).toBeVisible();
    });

    test('"Find Manual" navigates to the edit form (which embeds the manual finder)', async ({ page }) => {
      await showOnlyProductNamed(page, productName);
      await page.locator('#view-product-0').click();
      await page.locator('#edit-product-link').click();
      await expect(page).toHaveURL(/\/products\/.+\/edit$/);
      await expect(page.locator('#manual-chat-toggle')).toBeVisible();
    });
  });
});
