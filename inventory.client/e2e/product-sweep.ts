import { constants } from 'node:http2';
import type { Page } from '@playwright/test';
import e2eSettings from './e2e-settings.json';
import { ODataQueryOptions } from './mocks/odata-constants';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '../src/app/http-headers';
import {
  AUTHORIZED_CATALOG_ODATA_URL,
  INVENTORY_ITEMS_URL,
  INVENTORY_ODATA_URL,
  SEARCH_PARAMETER,
} from '../src/products/products-api';

export const CSRF_HEADERS = { [CSRF_HEADER]: CSRF_HEADER_VALUE } as const;

const CATALOG_SWEEP_PAGE_SIZE = e2eSettings.catalogSweepPageSize;
const NOT_OURS_TO_REMOVE_STATUSES: ReadonlySet<number> = new Set([409, 404]);

export interface SweepPrefixes {
  readonly productNamePrefix: string;
  readonly modelNumberPrefix: string;
}

export async function sweepProducts(page: Page, prefixes: SweepPrefixes): Promise<void> {
  await sweepInventoryItems(page, prefixes.productNamePrefix);
  await sweepCatalogRows(page, prefixes.modelNumberPrefix);
}

async function sweepInventoryItems(page: Page, productNamePrefix: string): Promise<void> {
  const listed = await page.request.get(
    `${INVENTORY_ITEMS_URL}?${SEARCH_PARAMETER}=${encodeURIComponent(productNamePrefix)}`,
    { headers: CSRF_HEADERS },
  );
  if (!listed.ok()) {
    throw new Error(
      `Inventory sweep could not list its items: ${listed.status()} from ${INVENTORY_ITEMS_URL}. ` +
        'A sweep that cannot list is indistinguishable from a sweep with nothing to do.',
    );
  }
  const items = (await listed.json()) as { id: string; name: string | null }[];
  const ours = items.filter(item => item.name?.startsWith(productNamePrefix) === true);
  for (const item of ours) {
    const deleted = await page.request.delete(`${INVENTORY_ODATA_URL}(${item.id})`, { headers: CSRF_HEADERS });
    if (!deleted.ok() && deleted.status() !== constants.HTTP_STATUS_NOT_FOUND) {
      throw new Error(`Inventory sweep could not delete ${item.id}: ${deleted.status()}.`);
    }
  }
}

async function sweepCatalogRows(page: Page, modelNumberPrefix: string): Promise<void> {
  const filter = `startswith(ModelNumber,'${modelNumberPrefix}-')`;
  const listed = await page.request.get(
    `${AUTHORIZED_CATALOG_ODATA_URL}?${ODataQueryOptions.filter}=${encodeURIComponent(filter)}` +
      `&${ODataQueryOptions.select}=Id&${ODataQueryOptions.top}=${CATALOG_SWEEP_PAGE_SIZE}`,
    { headers: CSRF_HEADERS },
  );
  if (!listed.ok()) {
    throw new Error(
      `Catalog sweep could not list its rows: ${listed.status()} from ${AUTHORIZED_CATALOG_ODATA_URL}. ` +
        'A sweep that cannot list is indistinguishable from a sweep with nothing to do, and the residue it ' +
        'leaves grows run over run while the suite stays green.',
    );
  }
  const body = (await listed.json()) as { value?: { Id?: string }[] };
  for (const row of body.value ?? []) {
    if (row.Id === undefined) {
      continue;
    }
    const deleted = await page.request.delete(`${AUTHORIZED_CATALOG_ODATA_URL}(${row.Id})`, { headers: CSRF_HEADERS });
    if (!deleted.ok() && !NOT_OURS_TO_REMOVE_STATUSES.has(deleted.status())) {
      throw new Error(`Catalog sweep could not delete ${row.Id}: ${deleted.status()}.`);
    }
  }
}
