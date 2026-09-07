import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { of, throwError, firstValueFrom, EmptyError, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { productResolver } from './product.resolver';
import { ProductService } from './product.service';
import { InventoryItemView } from './inventory-item.model';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes = [
  { path: 'products', component: DummyComponent },
  { path: 'products/not-found', component: DummyComponent },
];

const mockProduct: InventoryItemView = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  catalogProductId: 'bbbbbbbb-0000-0000-0000-000000000001',
  name: 'LG TV',
  brand: 'LG',
  modelNumber: 'OLED65C3',
  category: null,
  manualUrl: null,
  msrpPrice: 1499.99,
  serialNumber: null,
  purchaseDate: null,
  pricePaid: 1299.99,
  description: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: null,
};

function makeSnapshot(id: string | null): ActivatedRouteSnapshot {
  return {
    paramMap: { get: (key: string) => (key === 'id' ? id : null) },
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
    expect(navigateSpy).toHaveBeenCalledWith(['/products/not-found']);
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
      productResolver(makeSnapshot('someone-elses-id'), {} as RouterStateSnapshot),
    ) as Observable<InventoryItemView>;

    await expect(firstValueFrom(result$)).rejects.toBeInstanceOf(EmptyError);
    expect(navigateSpy).toHaveBeenCalledWith(['/products/not-found']);
  });

  it('navigates to /products/not-found when getById returns 404', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ProductService,
          useValue: {
            getById: () =>
              throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' })),
          },
        },
        provideRouter(testRoutes),
      ],
    });

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const result$ = TestBed.runInInjectionContext(() =>
      productResolver(makeSnapshot('missing-id'), {} as RouterStateSnapshot),
    ) as Observable<InventoryItemView>;

    await expect(firstValueFrom(result$)).rejects.toBeInstanceOf(EmptyError);
    expect(navigateSpy).toHaveBeenCalledWith(['/products/not-found']);
  });

  it('navigates to /products when getById returns a non-404 error', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ProductService,
          useValue: {
            getById: () =>
              throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error' })),
          },
        },
        provideRouter(testRoutes),
      ],
    });

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const result$ = TestBed.runInInjectionContext(() =>
      productResolver(makeSnapshot('any-id'), {} as RouterStateSnapshot),
    ) as Observable<InventoryItemView>;

    await expect(firstValueFrom(result$)).rejects.toBeInstanceOf(EmptyError);
    expect(navigateSpy).toHaveBeenCalledWith(['/products']);
  });
});
