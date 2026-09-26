import { test, expect } from '@playwright/test';
import e2eSettings from './e2e-settings.json';
import { PRODUCTS_URL } from '../src/app/app-paths';
import { BFF_LOGIN_URL } from '../src/auth/auth-contract';
import { BENEFIT_CARD_ID_PREFIX } from '../src/home/home-ids';

test.describe('Home page', () => {
  test('renders the hero heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#home-heading')).toBeVisible();
  });

  test('shows the independently pinned number of benefit cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(`[id^="${BENEFIT_CARD_ID_PREFIX}"]`)).toHaveCount(e2eSettings.independentlyPinnedBenefitCardCount);
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
    const loginRequest = page.waitForRequest(request => new URL(request.url()).pathname === BFF_LOGIN_URL);

    await page.goto(PRODUCTS_URL);

    await loginRequest;
  });
});
