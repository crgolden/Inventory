import { TestBed } from '@angular/core/testing';
import { HttpStatusCode, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import {
  LARGEST_PERCENT,
  newCount,
  newDisplayName,
  newId,
  newPercent,
  newText,
  newUtcInstant,
} from '@crgolden/modules/testing';
import { ProductService } from './product.service';
import { INVENTORY_ITEMS_URL, INVENTORY_ODATA_URL, SEARCH_PARAMETER } from './products-api';
import { AddToInventoryRequest, InventoryItemView } from './inventory-item.model';
import { HttpMethods } from '../app/http-headers';

function newPrice(): number {
  return newCount() + newPercent() / LARGEST_PERCENT;
}

function newInventoryItem(): InventoryItemView {
  return {
    id: newId(),
    catalogProductId: newId(),
    name: newDisplayName(),
    brand: newText(),
    modelNumber: newText(),
    category: newText(),
    manualUrl: null,
    msrpPrice: newPrice(),
    serialNumber: newText(),
    purchaseDate: newUtcInstant(),
    pricePaid: newPrice(),
    description: newDisplayName(),
    createdAt: newUtcInstant(),
    updatedAt: null,
  };
}

const mockItem = newInventoryItem();

const otherItem = newInventoryItem();

const newRequest: AddToInventoryRequest = {
  name: newDisplayName(),
  brand: newText(),
  modelNumber: newText(),
  category: null,
  manualUrl: null,
  msrpPrice: null,
  serialNumber: null,
  purchaseDate: null,
  pricePaid: null,
  description: null,
};

describe('ProductService', () => {
  let service: ProductService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ProductService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function params(urlWithParams: string): URLSearchParams {
    const idx = urlWithParams.indexOf('?');
    return new URLSearchParams(idx >= 0 ? urlWithParams.slice(idx + 1) : '');
  }

  describe('getAll', () => {
    it('requests the owner-scoped inventory projection, not the anonymous catalog', () => {
      service.getAll().subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(INVENTORY_ITEMS_URL));
      expect(req.request.method).toBe(HttpMethods.get);
      req.flush([mockItem]);
    });

    it('returns the items unwrapped, since the projection is a bare array', async () => {
      const promise = firstValueFrom(service.getAll());

      http.expectOne(r => r.urlWithParams.startsWith(INVENTORY_ITEMS_URL)).flush([mockItem]);

      expect(await promise).toEqual([mockItem]);
    });

    it('passes the search term through as a plain query parameter', () => {
      const term = newText();
      service.getAll(term).subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(INVENTORY_ITEMS_URL));
      expect(params(req.request.urlWithParams).get(SEARCH_PARAMETER)).toBe(term);
      req.flush([]);
    });

    it('does not send a search parameter when the term is empty', () => {
      service.getAll('').subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(INVENTORY_ITEMS_URL));
      expect(params(req.request.urlWithParams).has(SEARCH_PARAMETER)).toBe(false);
      req.flush([]);
    });

    it('does not send a search parameter when the term is only whitespace', () => {
      service.getAll('   ').subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(INVENTORY_ITEMS_URL));
      expect(params(req.request.urlWithParams).has(SEARCH_PARAMETER)).toBe(false);
      req.flush([]);
    });

    it('trims whitespace from the search term', () => {
      const term = newText();
      service.getAll(`  ${term}  `).subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(INVENTORY_ITEMS_URL));
      expect(params(req.request.urlWithParams).get(SEARCH_PARAMETER)).toBe(term);
      req.flush([]);
    });
  });

  describe('getById', () => {
    it('selects the matching item out of the owner-scoped projection', async () => {
      const promise = firstValueFrom(service.getById(otherItem.id));

      http.expectOne(r => r.urlWithParams.startsWith(INVENTORY_ITEMS_URL)).flush([mockItem, otherItem]);

      expect(await promise).toEqual(otherItem);
    });

    it('emits null when the id is absent from the owner-scoped projection', async () => {
      const promise = firstValueFrom(service.getById(otherItem.id));

      http.expectOne(r => r.urlWithParams.startsWith(INVENTORY_ITEMS_URL)).flush([mockItem]);

      expect(await promise).toBeNull();
    });
  });

  describe('create', () => {
    it('POSTs the composite request to the inventory items URL', () => {
      service.create(newRequest).subscribe();

      const req = http.expectOne(INVENTORY_ITEMS_URL);
      expect(req.request.method).toBe(HttpMethods.post);
      expect(req.request.body).toEqual(newRequest);
      req.flush(mockItem, { status: HttpStatusCode.Created, statusText: newText() });
    });

    it('emits the new item id from the response body', async () => {
      const promise = firstValueFrom(service.create(newRequest));

      http.expectOne(INVENTORY_ITEMS_URL).flush(mockItem, { status: HttpStatusCode.Created, statusText: newText() });

      expect(await promise).toBe(mockItem.id);
    });

    it('emits null when the response carries no body', async () => {
      const promise = firstValueFrom(service.create(newRequest));

      http.expectOne(INVENTORY_ITEMS_URL).flush(null, { status: HttpStatusCode.Created, statusText: newText() });

      expect(await promise).toBeNull();
    });
  });

  describe('patch', () => {
    it('PATCHes the owner-scoped OData entity with only the changed fields', () => {
      const change = { serialNumber: newText() };
      service.patch(mockItem.id, change).subscribe();

      const req = http.expectOne(`${INVENTORY_ODATA_URL}(${mockItem.id})`);
      expect(req.request.method).toBe(HttpMethods.patch);
      expect(req.request.body).toEqual(change);
      req.flush(null);
    });
  });

  describe('delete', () => {
    it('sends DELETE to the owner-scoped OData entity URL', () => {
      service.delete(mockItem.id).subscribe();

      const req = http.expectOne(`${INVENTORY_ODATA_URL}(${mockItem.id})`);
      expect(req.request.method).toBe(HttpMethods.delete);
      req.flush(null, { status: HttpStatusCode.NoContent, statusText: newText() });
    });

    it('completes without error on 204', async () => {
      const promise = firstValueFrom(service.delete(mockItem.id));

      http
        .expectOne(`${INVENTORY_ODATA_URL}(${mockItem.id})`)
        .flush(null, { status: HttpStatusCode.NoContent, statusText: newText() });

      await expect(promise).resolves.toBeNull();
    });
  });
});
