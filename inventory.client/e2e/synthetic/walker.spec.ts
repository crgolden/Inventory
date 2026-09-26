import { loginWithPasskey, resolveSeed, resolveStepBudget, toCredentialSlot, walk } from '@crgolden/modules/synthetic-walker';
import { expect, test, type Page } from '@playwright/test';
import { createInventoryActions, sweepSyntheticProducts } from './actions';
import walkerSettings from './walker-settings.json';
import { ChromiumConsoleMessages } from '../chromium-constants';
import { DuendeBffQueryParameters } from '../duende-bff-constants';
import { CATALOG_URL, PRODUCTS_URL } from '../../src/app/app-paths';
import { BFF_LOGIN_URL, SILENT_LOGIN_PROMPT } from '../../src/auth/auth-contract';

const walkerBaseUrl = process.env['WalkerBaseUrl']?.replace(/\/$/, '');

function collectFrameRefusals(page: Page): string[] {
  const refusals: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes(ChromiumConsoleMessages.frameRefusalPrefix)) {
      refusals.push(message.text());
    }
  });
  return refusals;
}

async function expectSilentLoginToComplete(page: Page): Promise<void> {
  const refusals = collectFrameRefusals(page);
  await page.goto(CATALOG_URL);
  await expect(page.locator('#catalog-heading')).toBeVisible();
  await expect
    .poll(async () => refusals.length > 0 || (await page.locator('#bff-silent-login').count()) === 0, {
      message: 'the silent-login iframe neither posted its outcome nor was refused',
    })
    .toBe(true);
  expect(refusals, 'the browser refused the silent-login frame, so the check could never finish').toEqual([]);
  await expect(page.locator('#bff-silent-login')).toHaveCount(0);
}

async function expectSilentLoginToRestoreTheSession(page: Page): Promise<void> {
  await page.goto(CATALOG_URL);
  await expect(page.locator('#nav-signout')).toBeVisible();

  const inventoryHost = new URL(page.url()).hostname.replaceAll('.', '\\.');
  await page.context().clearCookies({ domain: new RegExp(`^\\.?${inventoryHost}$`) });
  expect(await page.context().cookies(page.url()), 'the Inventory session cookie survived clearCookies').toEqual([]);

  const refusals = collectFrameRefusals(page);
  const silentLoginRequest = page.waitForRequest(
    request => request.url().includes(BFF_LOGIN_URL) && request.url().includes(SILENT_LOGIN_PROMPT),
  );
  await page.reload();
  await silentLoginRequest;

  await expect(page.locator('#nav-signout')).toBeVisible();
  expect(refusals, 'the browser refused the silent-login frame, so the session could not be restored').toEqual([]);
}

test.describe('Synthetic walker', () => {
  test('walks the deployed app with a seeded random journey', async ({ page }, testInfo) => {
    test.skip(!walkerBaseUrl, 'Synthetic walks target the deployed app only; set WalkerBaseUrl to run.');
    const seed = resolveSeed();
    const steps = resolveStepBudget(walkerSettings.stepBudget);
    await expectSilentLoginToComplete(page);
    await loginWithPasskey(page, {
      slot: toCredentialSlot(walkerSettings.passkeySlot),
      loginPath: BFF_LOGIN_URL,
      returnParam: DuendeBffQueryParameters.returnUrl,
      returnPath: PRODUCTS_URL,
    });
    await expectSilentLoginToRestoreTheSession(page);
    await sweepSyntheticProducts(page);
    try {
      const result = await walk(page, createInventoryActions(seed), { seed, steps, testInfo });
      expect(result.executedSteps).toBe(steps);
    } finally {
      await sweepSyntheticProducts(page);
    }
  });
});
