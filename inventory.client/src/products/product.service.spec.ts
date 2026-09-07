import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ProductService } from './product.service';
import { AddToInventoryRequest, InventoryItemView } from './inventory-item.model';

const ITEMS_URL = '/products/api/inventory/items';
const ODATA_BASE = '/products/api/odata/InventoryItems';

const mockItem: InventoryItemView = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  catalogProductId: 'bbbbbbbb-0000-0000-0000-000000000001',
  name: 'LG OLED C3',
  brand: 'LG',
  modelNumber: 'OLED65C3PUA',
  category: 'Electronics',
  manualUrl: null,
  msrpPrice: 1499.99,
  serialNumber: 'SN-LG-001',
  purchaseDate: '2023-11-24T14:30:00Z',
  pricePaid: 1299.99,
  description: '65-inch 4K OLED smart TV',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: null,
};

const otherItem: InventoryItemView = {
  ...mockItem,
  id: 'aaaaaaaa-0000-0000-0000-000000000002',
  catalogProductId: 'bbbbbbbb-0000-0000-0000-000000000002',
  name: 'Dyson V15',
};

const newRequest: AddToInventoryRequest = {
  name: 'New Item',
  brand: 'Acme',
  modelNumber: 'AC-1',
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

      const req = http.expectOne(r => r.urlWithParams.startsWith(ITEMS_URL));
      expect(req.request.method).toBe('GET');
      req.flush([mockItem]);
    });

    it('returns the items unwrapped, since the projection is a bare array', async () => {
      const promise = firstValueFrom(service.getAll());

      http.expectOne(r => r.urlWithParams.startsWith(ITEMS_URL)).flush([mockItem]);

      const items = await promise;
      expect(items.length).toBe(1);
      expect(items[0].id).toBe(mockItem.id);
      expect(items[0].pricePaid).toBe(mockItem.pricePaid);
    });

    it('passes the search term through as a plain query parameter', () => {
      service.getAll('oled').subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(ITEMS_URL));
      expect(params(req.request.urlWithParams).get('search')).toBe('oled');
      req.flush([]);
    });

    it('does not send a search parameter when the term is empty', () => {
      service.getAll('').subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(ITEMS_URL));
      expect(params(req.request.urlWithParams).has('search')).toBe(false);
      req.flush([]);
    });

    it('does not send a search parameter when the term is only whitespace', () => {
      service.getAll('   ').subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(ITEMS_URL));
      expect(params(req.request.urlWithParams).has('search')).toBe(false);
      req.flush([]);
    });

    it('trims whitespace from the search term', () => {
      service.getAll('  dyson  ').subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(ITEMS_URL));
      expect(params(req.request.urlWithParams).get('search')).toBe('dyson');
      req.flush([]);
    });
  });

  describe('getById', () => {
    it('selects the matching item out of the owner-scoped projection', async () => {
      const promise = firstValueFrom(service.getById(otherItem.id));

      http.expectOne(r => r.urlWithParams.startsWith(ITEMS_URL)).flush([mockItem, otherItem]);

      const item = await promise;
      expect(item).not.toBeNull();
      expect(item?.id).toBe(otherItem.id);
      expect(item?.name).toBe(otherItem.name);
    });

    it('emits null when the id is absent from the owner-scoped projection', async () => {
      const promise = firstValueFrom(service.getById(otherItem.id));

      http.expectOne(r => r.urlWithParams.startsWith(ITEMS_URL)).flush([mockItem]);

      expect(await promise).toBeNull();
    });
  });

  describe('create', () => {
    it('POSTs the composite request to the inventory items URL', () => {
      service.create(newRequest).subscribe();

      const req = http.expectOne(ITEMS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newRequest);
      req.flush(mockItem, { status: 201, statusText: 'Created' });
    });

    it('emits the new item id from the response body', async () => {
      const promise = firstValueFrom(service.create(newRequest));

      http.expectOne(ITEMS_URL).flush(mockItem, { status: 201, statusText: 'Created' });

      expect(await promise).toBe(mockItem.id);
    });

    it('emits null when the response carries no body', async () => {
      const promise = firstValueFrom(service.create(newRequest));

      http.expectOne(ITEMS_URL).flush(null, { status: 201, statusText: 'Created' });

      expect(await promise).toBeNull();
    });
  });

  describe('patch', () => {
    it('PATCHes the owner-scoped OData entity with only the changed fields', () => {
      service.patch(mockItem.id, { serialNumber: 'SN-UPDATED' }).subscribe();

      const req = http.expectOne(`${ODATA_BASE}(${mockItem.id})`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ serialNumber: 'SN-UPDATED' });
      req.flush(null);
    });
  });

  describe('delete', () => {
    it('sends DELETE to the owner-scoped OData entity URL', () => {
      service.delete(mockItem.id).subscribe();

      const req = http.expectOne(`${ODATA_BASE}(${mockItem.id})`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('completes without error on 204', async () => {
      const promise = firstValueFrom(service.delete(mockItem.id));

      http
        .expectOne(`${ODATA_BASE}(${mockItem.id})`)
        .flush(null, { status: 204, statusText: 'No Content' });

      await expect(promise).resolves.toBeNull();
    });
  });
});
