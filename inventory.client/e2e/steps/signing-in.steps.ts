import { expect, type Page } from '@playwright/test';
import { PRODUCTS_URL } from '../../src/app/app-paths';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '../../src/app/http-headers';
import { BFF_LOGIN_URL, BFF_USER_PATH } from '../../src/auth/auth-contract';
import { Given, Then, When } from './fixtures';

async function bffSessionIsActive(page: Page): Promise<boolean> {
  const response = await page.request.get(`/${BFF_USER_PATH}`, { headers: { [CSRF_HEADER]: CSRF_HEADER_VALUE } });
  return response.ok();
}

Given('I am signed in', async ({ page }) => {
  expect(await bffSessionIsActive(page), 'the saved session no longer signs this browser in to the BFF').toBe(true);
});

Given('I am not signed in', async ({ page }) => {
  expect(await bffSessionIsActive(page), 'this browser carries a BFF session it should not have').toBe(false);
});

When('I open the home page', async ({ page }) => {
  await page.goto('/');
});

When('I try to open my products', async ({ page, ctx }) => {
  ctx.loginRequest = page.waitForRequest((request) => new URL(request.url()).pathname === BFF_LOGIN_URL);
  await page.goto(PRODUCTS_URL);
});

Then('I am offered my products', async ({ page }) => {
  await expect(page.locator('#my-products-link')).toBeVisible();
});

Then('I am not asked to sign in', async ({ page }) => {
  await expect(page.locator('#home-login-link')).not.toBeVisible();
});

Then('I am asked to sign in', async ({ page }) => {
  await expect(page.locator('#home-login-link')).toBeVisible();
});

Then('I am sent to sign in', async ({ ctx }) => {
  expect(new URL((await ctx.loginRequest).url()).pathname).toBe(BFF_LOGIN_URL);
});
