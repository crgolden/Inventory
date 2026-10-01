import { expect, type Page } from '@playwright/test';
import { newId } from '@crgolden/modules/testing';
import { createProduct } from '../ci-products';
import { ScrollBehaviors, ScrollRestorations } from '../dom-constants';
import e2eSettings from '../e2e-settings.json';
import { CATALOG_NOT_FOUND_URL, CATALOG_URL } from '../../src/app/app-paths';
import { catalogRowId } from '../../src/catalog-row-ids';
import { VIEW_PRODUCT_ID_PREFIX, viewProductId } from '../../src/view-product-ids';
import { Given, Then, When } from './fixtures';

const SHORT_VIEWPORT = e2eSettings.shortViewport;
const SCROLL_DISTANCE_PX = e2eSettings.scrollDistancePx;
const WITHIN_FIVE_PIXELS = -1;
const ROUTER_OWNED_SCROLL_RESTORATION = ScrollRestorations.manual;

async function scrollTheReaderDownTheCatalog(page: Page): Promise<number> {
  const readerPosition = await page.evaluate(({ distance, behavior }) => {
    window.scrollBy({ top: distance, behavior });
    return Math.round(window.scrollY);
  }, { distance: SCROLL_DISTANCE_PX, behavior: ScrollBehaviors.instant });
  expect(
    readerPosition,
    'the catalog did not overflow the shortened viewport, so a restored position is indistinguishable from a reset one',
  ).toBeGreaterThan(0);
  return readerPosition;
}

async function clickTheFirstFullyVisibleViewLinkInPage(page: Page): Promise<number> {
  return page.evaluate(idPrefix => {
    const link = [...document.querySelectorAll<HTMLAnchorElement>(`[id^="${idPrefix}"]`)].find(anchor => {
      const box = anchor.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight;
    });
    if (link === undefined) {
      throw new Error('no View link is fully inside the viewport, so nothing can be clicked without moving the page');
    }
    link.click();
    return Math.round(window.scrollY);
  }, VIEW_PRODUCT_ID_PREFIX);
}

Given('the catalog holds a product I added', async ({ page, ctx }) => {
  ctx.catalogProduct = await createProduct(page);
});

Given('a catalog product that does not exist', ({ ctx }) => {
  ctx.absentId = newId();
});

Given('I have scrolled down the catalog', async ({ page, ctx }) => {
  await page.setViewportSize(SHORT_VIEWPORT);
  await page.goto(CATALOG_URL);
  await expect(page.locator(`#${catalogRowId(0)}`)).toBeVisible();
  ctx.readerPosition = await scrollTheReaderDownTheCatalog(page);
});

When('I view that product from the catalog', async ({ page, ctx }) => {
  const product = ctx.catalogProduct;
  await page.goto(`${CATALOG_URL}?q=${encodeURIComponent(product.name)}`);
  await expect(page.locator(`#${catalogRowId(0)}`)).toHaveAttribute('data-catalog-product-id', product.catalogProductId);
  await page.locator(`#${viewProductId(0)}`).click();
});

When('I open that catalog product', async ({ page, ctx }) => {
  await page.goto(`${CATALOG_URL}/${ctx.absentId}`);
});

When('I view a product and go back', async ({ page, ctx }) => {
  const positionWhenLeaving = await clickTheFirstFullyVisibleViewLinkInPage(page);
  expect(
    positionWhenLeaving,
    'the in-page click moved the viewport, so this scenario would measure the driver rather than the app',
  ).toBe(ctx.readerPosition);
  await expect(page.locator('#catalog-detail-heading')).toBeVisible();
  await page.goBack();
});

Then("I see that product's catalog page", async ({ page, ctx }) => {
  const product = ctx.catalogProduct;
  await expect(page.locator('#catalog-detail-heading')).toHaveAttribute('data-catalog-product-id', product.catalogProductId);
  await expect(page).toHaveURL(new RegExp(`${CATALOG_URL}/${product.catalogProductId}$`));
});

Then('I am told the catalog product was not found', async ({ page }) => {
  await expect(page.locator('#catalog-not-found-heading')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${CATALOG_NOT_FOUND_URL}$`));
});

Then('I am where I was in the catalog', async ({ page, ctx }) => {
  const readerPosition = ctx.readerPosition;
  await expect(page.locator('#catalog-table')).toBeVisible();
  expect(
    await page.evaluate(() => window.history.scrollRestoration),
    'after Back the router, not the browser, must own restoration',
  ).toBe(ROUTER_OWNED_SCROLL_RESTORATION);
  await expect
    .poll(() => page.evaluate(() => Math.round(window.scrollY)), {
      message: `Back did not land within five pixels of the reader's ${readerPosition}px`,
    })
    .toBeCloseTo(readerPosition, WITHIN_FIVE_PIXELS);
});
