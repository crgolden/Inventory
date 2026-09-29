import { constants } from 'node:http2';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { randomIntBetween } from '@crgolden/modules/testing';
import type {
  AddToInventoryRequest,
  CatalogProductEdit,
  InventoryItemEdit,
  InventoryItemView,
} from '../../src/products/inventory-item.model.ts';
import type { CatalogSortColumn } from '../../src/catalog/catalog-api.ts';
import { CATALOG_PAGE_SIZE } from '../../src/catalog/catalog-page-size.ts';
import { CatalogSortDirections } from '../../src/catalog/catalog-sort-directions.ts';
import { CONTENT_TYPE_HEADER, HttpMethods } from '../../src/app/http-headers.ts';
import { JSON_CONTENT_TYPE } from '../../src/products/manual-chat/chat-api.ts';
import { ODATA_COUNT } from '../../src/odata.ts';
import {
  CATALOG_PRODUCTS_ODATA_PATH,
  INVENTORY_ITEMS_PATH,
  SEARCH_PARAMETER,
} from '../../src/products/products-api.ts';
import { localOrigin, portArgument } from './mock-dependencies.ts';
import { NodeBufferEncodings } from './node-constants.ts';
import { ODataQueryOptions } from './odata-constants.ts';

const PORT = portArgument();
const SEEDED_CATALOG_ROWS = CATALOG_PAGE_SIZE + randomIntBetween(1, CATALOG_PAGE_SIZE);
const INVENTORY_ITEM_KEY = /^\/odata\/InventoryItems\(([^)]+)\)$/;
const CATALOG_PRODUCT_KEY = /^\/odata\/CatalogProducts\(([^)]+)\)$/;
const NAME_CONTAINS_FILTER = /^contains\(tolower\(Name\), tolower\('((?:[^']|'')*)'\)\)$/;
const MODEL_NUMBER_STARTS_WITH_FILTER = /^startswith\(ModelNumber,'((?:[^']|'')*)'\)$/;

type CatalogRecord = CatalogProductEdit & { id: string; createdAt: string; updatedAt: string | null };
type ItemRecord = InventoryItemEdit & { id: string; catalogProductId: string; createdAt: string; updatedAt: string | null };

const catalog = new Map<string, CatalogRecord>();
const items = new Map<string, ItemRecord>();

function newCatalogRecord(facts: CatalogProductEdit): CatalogRecord {
  const record: CatalogRecord = { ...facts, id: randomUUID(), createdAt: new Date().toISOString(), updatedAt: null };
  catalog.set(record.id, record);
  return record;
}

for (let seeded = 0; seeded < SEEDED_CATALOG_ROWS; seeded++) {
  newCatalogRecord({
    name: randomUUID(),
    brand: randomUUID(),
    modelNumber: randomUUID(),
    category: null,
    manualUrl: null,
    msrpPrice: null,
  });
}

function pascalCase(record: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key.charAt(0).toUpperCase() + key.slice(1), value]));
}

function camelCase(key: string): keyof CatalogRecord {
  return (key.charAt(0).toLowerCase() + key.slice(1)) as keyof CatalogRecord;
}

function compareOrdinal(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function compareNullable(left: string | number | null | undefined, right: string | number | null | undefined): number {
  if (left === right) {
    return 0;
  }
  if (left === null || left === undefined) {
    return -1;
  }
  if (right === null || right === undefined) {
    return 1;
  }
  return typeof left === 'number' && typeof right === 'number' ? left - right : compareOrdinal(String(left), String(right));
}

function nameContains(name: string | null, term: string | null): boolean {
  return term === null || (name?.toLowerCase().includes(term) ?? false);
}

function matchKey(brand: string | null, modelNumber: string | null): string | null {
  return brand === null || modelNumber === null ? null : `${brand.trim().toUpperCase()}::${modelNumber.trim().toUpperCase()}`;
}

function view(item: ItemRecord): InventoryItemView {
  const { id: catalogId, createdAt: catalogCreatedAt, updatedAt: catalogUpdatedAt, ...facts } = catalog.get(item.catalogProductId) ?? {
    id: item.catalogProductId, createdAt: item.createdAt, updatedAt: null, name: null, brand: null, modelNumber: null,
    category: null, manualUrl: null, msrpPrice: null,
  };
  return { ...facts, ...item, catalogProductId: catalogId };
}

async function readJson<T>(request: IncomingMessage): Promise<Partial<T>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return chunks.length === 0 ? {} : (JSON.parse(Buffer.concat(chunks).toString(NodeBufferEncodings.utf8)) as Partial<T>);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE });
  response.end(JSON.stringify(body));
}

function sendStatus(response: ServerResponse, status: number): void {
  response.writeHead(status);
  response.end();
}

function listItems(response: ServerResponse, query: URLSearchParams): void {
  const term = query.get(SEARCH_PARAMETER)?.toLowerCase() ?? null;
  const listed = [...items.values()]
    .map(view)
    .filter(entry => nameContains(entry.name, term))
    .sort((left, right) => compareNullable(left.name, right.name));
  sendJson(response, constants.HTTP_STATUS_OK, listed);
}

async function addItem(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const added = await readJson<AddToInventoryRequest>(request);
  const key = matchKey(added.brand ?? null, added.modelNumber ?? null);
  const existing = key === null ? undefined : [...catalog.values()].find(record => matchKey(record.brand, record.modelNumber) === key);
  const record = existing ?? newCatalogRecord({
    name: added.name ?? null,
    brand: added.brand ?? null,
    modelNumber: added.modelNumber ?? null,
    category: added.category ?? null,
    manualUrl: added.manualUrl ?? null,
    msrpPrice: added.msrpPrice ?? null,
  });
  const item: ItemRecord = {
    id: randomUUID(),
    catalogProductId: record.id,
    serialNumber: added.serialNumber ?? null,
    purchaseDate: added.purchaseDate ?? null,
    pricePaid: added.pricePaid ?? null,
    description: added.description ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  items.set(item.id, item);
  sendJson(response, constants.HTTP_STATUS_CREATED, view(item));
}

async function patchItem(request: IncomingMessage, response: ServerResponse, id: string): Promise<void> {
  const item = items.get(id);
  if (item === undefined) {
    sendStatus(response, constants.HTTP_STATUS_NOT_FOUND);
    return;
  }
  const changes = await readJson<InventoryItemEdit>(request);
  items.set(id, { ...item, ...changes, updatedAt: new Date().toISOString() });
  sendStatus(response, constants.HTTP_STATUS_NO_CONTENT);
}

async function patchCatalogRecord(request: IncomingMessage, response: ServerResponse, id: string): Promise<void> {
  const record = catalog.get(id);
  if (record === undefined) {
    sendStatus(response, constants.HTTP_STATUS_NOT_FOUND);
    return;
  }
  const changes = await readJson<CatalogProductEdit>(request);
  catalog.set(id, { ...record, ...changes, updatedAt: new Date().toISOString() });
  sendStatus(response, constants.HTTP_STATUS_NO_CONTENT);
}

function unescapeODataLiteral(literal: string | undefined): string | null {
  return literal?.replaceAll("''", "'") ?? null;
}

function modelNumberStartsWith(modelNumber: string | null, prefix: string | null): boolean {
  return prefix === null || (modelNumber?.startsWith(prefix) ?? false);
}

function listCatalog(response: ServerResponse, query: URLSearchParams): void {
  const filter = query.get(ODataQueryOptions.filter);
  const term = unescapeODataLiteral(filter === null ? undefined : NAME_CONTAINS_FILTER.exec(filter)?.[1])?.toLowerCase() ?? null;
  const prefix = unescapeODataLiteral(filter === null ? undefined : MODEL_NUMBER_STARTS_WITH_FILTER.exec(filter)?.[1]);
  if (filter !== null && term === null && prefix === null) {
    sendStatus(response, constants.HTTP_STATUS_BAD_REQUEST);
    return;
  }
  const orderBy = query.get(ODataQueryOptions.orderBy);
  const matched = [...catalog.values()].filter(
    record => nameContains(record.name, term) && modelNumberStartsWith(record.modelNumber, prefix),
  );
  if (orderBy !== null) {
    const [orderColumn, orderDirection] = orderBy.split(' ');
    const sortKey = camelCase(orderColumn as CatalogSortColumn);
    const direction = orderDirection === CatalogSortDirections.desc ? -1 : 1;
    matched.sort((left, right) => compareNullable(left[sortKey], right[sortKey]) * direction);
  }
  const skip = Number(query.get(ODataQueryOptions.skip) ?? 0);
  const top = Number(query.get(ODataQueryOptions.top) ?? matched.length);
  sendJson(response, constants.HTTP_STATUS_OK, { [ODATA_COUNT]: matched.length, value: matched.slice(skip, skip + top).map(pascalCase) });
}

function deleteCatalogRecord(response: ServerResponse, id: string): void {
  if (!catalog.has(id)) {
    sendStatus(response, constants.HTTP_STATUS_NOT_FOUND);
    return;
  }
  if ([...items.values()].some(item => item.catalogProductId === id)) {
    sendStatus(response, constants.HTTP_STATUS_CONFLICT);
    return;
  }
  catalog.delete(id);
  sendStatus(response, constants.HTTP_STATUS_NO_CONTENT);
}

function getCatalogRecord(response: ServerResponse, id: string): void {
  const record = catalog.get(id);
  if (record === undefined) {
    sendStatus(response, constants.HTTP_STATUS_NOT_FOUND);
    return;
  }
  sendJson(response, constants.HTTP_STATUS_OK, pascalCase(record));
}

function routeInventoryItems(request: IncomingMessage, response: ServerResponse, url: URL): boolean {
  if (url.pathname === INVENTORY_ITEMS_PATH && request.method === HttpMethods.get) {
    listItems(response, url.searchParams);
    return true;
  }
  if (url.pathname === INVENTORY_ITEMS_PATH && request.method === HttpMethods.post) {
    void addItem(request, response);
    return true;
  }
  const itemKey = INVENTORY_ITEM_KEY.exec(url.pathname)?.[1];
  if (itemKey === undefined) {
    return false;
  }
  if (request.method === HttpMethods.patch) {
    void patchItem(request, response, itemKey);
    return true;
  }
  if (request.method === HttpMethods.delete) {
    sendStatus(response, items.delete(itemKey) ? constants.HTTP_STATUS_NO_CONTENT : constants.HTTP_STATUS_NOT_FOUND);
    return true;
  }
  return false;
}

function routeCatalog(request: IncomingMessage, response: ServerResponse, url: URL): boolean {
  if (url.pathname === CATALOG_PRODUCTS_ODATA_PATH && request.method === HttpMethods.get) {
    listCatalog(response, url.searchParams);
    return true;
  }
  const catalogKey = CATALOG_PRODUCT_KEY.exec(url.pathname)?.[1];
  if (catalogKey === undefined) {
    return false;
  }
  if (request.method === HttpMethods.get) {
    getCatalogRecord(response, catalogKey);
    return true;
  }
  if (request.method === HttpMethods.patch) {
    void patchCatalogRecord(request, response, catalogKey);
    return true;
  }
  if (request.method === HttpMethods.delete) {
    deleteCatalogRecord(response, catalogKey);
    return true;
  }
  return false;
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', localOrigin(PORT));
  if (!routeInventoryItems(request, response, url) && !routeCatalog(request, response, url)) {
    sendStatus(response, constants.HTTP_STATUS_NOT_FOUND);
  }
}).listen(PORT);
