import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { of, throwError, firstValueFrom, EmptyError, Observable } from 'rxjs';
import { newCount, newDisplayName, newId, newText, newUtcInstant } from '@crgolden/modules/testing';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { productResolver } from './product.resolver';
import { ProductService } from './product.service';
import { InventoryItemView } from './inventory-item.model';
import { AppPaths, PRODUCTS_NOT_FOUND_URL, PRODUCTS_URL, ROUTE_ID_PARAMETER } from '../app/app-paths';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes = [
  { path: AppPaths.products, component: DummyComponent },
  { path: `${AppPaths.products}/${AppPaths.notFound}`, component: DummyComponent },
];

const mockProduct: InventoryItemView = {
  id: newId(),
  catalogProductId: newId(),
  name: newDisplayName(),
  brand: newText(),
  modelNumber: newText(),
  category: null,
  manualUrl: null,
  msrpPrice: newCount(),
  serialNumber: null,
  purchaseDate: null,
  pricePaid: newCount(),
  description: null,
  createdAt: newUtcInstant(),
  updatedAt: null,
};

function makeSnapshot(id: string | null): ActivatedRouteSnapshot {
  return {
    paramMap: { get: (key: string) => (key === ROUTE_ID_PARAMETER ? id : null) },
  } as unknown as ActivatedRouteSnapshot;
}

describe('productResolver', () => {
  it('returns the product when getById succeeds', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ProductService, useValue: { getById: () => of(mockProduct) } },
        provideRouter(testRoutes),
      ],
    });

    const result$ = TestBed.runInInjectionContext(() =>
      productResolver(makeSnapshot(mockProduct.id), {} as RouterStateSnapshot),
    ) as Observable<InventoryItemView>;

    const product = await firstValueFrom(result$);
    expect(product).toEqual(mockProduct);
  });

  it('navigates to /products/not-found without calling the service when the route has no id', async () => {
    const getById = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: ProductService, useValue: { getById } },
        provideRouter(testRoutes),
      ],
    });

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const result$ = TestBed.runInInjectionContext(() =>
      productResolver(makeSnapshot(null), {} as RouterStateSnapshot),
    ) as Observable<InventoryItemView>;

    await expect(firstValueFrom(result$)).rejects.toBeInstanceOf(EmptyError);
    expect(getById).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith([PRODUCTS_NOT_FOUND_URL]);
  });

  it('navigates to /products/not-found when the id is absent from the owner-scoped projection', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ProductService, useValue: { getById: () => of(null) } },
        provideRouter(testRoutes),
      ],
    });

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const result$ = TestBed.runInInjectionContext(() =>
      productResolver(makeSnapshot(newId()), {} as RouterStateSnapshot),
    ) as Observable<InventoryItemView>;

    await expect(firstValueFrom(result$)).rejects.toBeInstanceOf(EmptyError);
    expect(navigateSpy).toHaveBeenCalledWith([PRODUCTS_NOT_FOUND_URL]);
  });

  it('navigates to /products/not-found when getById returns 404', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ProductService,
          useValue: {
            getById: () =>
              throwError(() => new HttpErrorResponse({ status: HttpStatusCode.NotFound, statusText: newText() })),
          },
        },
        provideRouter(testRoutes),
      ],
    });

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const result$ = TestBed.runInInjectionContext(() =>
      productResolver(makeSnapshot(newId()), {} as RouterStateSnapshot),
    ) as Observable<InventoryItemView>;

    await expect(firstValueFrom(result$)).rejects.toBeInstanceOf(EmptyError);
    expect(navigateSpy).toHaveBeenCalledWith([PRODUCTS_NOT_FOUND_URL]);
  });

  it('navigates to /products when getById returns a non-404 error', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ProductService,
          useValue: {
            getById: () =>
              throwError(() => new HttpErrorResponse({ status: HttpStatusCode.InternalServerError, statusText: newText() })),
          },
        },
        provideRouter(testRoutes),
      ],
    });

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const result$ = TestBed.runInInjectionContext(() =>
      productResolver(makeSnapshot(newId()), {} as RouterStateSnapshot),
    ) as Observable<InventoryItemView>;

    await expect(firstValueFrom(result$)).rejects.toBeInstanceOf(EmptyError);
    expect(navigateSpy).toHaveBeenCalledWith([PRODUCTS_URL]);
  });
});
