import { createBdd, test as base } from 'playwright-bdd';
import { deleteProductThroughTheList } from '../ci-products';
import { SIGNED_OUT_TAG } from './bdd-constants';
import { ScenarioContext } from './scenario-context';

const NO_SESSION = { cookies: [], origins: [] };

export const test = base.extend<{ ctx: ScenarioContext }>({
  storageState: async ({ $tags, storageState }, use) => {
    await use($tags.includes(SIGNED_OUT_TAG) ? NO_SESSION : storageState);
  },
  ctx: async ({ page }, use) => {
    const ctx = new ScenarioContext();
    await use(ctx);
    const leftBehind = ctx.productLeftBehind;
    if (leftBehind !== null) {
      await deleteProductThroughTheList(page, leftBehind);
    }
  },
});

export const { Given, When, Then } = createBdd(test);
