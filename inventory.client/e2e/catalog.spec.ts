import { test, expect, type Page } from '@playwright/test';
import { newId } from '@crgolden/modules/testing';
import { createProduct, deleteProductThroughTheList, type CreatedProduct } from './ci-products';
import { ScrollBehaviors, ScrollRestorations } from './dom-constants';
import e2eSettings from './e2e-settings.json';
import { CATALOG_URL } from '../src/app/app-paths';
import { VIEW_PRODUCT_ID_PREFIX, viewProductId } from '../src/view-product-ids';
import { catalogRowId } from '../src/catalog-row-ids';

const SHORT_VIEWPORT = e2eSettings.shortViewport;
const SCROLL_DISTANCE_PX = e2eSettings.scrollDistancePx;
const WITHIN_FIVE_PIXELS = -1;
const ROUTER_OWNED_SCROLL_RESTORATION = ScrollRestorations.manual;

async function showOnlyCatalogRowFor(page: Page, product: CreatedProduct): Promise<void> {
  await page.goto(`/catalog?q=${encodeURIComponent(product.name)}`);
  await expect(page.locator(`#${catalogRowId(0)}`)).toHaveAttribute('data-catalog-product-id', product.catalogProductId);
}

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

test.describe('Catalog', () => {
  test('View on a catalog row opens that product’s detail page', async ({ page }) => {
    const product = await createProduct(page);

    await showOnlyCatalogRowFor(page, product);
    await page.locator(`#${viewProductId(0)}`).click();

    await expect(page.locator('#catalog-detail-heading')).toHaveAttribute('data-catalog-product-id', product.catalogProductId);
    await expect(page).toHaveURL(new RegExp(`/catalog/${product.catalogProductId}$`));

    await deleteProductThroughTheList(page, product);
  });

  test('an unknown catalog id lands on the catalog not-found page', async ({ page }) => {
    const unknownCatalogProductId = newId();

    await page.goto(`${CATALOG_URL}/${unknownCatalogProductId}`);

    await expect(page.locator('#catalog-not-found-heading')).toBeVisible();
    await expect(page).toHaveURL(/\/catalog\/not-found$/);
  });

  test('Back from a product returns the reader to where they were in the list', async ({ page }) => {
    await page.setViewportSize(SHORT_VIEWPORT);
    await page.goto(CATALOG_URL);
    await expect(page.locator(`#${catalogRowId(0)}`)).toBeVisible();

    const readerPosition = await scrollTheReaderDownTheCatalog(page);
    const positionWhenLeaving = await clickTheFirstFullyVisibleViewLinkInPage(page);
    expect(
      positionWhenLeaving,
      'the in-page click moved the viewport, so this test would measure the driver rather than the app',
    ).toBe(readerPosition);
    await expect(page.locator('#catalog-detail-heading')).toBeVisible();

    await page.goBack();

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
});
