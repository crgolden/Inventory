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
import { catalogResolver } from './catalog.resolver';
import { CatalogService } from './catalog.service';
import { CatalogProduct } from './catalog-product.model';
import { AppPaths, CATALOG_NOT_FOUND_URL, CATALOG_URL, ROUTE_ID_PARAMETER } from '../app/app-paths';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes = [
  { path: AppPaths.catalog, component: DummyComponent },
  { path: `${AppPaths.catalog}/${AppPaths.notFound}`, component: DummyComponent },
];

const mockProduct: CatalogProduct = {
  id: newId(),
  name: newDisplayName(),
  brand: newText(),
  modelNumber: null,
  category: null,
  manualUrl: null,
  msrpPrice: newCount(),
  createdAt: newUtcInstant(),
  updatedAt: null,
};

function makeSnapshot(id: string | null): ActivatedRouteSnapshot {
  return {
    paramMap: { get: (key: string) => (key === ROUTE_ID_PARAMETER ? id : null) },
  } as unknown as ActivatedRouteSnapshot;
}

describe('catalogResolver', () => {
  it('returns the product when getById succeeds', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogService, useValue: { getById: () => of(mockProduct) } },
        provideRouter(testRoutes),
      ],
    });

    const result$ = TestBed.runInInjectionContext(() =>
      catalogResolver(makeSnapshot(mockProduct.id), {} as RouterStateSnapshot),
    ) as Observable<CatalogProduct>;

    const product = await firstValueFrom(result$);
    expect(product).toEqual(mockProduct);
  });

  it('navigates to /catalog/not-found without calling the service when the route has no id', async () => {
    const getById = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogService, useValue: { getById } },
        provideRouter(testRoutes),
      ],
    });

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const result$ = TestBed.runInInjectionContext(() =>
      catalogResolver(makeSnapshot(null), {} as RouterStateSnapshot),
    ) as Observable<CatalogProduct>;

    await expect(firstValueFrom(result$)).rejects.toBeInstanceOf(EmptyError);
    expect(getById).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith([CATALOG_NOT_FOUND_URL]);
  });

  it('navigates to /catalog/not-found when getById returns 404', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CatalogService,
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
      catalogResolver(makeSnapshot(newId()), {} as RouterStateSnapshot),
    ) as Observable<CatalogProduct>;

    await expect(firstValueFrom(result$)).rejects.toBeInstanceOf(EmptyError);
    expect(navigateSpy).toHaveBeenCalledWith([CATALOG_NOT_FOUND_URL]);
  });

  it('navigates to /catalog when getById returns a non-404 error', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CatalogService,
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
      catalogResolver(makeSnapshot(newId()), {} as RouterStateSnapshot),
    ) as Observable<CatalogProduct>;

    await expect(firstValueFrom(result$)).rejects.toBeInstanceOf(EmptyError);
    expect(navigateSpy).toHaveBeenCalledWith([CATALOG_URL]);
  });
});
