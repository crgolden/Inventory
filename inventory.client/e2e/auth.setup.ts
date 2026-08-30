import { test as setup, expect } from '@playwright/test';
import path from 'node:path';

const authFile = path.join(import.meta.dirname, '.auth/user.json');

setup('authenticate through the BFF and save the session cookie', async ({ page }) => {
  const username = process.env['E2E_USERNAME'];
  const password = process.env['E2E_PASSWORD'];

  if (!username || !password) {
    throw new Error('E2E_USERNAME and E2E_PASSWORD environment variables must be set');
  }

  await page.goto('/bff/login?returnUrl=/');

  await page.locator('#Input_Email').fill(username);
  await page.locator('#Input_Password').fill(password);
  await page.locator('#login-submit').click();

  await page.waitForURL('https://localhost:50212/**');
  await expect(page).toHaveURL(/^https:\/\/localhost:50212/);

  const response = await page.request.get('/bff/user');
  expect(response.ok(), 'the BFF did not accept the session cookie the login flow just produced').toBeTruthy();

  await page.context().storageState({ path: authFile });
});
