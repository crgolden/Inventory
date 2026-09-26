import { loginWithPasskey, toCredentialSlot } from '@crgolden/modules/synthetic-walker';
import { test as setup, expect, type Page } from '@playwright/test';
import { newId } from '@crgolden/modules/testing';
import { PRODUCTS_URL } from '../src/app/app-paths';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '../src/app/http-headers';
import { BFF_LOGIN_URL, BFF_USER_PATH } from '../src/auth/auth-contract';
import { DuendeBffQueryParameters } from './duende-bff-constants';
import e2eSettings from './e2e-settings.json';
import { AGAINST_MOCKS, localOrigin } from './mocks/mock-dependencies';

async function loginThroughTheMockProvider(page: Page): Promise<void> {
  await page.context().addCookies([{ name: e2eSettings.mockIdentityCookie, value: newId(), url: localOrigin(e2eSettings.mockOidcPort) }]);
  await page.goto(`${BFF_LOGIN_URL}?${DuendeBffQueryParameters.returnUrl}=${encodeURIComponent(PRODUCTS_URL)}`);
  await expect(page).toHaveURL(new RegExp(`${PRODUCTS_URL}$`));
}

setup('authenticate through the BFF and save the session cookie', async ({ page }) => {
  await (AGAINST_MOCKS
    ? loginThroughTheMockProvider(page)
    : loginWithPasskey(page, {
        slot: toCredentialSlot(e2eSettings.localPasskeySlot),
        loginPath: BFF_LOGIN_URL,
        returnParam: DuendeBffQueryParameters.returnUrl,
        returnPath: PRODUCTS_URL,
      }));

  const response = await page.request.get(`/${BFF_USER_PATH}`, { headers: { [CSRF_HEADER]: CSRF_HEADER_VALUE } });
  expect(response.ok(), `the BFF answered ${response.status()} for the session cookie the login flow just produced`).toBeTruthy();

  await page.context().storageState({ path: e2eSettings.authStateFile });
});
