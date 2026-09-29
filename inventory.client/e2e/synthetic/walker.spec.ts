import { loginWithPasskey, resolveSeed, resolveStepBudget, toCredentialSlot, walk } from '@crgolden/modules/synthetic-walker';
import { expect, test, type Page } from '@playwright/test';
import { createInventoryActions, sweepSyntheticProducts } from './actions';
import walkerSettings from './walker-settings.json';
import { ChromiumConsoleMessages } from '../chromium-constants';
import { DuendeBffPaths, DuendeBffQueryParameters } from '../duende-bff-constants';
import { CATALOG_URL, PRODUCTS_URL } from '../../src/app/app-paths';
import { BFF_LOGIN_URL, SILENT_LOGIN_PROMPT } from '../../src/auth/auth-contract';

function awaitSilentLoginOutcome(page: Page): Promise<string | null> {
  const callbackServed = page
    .waitForResponse(response => new URL(response.url()).pathname === DuendeBffPaths.silentLoginCallback)
    .then(() => null);
  const frameRefused = page
    .waitForEvent(
      'console',
      message => message.type() === 'error' && message.text().includes(ChromiumConsoleMessages.frameRefusalPrefix),
    )
    .then(message => message.text());
  return Promise.race([callbackServed, frameRefused]);
}

async function expectTheSilentLoginFrameToPostItsOutcome(page: Page, outcome: Promise<string | null>): Promise<void> {
  expect(await outcome, 'the browser refused the silent-login frame, so the check could never finish').toBeNull();
  await expect(page.locator('#bff-silent-login')).toHaveCount(0);
}

async function expectSilentLoginToComplete(page: Page): Promise<void> {
  const outcome = awaitSilentLoginOutcome(page);
  await page.goto(CATALOG_URL);
  await expect(page.locator('#catalog-heading')).toBeVisible();
  await expectTheSilentLoginFrameToPostItsOutcome(page, outcome);
}

async function expectSilentLoginToRestoreTheSession(page: Page): Promise<void> {
  await page.goto(CATALOG_URL);
  await expect(page.locator('#nav-signout')).toBeVisible();

  const inventoryHost = new URL(page.url()).hostname.replaceAll('.', '\\.');
  await page.context().clearCookies({ domain: new RegExp(`^\\.?${inventoryHost}$`) });
  expect(await page.context().cookies(page.url()), 'the Inventory session cookie survived clearCookies').toEqual([]);

  const outcome = awaitSilentLoginOutcome(page);
  const silentLoginRequest = page.waitForRequest(
    request => request.url().includes(BFF_LOGIN_URL) && request.url().includes(SILENT_LOGIN_PROMPT),
  );
  await page.reload();
  await silentLoginRequest;
  await expectTheSilentLoginFrameToPostItsOutcome(page, outcome);

  await expect(page.locator('#nav-signout'), 'the silent login finished without restoring the session').toBeVisible();
}

test.describe('Synthetic walker', () => {
  test('walks the deployed app with a seeded random journey', async ({ page }, testInfo) => {
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
