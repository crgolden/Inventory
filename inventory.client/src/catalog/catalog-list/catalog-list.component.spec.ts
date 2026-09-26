import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  LARGEST_PERCENT,
  newCount,
  newCountCeiling,
  newDisplayName,
  newId,
  newPercent,
  newText,
  newUtcInstant,
  randomIntBetween,
} from '@crgolden/modules/testing';
import { CATALOG_LOAD_ERROR, CatalogListComponent } from './catalog-list.component';
import { CatalogService } from '../catalog.service';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Data, Params, provideRouter, Router, Routes } from '@angular/router';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { CatalogProduct } from '../catalog-product.model';
import { CatalogSortDirections } from '../catalog-sort-directions';
import { CatalogSortColumns } from '../catalog-api';
import { CATALOG_PAGE_SIZE, DEFAULT_CATALOG_SORT } from '../catalog-query';
import { AppPaths } from '../../app/app-paths';
import { CATALOG_ROW_ID_PREFIX, catalogNameId } from '../../catalog-row-ids';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes: Routes = [{ path: `${AppPaths.catalog}/:${newText()}`, component: DummyComponent }];

function newCatalogProduct(): CatalogProduct {
  return {
    id: newId(),
    name: newDisplayName(),
    brand: newText(),
    modelNumber: null,
    category: newText(),
    manualUrl: null,
    msrpPrice: newCount() + newPercent() / LARGEST_PERCENT,
    createdAt: newUtcInstant(),
    updatedAt: null,
  };
}

const mockProducts: CatalogProduct[] = [newCatalogProduct(), newCatalogProduct()];

const ONE_PAGE = { items: mockProducts, total: mockProducts.length };

function morePagesThanOne(): { items: CatalogProduct[]; total: number } {
  return { items: mockProducts, total: CATALOG_PAGE_SIZE + newCount() };
}

describe('CatalogListComponent', () => {
  let fixture: ComponentFixture<CatalogListComponent>;
  let mockService: Partial<CatalogService>;
  let queryParams$: BehaviorSubject<Params>;
  let data$: BehaviorSubject<Data>;
  let navigateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.useFakeTimers();

    mockService = {
      getAll: vi.fn(() => of(ONE_PAGE)),
    };

    queryParams$ = new BehaviorSubject<Params>({});
    data$ = new BehaviorSubject<Data>({ catalog: ONE_PAGE });

    await TestBed.configureTestingModule({
      imports: [CatalogListComponent],
      providers: [
        { provide: CatalogService, useValue: mockService },
        provideRouter(testRoutes),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { catalog: ONE_PAGE }, queryParams: {} },
            get queryParams() {
              return queryParams$.asObservable();
            },
            get data() {
              return data$.asObservable();
            },
          },
        },
      ],
    }).compileComponents();

    navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation((_commands, extras) => {
      const merged: Params = { ...queryParams$.value };
      for (const [key, value] of Object.entries(extras?.queryParams ?? {})) {
        if (value === null || value === undefined) {
          delete merged[key];
        } else {
          merged[key] = String(value);
        }
      }
      queryParams$.next(merged);
      return Promise.resolve(true);
    });

    fixture = TestBed.createComponent(CatalogListComponent);
    fixture.detectChanges();
    await vi.runAllTimersAsync();
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a row for each catalog item', () => {
    const rows = fixture.debugElement.queryAll(By.css(`[id^="${CATALOG_ROW_ID_PREFIX}"]`));
    expect(rows.length).toBe(mockProducts.length);
  });

  it('shows product name in row', () => {
    const firstName = fixture.debugElement.query(By.css(`#${catalogNameId(0)}`));
    expect(firstName.nativeElement.textContent).toContain(mockProducts[0].name);
  });

  it('renders the search input', () => {
    const input = fixture.debugElement.query(By.css('#catalog-search'));
    expect(input).toBeTruthy();
  });

  it('shows showing text with total count', async () => {
    const total = newCountCeiling();
    data$.next({ catalog: { items: mockProducts, total } });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    const text = fixture.debugElement.query(By.css('#catalog-showing'));
    expect(text.nativeElement.textContent).toContain(String(total));
  });

  it('Previous Page is an inert control on the first page', () => {
    const prev = fixture.debugElement.query(By.css('#catalog-prev-page'));
    expect(prev.nativeElement).toBeInstanceOf(HTMLButtonElement);
    expect(prev.nativeElement.disabled).toBe(true);
  });

  it('Next Page is an inert control when total fits on one page', () => {
    const next = fixture.debugElement.query(By.css('#catalog-next-page'));
    expect(next.nativeElement).toBeInstanceOf(HTMLButtonElement);
    expect(next.nativeElement.disabled).toBe(true);
  });

  it('offers every column header as a link rather than a click handler', () => {
    const headers = fixture.debugElement.queryAll(By.css('thead a'));
    expect(headers.length).toBe(Object.values(CatalogSortColumns).length);
    expect(fixture.debugElement.queryAll(By.css('thead button')).length).toBe(0);
  });

  it('the default column offers descending once it is the active ascending sort', () => {
    expect(fixture.componentInstance.sortParams(DEFAULT_CATALOG_SORT)).toEqual({
      orderBy: null,
      orderDir: CatalogSortDirections.desc,
      page: null,
    });
  });

  it('a different column offers ascending, and drops orderDir rather than writing the default', () => {
    expect(fixture.componentInstance.sortParams(CatalogSortColumns.brand)).toEqual({
      orderBy: CatalogSortColumns.brand,
      orderDir: null,
      page: null,
    });
  });

  it('reads the order the URL names into its controls', async () => {
    queryParams$.next({ orderBy: CatalogSortColumns.brand, orderDir: CatalogSortDirections.desc });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(fixture.componentInstance.orderBy()).toBe(CatalogSortColumns.brand);
    expect(fixture.componentInstance.orderDir()).toBe(CatalogSortDirections.desc);
  });

  it('falls back to the default order when the URL names a column that does not exist', async () => {
    queryParams$.next({ orderBy: newText(), orderDir: newText() });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(fixture.componentInstance.orderBy()).toBe(DEFAULT_CATALOG_SORT);
    expect(fixture.componentInstance.orderDir()).toBe(CatalogSortDirections.asc);
  });

  it('typing in the search input writes the term to the URL after debounce, so the resolver re-runs', async () => {
    const term = newText();
    const input: HTMLInputElement = fixture.debugElement.query(
      By.css('#catalog-search'),
    ).nativeElement;
    input.value = term;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: expect.objectContaining({ q: term }) }),
    );
  });

  it('shows no-match message when the resolver answers an empty page', async () => {
    const unmatched = newText();
    queryParams$.next({ q: unmatched });
    data$.next({ catalog: { items: [], total: 0 } });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    const emptyState = fixture.debugElement.query(By.css('#catalog-empty-state'));
    expect(emptyState.nativeElement.textContent).toContain(unmatched);
  });

  it('a resolver that could not load surfaces an error instead of an empty page with no explanation', async () => {
    data$.next({ catalog: null });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    const alert = fixture.debugElement.query(By.css('#catalog-error'));
    expect(alert.nativeElement.textContent).toContain(CATALOG_LOAD_ERROR);
  });

  it('stays usable after a failed load, so one API error does not kill the page', async () => {
    data$.next({ catalog: null });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    data$.next({ catalog: ONE_PAGE });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#catalog-error'))).toBeNull();
    expect(fixture.debugElement.queryAll(By.css(`[id^="${CATALOG_ROW_ID_PREFIX}"]`)).length).toBe(mockProducts.length);
  });

  it('Next Page becomes a link carrying the next page when the total exceeds one page', () => {
    const nextPage = 1 + 1;
    fixture.componentInstance.total.set(morePagesThanOne().total);
    fixture.detectChanges();

    const next = fixture.debugElement.query(By.css('#catalog-next-page'));
    expect(next.nativeElement, 'a page turn is a link, not a click handler').toBeInstanceOf(HTMLAnchorElement);
    expect(fixture.componentInstance.pageParams(nextPage)).toEqual({ page: nextPage });
  });

  it('drops the page parameter rather than writing page=1, so the first page has one URL', () => {
    expect(fixture.componentInstance.pageParams(1)).toEqual({ page: null });
  });

  it('reads the page the URL names into its controls', async () => {
    const requestedPage = randomIntBetween(2, CATALOG_PAGE_SIZE);
    queryParams$.next({ page: String(requestedPage) });
    data$.next({ catalog: { items: mockProducts, total: requestedPage * CATALOG_PAGE_SIZE } });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(fixture.componentInstance.page()).toBe(requestedPage);
  });

  it('never fetches the catalog itself, on the first render or on a URL change', async () => {
    queryParams$.next({ page: String(randomIntBetween(2, CATALOG_PAGE_SIZE)), q: newText() });
    data$.next({ catalog: morePagesThanOne() });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(mockService.getAll).not.toHaveBeenCalled();
  });
});
