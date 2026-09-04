import { hasPrefix, isVisible, pickFromPrefix, prefixLocator, type WalkerAction } from '@crgolden/modules/synthetic-walker';
import { expect, type Locator, type Page } from '@playwright/test';

const RENDER_TIMEOUT_MS = 30_000;

async function expectRendered(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: RENDER_TIMEOUT_MS });
}

export const SYNTHETIC_PRODUCT_PREFIX = 'Synthetic Walker Product';

const SYNTHETIC_BRAND = 'Synthetic';
const SWEEP_ITERATION_LIMIT = 50;
const SWEEP_SETTLE_TIMEOUT_MS = 10_000;
const MAX_SYNTHETIC_PRICE = 500;
const MAX_SYNTHETIC_BRAND_SUFFIX = 100;

export async function sweepSyntheticProducts(page: Page): Promise<void> {
  await page.goto('/products');
  await expect(page.locator('#products-heading')).toBeVisible();
  const searchBox = page.locator('#product-search');
  if (!(await searchBox.isVisible())) {
    return;
  }
  await searchBox.fill(SYNTHETIC_PRODUCT_PREFIX);
  for (let iteration = 0; iteration < SWEEP_ITERATION_LIMIT; iteration += 1) {
    try {
      await expect(page.locator('#product-name-0')).toContainText(SYNTHETIC_PRODUCT_PREFIX, { timeout: SWEEP_SETTLE_TIMEOUT_MS });
    } catch {
      return;
    }
    const rows = prefixLocator(page, 'product-row-');
    const rowCount = await rows.count();
    await page.locator('#delete-product-0').click();
    await page.locator('#confirm-delete-product-0').click();
    await expect(rows).toHaveCount(rowCount - 1, { timeout: RENDER_TIMEOUT_MS });
  }
  throw new Error(`Sweep did not converge after ${SWEEP_ITERATION_LIMIT} deletions of "${SYNTHETIC_PRODUCT_PREFIX}" rows.`);
}

async function showOnlyProductNamed(page: Page, name: string): Promise<void> {
  await page.goto('/products');
  await page.locator('#product-search').fill(name);
  await expect(page.locator('#product-name-0')).toHaveText(name, { timeout: RENDER_TIMEOUT_MS });
}

export function createInventoryActions(seed: number): readonly WalkerAction[] {
  const createdNames: string[] = [];
  let createdSequence = 0;
  return [
    {
      name: 'go home',
      weight: 1,
      available: () => Promise.resolve(true),
      run: async page => {
        await page.goto('/');
        await expectRendered(page.locator('#home-heading'));
      },
    },
    {
      name: 'browse the catalog',
      weight: 3,
      available: () => Promise.resolve(true),
      run: async page => {
        await page.goto('/catalog');
        await expectRendered(page.locator('#catalog-heading'));
      },
    },
    {
      name: 'open a catalog item',
      weight: 2,
      available: async page => (await isVisible(page, '#catalog-heading')) && (await hasPrefix(page, 'view-product-')),
      run: async (page, rng) => {
        const viewLink = await pickFromPrefix(page, rng, 'view-product-');
        await viewLink.click();
        await expectRendered(page.locator('#catalog-detail-heading'));
      },
    },
    {
      name: 'browse my products',
      weight: 3,
      available: () => Promise.resolve(true),
      run: async page => {
        await page.goto('/products');
        await expectRendered(page.locator('#products-heading'));
      },
    },
    {
      name: 'view a product detail',
      weight: 2,
      available: async page => (await isVisible(page, '#products-heading')) && (await hasPrefix(page, 'view-product-')),
      run: async (page, rng) => {
        const viewLink = await pickFromPrefix(page, rng, 'view-product-');
        await viewLink.click();
        await expectRendered(page.locator('#product-detail-heading'));
      },
    },
    {
      name: 'create a synthetic product',
      weight: 2,
      available: () => Promise.resolve(true),
      run: async (page, rng) => {
        createdSequence += 1;
        const name = `${SYNTHETIC_PRODUCT_PREFIX} ${seed}-${createdSequence}`;
        await page.goto('/products/new');
        await page.locator('#name').fill(name);
        await page.locator('#brand').fill(SYNTHETIC_BRAND);
        await page.locator('#price').fill(String(1 + rng.int(MAX_SYNTHETIC_PRICE - 1)));
        await page.locator('#product-form-submit').click();
        await page.waitForURL(/\/products\/[^/]+$/);
        await expect(page.locator('#product-detail-heading')).toHaveText(name, { timeout: RENDER_TIMEOUT_MS });
        createdNames.push(name);
      },
    },
    {
      name: 'edit a synthetic product',
      weight: 2,
      available: () => Promise.resolve(createdNames.length > 0),
      run: async (page, rng) => {
        const name = rng.pick(createdNames);
        await showOnlyProductNamed(page, name);
        await page.locator('#view-product-0').click();
        await expectRendered(page.locator('#product-detail-heading'));
        await page.locator('#edit-product-link').click();
        await expect(page).toHaveURL(/\/products\/.+\/edit$/);
        await page.locator('#brand').fill(`${SYNTHETIC_BRAND} ${1 + rng.int(MAX_SYNTHETIC_BRAND_SUFFIX - 1)}`);
        await page.locator('#product-form-submit').click();
        await page.waitForURL(url => !url.pathname.endsWith('/edit'));
      },
    },
    {
      name: 'delete a synthetic product',
      weight: 2,
      available: () => Promise.resolve(createdNames.length > 0),
      run: async (page, rng) => {
        const index = rng.int(createdNames.length);
        const [name] = createdNames.splice(index, 1);
        await showOnlyProductNamed(page, name);
        await page.locator('#delete-product-0').click();
        await page.locator('#confirm-delete-product-0').click();
        await expect(prefixLocator(page, 'product-row-')).toHaveCount(0, { timeout: RENDER_TIMEOUT_MS });
      },
    },
  ];
}
