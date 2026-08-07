import { test, expect } from '@playwright/test';

/**
 * Home page — runs with the authenticated session from auth.setup.ts.
 * The unauthenticated state is tested separately by clearing storage.
 */
test.describe('Home page', () => {
  test('shows the hero headline', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your Complete Product Inventory');
  });

  test('shows six benefit cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card')).toHaveCount(6);
  });

  test('shows "View My Products" CTA when authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'View My Products' })).toBeVisible();
  });

  test('nav menu shows username when authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /log in/i })).not.toBeVisible();
  });
});

test.describe('Home page (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows login CTA when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible();
  });

  test('navigating to /products redirects to BFF login', async ({ page }) => {
    await page.goto('/products');
    await expect(page).toHaveURL(/bff\/login/);
  });
});
