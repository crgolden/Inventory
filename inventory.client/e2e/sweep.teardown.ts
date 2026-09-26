import { test as teardown } from '@playwright/test';
import { sweepE2eProducts } from './ci-products';

teardown('sweep every product the suite created', async ({ page }) => {
  await sweepE2eProducts(page);
});
