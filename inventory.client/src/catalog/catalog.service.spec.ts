import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
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
import { CatalogParams, CatalogService } from './catalog.service';
import { CATALOG_ODATA_URL, CatalogSortColumns, nameContainsFilter } from './catalog-api';
import { CatalogProduct } from './catalog-product.model';
import { ODATA_COUNT } from '../odata';
import { CatalogSortDirections } from './catalog-sort-directions';
import { HttpMethods } from '../app/http-headers';
import { ODataQueryOptions } from '../testing/odata-constants';

function newPrice(): number {
  return newCount() + newPercent() / LARGEST_PERCENT;
}

const mockApiProduct = {
  Id: newId(),
  Name: newDisplayName(),
  Brand: newText(),
  ModelNumber: newText(),
  Category: newText(),
  ManualUrl: null,
  MsrpPrice: newPrice(),
  CreatedAt: newUtcInstant(),
  UpdatedAt: null,
};

const mockProduct: CatalogProduct = {
  id: mockApiProduct.Id,
  name: mockApiProduct.Name,
  brand: mockApiProduct.Brand,
  modelNumber: mockApiProduct.ModelNumber,
  category: mockApiProduct.Category,
  manualUrl: null,
  msrpPrice: mockApiProduct.MsrpPrice,
  createdAt: mockApiProduct.CreatedAt,
  updatedAt: null,
};

const defaultParams: CatalogParams = {
  orderBy: CatalogSortColumns.name,
  orderDir: CatalogSortDirections.asc,
  page: 1,
  pageSize: newCount(),
};

function params(urlWithParams: string): URLSearchParams {
  const idx = urlWithParams.indexOf('?');
  return new URLSearchParams(idx >= 0 ? urlWithParams.slice(idx + 1) : '');
}

describe('CatalogService', () => {
  let service: CatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(CatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getAll', () => {
    it('requests the CatalogProducts set, not the owner-scoped inventory', () => {
      service.getAll(defaultParams).subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL));
      expect(req.request.method).toBe(HttpMethods.get);
      req.flush({ [ODATA_COUNT]: 0, value: [] });
    });

    it('sends $count=true', () => {
      service.getAll(defaultParams).subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL));
      expect(params(req.request.urlWithParams).get(ODataQueryOptions.count)).toBe(String(true));
      req.flush({ [ODATA_COUNT]: 0, value: [] });
    });

    it('sends $orderby with direction', () => {
      service.getAll(defaultParams).subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL));
      expect(params(req.request.urlWithParams).get(ODataQueryOptions.orderBy)).toBe(
        `${CatalogSortColumns.name} ${CatalogSortDirections.asc}`,
      );
      req.flush({ [ODATA_COUNT]: 0, value: [] });
    });

    it('sends $top and $skip for the first page', () => {
      const pageSize = newCount();
      service.getAll({ ...defaultParams, page: 1, pageSize }).subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL));
      const p = params(req.request.urlWithParams);
      expect(p.get(ODataQueryOptions.top)).toBe(String(pageSize));
      expect(p.get(ODataQueryOptions.skip)).toBe(String(0));
      req.flush({ [ODATA_COUNT]: 0, value: [] });
    });

    it('skips the pages before the requested one', () => {
      const pageSize = newCount();
      const page = newCount() + 1;
      service.getAll({ ...defaultParams, page, pageSize }).subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL));
      expect(params(req.request.urlWithParams).get(ODataQueryOptions.skip)).toBe(String((page - 1) * pageSize));
      req.flush({ [ODATA_COUNT]: 0, value: [] });
    });

    it('applies tolower contains $filter when search is provided', () => {
      const search = newText();
      service.getAll({ ...defaultParams, search }).subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL));
      const filter = params(req.request.urlWithParams).get(ODataQueryOptions.filter);
      expect(filter).not.toBeNull();
      expect(filter).toBe(nameContainsFilter(search));
      req.flush({ [ODATA_COUNT]: 0, value: [] });
    });

    it('doubles an apostrophe so the OData string literal is not closed early', () => {
      const before = newText();
      const after = newText();
      service.getAll({ ...defaultParams, search: `${before}'${after}` }).subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL));
      const filter = params(req.request.urlWithParams).get(ODataQueryOptions.filter);
      expect(filter).not.toBeNull();
      expect(filter).toContain(`'${before}''${after}'`);
      req.flush({ [ODATA_COUNT]: 0, value: [] });
    });

    it('trims whitespace from the search term', () => {
      const search = newText();
      service.getAll({ ...defaultParams, search: `  ${search}  ` }).subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL));
      const filter = params(req.request.urlWithParams).get(ODataQueryOptions.filter);
      expect(filter).not.toBeNull();
      expect(filter).toBe(nameContainsFilter(search));
      req.flush({ [ODATA_COUNT]: 0, value: [] });
    });

    it('does not include $filter when search is empty', () => {
      service.getAll({ ...defaultParams, search: '' }).subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL));
      expect(params(req.request.urlWithParams).has(ODataQueryOptions.filter)).toBe(false);
      req.flush({ [ODATA_COUNT]: 0, value: [] });
    });

    it('unwraps the OData envelope and maps PascalCase response to CatalogProduct', async () => {
      const promise = firstValueFrom(service.getAll(defaultParams));

      http
        .expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL))
        .flush({
          [ODATA_COUNT]: 1,
          value: [mockApiProduct],
        });

      const page = await promise;
      expect(page.items).toEqual([mockProduct]);
    });

    it('drops owner-private fields the anonymous surface must never carry', async () => {
      const promise = firstValueFrom(service.getAll(defaultParams));

      http
        .expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL))
        .flush({
          [ODATA_COUNT]: 1,
          value: [
            {
              ...mockApiProduct,
              OwnerId: newId(),
              SerialNumber: newText(),
              PurchaseDate: newUtcInstant(),
              PricePaid: newPrice(),
              Description: newText(),
            },
          ],
        });

      const page = await promise;
      expect(Object.keys(page.items[0]).sort()).toEqual(Object.keys(mockProduct).sort());
    });

    it('returns the total count from @odata.count', async () => {
      const total = newCount();
      const promise = firstValueFrom(service.getAll(defaultParams));

      http
        .expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL))
        .flush({
          [ODATA_COUNT]: total,
          value: [],
        });

      const page = await promise;
      expect(page.total).toBe(total);
    });

    it('defaults total to 0 when @odata.count is absent', async () => {
      const promise = firstValueFrom(service.getAll(defaultParams));

      http.expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL)).flush({ value: [] });

      const page = await promise;
      expect(page.total).toBe(0);
    });

    it('sends desc orderDir correctly', () => {
      service.getAll({ ...defaultParams, orderBy: CatalogSortColumns.msrpPrice, orderDir: CatalogSortDirections.desc }).subscribe();

      const req = http.expectOne(r => r.urlWithParams.startsWith(CATALOG_ODATA_URL));
      expect(params(req.request.urlWithParams).get(ODataQueryOptions.orderBy)).toBe(
        `${CatalogSortColumns.msrpPrice} ${CatalogSortDirections.desc}`,
      );
      req.flush({ [ODATA_COUNT]: 0, value: [] });
    });
  });

  describe('getById', () => {
    it('requests the keyed OData entity URL', () => {
      service.getById(mockProduct.id).subscribe();

      const req = http.expectOne(`${CATALOG_ODATA_URL}(${mockProduct.id})`);
      req.flush(mockApiProduct);
    });

    it('maps PascalCase API response to CatalogProduct', async () => {
      const promise = firstValueFrom(service.getById(mockProduct.id));

      http.expectOne(`${CATALOG_ODATA_URL}(${mockProduct.id})`).flush(mockApiProduct);

      const product = await promise;
      expect(product).toEqual(mockProduct);
    });
  });
});
