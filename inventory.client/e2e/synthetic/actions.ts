import { hasPrefix, isVisible, pickFromPrefix, prefixLocator, type WalkerAction } from '@crgolden/modules/synthetic-walker';
import { newDisplayName, newText } from '@crgolden/modules/testing';
import { expect, type Locator, type Page } from '@playwright/test';
import walkerSettings from './walker-settings.json';
import { sweepProducts } from '../product-sweep';
import { productIdFromDetailPage, showOnlyProduct, type ListedProduct } from '../product-list';
import { AppPaths, CATALOG_URL, NEW_PRODUCT_URL, PRODUCTS_URL } from '../../src/app/app-paths';
import { VIEW_PRODUCT_ID_PREFIX, viewProductId } from '../../src/view-product-ids';
import { PRODUCT_ROW_ID_PREFIX, confirmDeleteProductId, deleteProductId } from '../../src/product-row-ids';

const ACTION_WEIGHTS: Readonly<Record<string, number | undefined>> = walkerSettings.actionWeights;

function weightOf(actionName: string): number {
  const weight = ACTION_WEIGHTS[actionName];
  if (weight === undefined) {
    throw new Error(`walker-settings.json names no weight for the '${actionName}' action.`);
  }
  return weight;
}

async function expectRendered(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
}

export const SYNTHETIC_PRODUCT_PREFIX = walkerSettings.productNamePrefix;

const SYNTHETIC_MODEL_PREFIX = walkerSettings.modelNumberPrefix;
const SYNTHETIC_PRICE_CEILING = walkerSettings.priceCeiling;
const SYNTHETIC_BRAND_SUFFIX_CEILING = walkerSettings.brandSuffixCeiling;

export async function sweepSyntheticProducts(page: Page): Promise<void> {
  await sweepProducts(page, {
    productNamePrefix: SYNTHETIC_PRODUCT_PREFIX,
    modelNumberPrefix: SYNTHETIC_MODEL_PREFIX,
  });
}

export function createInventoryActions(seed: number): readonly WalkerAction[] {
  const createdProducts: ListedProduct[] = [];
  const runToken = newText();
  const syntheticBrand = newDisplayName();
  let createdSequence = 0;
  const unweightedActions: readonly Omit<WalkerAction, 'weight'>[] = [
    {
      name: 'go home',
      available: () => Promise.resolve(true),
      run: async page => {
        await page.goto('/');
        await expectRendered(page.locator('#home-heading'));
      },
    },
    {
      name: 'browse the catalog',
      available: () => Promise.resolve(true),
      run: async page => {
        await page.goto(CATALOG_URL);
        await expectRendered(page.locator('#catalog-heading'));
      },
    },
    {
      name: 'open a catalog item',
      available: async page => (await isVisible(page, '#catalog-heading')) && (await hasPrefix(page, VIEW_PRODUCT_ID_PREFIX)),
      run: async (page, rng) => {
        const viewLink = await pickFromPrefix(page, rng, VIEW_PRODUCT_ID_PREFIX);
        await viewLink.click();
        await expectRendered(page.locator('#catalog-detail-heading'));
      },
    },
    {
      name: 'browse my products',
      available: () => Promise.resolve(true),
      run: async page => {
        await page.goto(PRODUCTS_URL);
        await expectRendered(page.locator('#products-heading'));
      },
    },
    {
      name: 'view a product detail',
      available: async page => (await isVisible(page, '#products-heading')) && (await hasPrefix(page, VIEW_PRODUCT_ID_PREFIX)),
      run: async (page, rng) => {
        const viewLink = await pickFromPrefix(page, rng, VIEW_PRODUCT_ID_PREFIX);
        await viewLink.click();
        await expectRendered(page.locator('#product-detail-heading'));
      },
    },
    {
      name: 'create a synthetic product',
      available: () => Promise.resolve(true),
      run: async (page, rng) => {
        createdSequence += 1;
        const name = `${SYNTHETIC_PRODUCT_PREFIX} ${seed}-${createdSequence}`;
        await page.goto(NEW_PRODUCT_URL);
        await page.locator('#name').fill(name);
        await page.locator('#brand').fill(syntheticBrand);
        await page.locator('#modelNumber').fill(`${SYNTHETIC_MODEL_PREFIX}-${runToken}-${createdSequence}`);
        await page.locator('#pricePaid').fill(String(1 + rng.int(SYNTHETIC_PRICE_CEILING - 1)));
        await page.locator('#product-form-submit').click();
        const created: ListedProduct = { id: await productIdFromDetailPage(page), name };
        await expect(page.locator('#product-detail-heading')).toHaveAttribute('data-product-id', created.id);
        createdProducts.push(created);
      },
    },
    {
      name: 'edit a synthetic product',
      available: () => Promise.resolve(createdProducts.length > 0),
      run: async (page, rng) => {
        const product = rng.pick(createdProducts);
        await showOnlyProduct(page, product);
        await page.locator(`#${viewProductId(0)}`).click();
        await expectRendered(page.locator('#product-detail-heading'));
        await page.locator('#edit-product-link').click();
        await expect(page).toHaveURL(/\/products\/.+\/edit$/);
        await page.locator('#brand').fill(`${syntheticBrand} ${1 + rng.int(SYNTHETIC_BRAND_SUFFIX_CEILING - 1)}`);
        await page.locator('#product-form-submit').click();
        await expect(page).toHaveURL(url => !url.pathname.endsWith(`/${AppPaths.edit}`));
      },
    },
    {
      name: 'delete a synthetic product',
      available: () => Promise.resolve(createdProducts.length > 0),
      run: async (page, rng) => {
        const index = rng.int(createdProducts.length);
        const [product] = createdProducts.splice(index, 1);
        await showOnlyProduct(page, product);
        await page.locator(`#${deleteProductId(0)}`).click();
        await page.locator(`#${confirmDeleteProductId(0)}`).click();
        await expect(prefixLocator(page, PRODUCT_ROW_ID_PREFIX)).toHaveCount(0);
      },
    },
  ];
  return unweightedActions.map(action => ({ ...action, weight: weightOf(action.name) }));
}
