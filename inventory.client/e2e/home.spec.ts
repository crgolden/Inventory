import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('shows the hero headline', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#home-heading')).toContainText('Your Complete Product Inventory');
  });

  test('shows six benefit cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[id^="benefit-card-"]')).toHaveCount(6);
  });

  test('shows "View My Products" CTA when authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#my-products-link')).toBeVisible();
  });

  test('hides the hero login CTA when authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#home-login-link')).not.toBeVisible();
  });
});

test.describe('Home page (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows login CTA when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#home-login-link')).toBeVisible();
  });

  test('navigating to /products redirects to BFF login', async ({ page }) => {
    await page.goto('/products');
    await expect(page).toHaveURL(/bff\/login/);
  });
});
