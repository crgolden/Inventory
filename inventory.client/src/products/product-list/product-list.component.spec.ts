import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  LARGEST_PERCENT,
  newCount,
  newDisplayName,
  newId,
  newPercent,
  newText,
  newUtcInstant,
} from '@crgolden/modules/testing';
import { PRODUCT_LIST_LOAD_ERROR, ProductListComponent } from './product-list.component';
import { ProductService } from '../product.service';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Data, Params, provideRouter, Router, Routes } from '@angular/router';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { InventoryItemView } from '../inventory-item.model';
import { AppPaths } from '../../app/app-paths';
import { PRODUCT_ROW_ID_PREFIX, confirmDeleteProductId, deleteProductId, productNameId } from '../../product-row-ids';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes: Routes = [
  { path: `${AppPaths.products}/${AppPaths.newProduct}`, component: DummyComponent },
  { path: `${AppPaths.products}/:${newText()}`, component: DummyComponent },
];

function newPrice(): number {
  return newCount() + newPercent() / LARGEST_PERCENT;
}

function newInventoryItem(overrides: Partial<InventoryItemView> = {}): InventoryItemView {
  return {
    id: newId(),
    catalogProductId: newId(),
    name: newDisplayName(),
    brand: newText(),
    modelNumber: null,
    category: newText(),
    manualUrl: null,
    msrpPrice: newPrice(),
    serialNumber: null,
    purchaseDate: null,
    pricePaid: newPrice(),
    description: null,
    createdAt: newUtcInstant(),
    updatedAt: null,
    ...overrides,
  };
}

const mockProducts: InventoryItemView[] = [
  newInventoryItem(),
  newInventoryItem({ msrpPrice: null, pricePaid: null }),
];

describe('ProductListComponent', () => {
  let fixture: ComponentFixture<ProductListComponent>;
  let mockService: Partial<ProductService>;
  let queryParams$: BehaviorSubject<Params>;
  let data$: BehaviorSubject<Data>;

  beforeEach(async () => {
    vi.useFakeTimers();

    mockService = {
      getAll: vi.fn(() => of(mockProducts)),
      delete: vi.fn(() => of(void 0)),
    };

    queryParams$ = new BehaviorSubject<Params>({});
    data$ = new BehaviorSubject<Data>({ products: mockProducts });

    await TestBed.configureTestingModule({
      imports: [ProductListComponent],
      providers: [
        { provide: ProductService, useValue: mockService },
        provideRouter(testRoutes),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { products: mockProducts }, queryParams: {} },
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

    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation((_commands, extras) => {
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

    fixture = TestBed.createComponent(ProductListComponent);

    fixture.detectChanges();

    await vi.runAllTimersAsync();
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a row for each product', () => {
    const rows = fixture.debugElement.queryAll(By.css(`[id^="${PRODUCT_ROW_ID_PREFIX}"]`));
    expect(rows.length).toBe(mockProducts.length);
  });

  it('shows product name in row', () => {
    const nameCell = fixture.debugElement.query(By.css(`#${productNameId(0)}`));
    expect(nameCell.nativeElement.textContent).toContain(mockProducts[0].name);
  });

  it('renders the search input', () => {
    const input = fixture.debugElement.query(By.css('#product-search'));
    expect(input).toBeTruthy();
  });

  it('shows no-match message when the resolver answers an empty list', async () => {
    const unmatched = newText();
    queryParams$.next({ q: unmatched });
    data$.next({ products: [] });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    const emptyState = fixture.debugElement.query(By.css('#products-empty-state'));
    expect(emptyState.nativeElement.textContent).toContain(unmatched);
  });

  it('puts the search term in the URL so a filtered list can be shared, and so the resolver re-runs', async () => {
    const term = newText();
    const input: HTMLInputElement = fixture.debugElement.query(
      By.css('input[type="search"]'),
    ).nativeElement;
    input.value = term;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(queryParams$.value['q']).toBe(term);
  });

  it('restores the search box from the URL rather than opening blank on a shared link', async () => {
    const term = newText();
    queryParams$.next({ q: term });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(fixture.componentInstance.searchTerm()).toBe(term);
  });

  it('never fetches the list itself, on the first render or on a URL change', async () => {
    queryParams$.next({ q: newText() });
    data$.next({ products: mockProducts });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(mockService.getAll).not.toHaveBeenCalled();
  });

  it('reports a failed load instead of rendering an empty list as if nothing was owned', async () => {
    data$.next({ products: null });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    const alert = fixture.debugElement.query(By.css('#product-list-error'));
    expect(alert.nativeElement.textContent).toContain(PRODUCT_LIST_LOAD_ERROR);
    expect(fixture.componentInstance.products()).toEqual([]);
  });

  it('stays usable after a failed load, so one API error does not kill the page', async () => {
    data$.next({ products: null });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    data$.next({ products: mockProducts });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#product-list-error'))).toBeNull();
    expect(fixture.debugElement.queryAll(By.css(`[id^="${PRODUCT_ROW_ID_PREFIX}"]`)).length).toBe(mockProducts.length);
  });

  it('clicking Delete shows inline confirmation', () => {
    const deleteBtn = fixture.debugElement.query(By.css(`#${deleteProductId(0)}`));
    deleteBtn.nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.confirmingDeleteId()).toBe(mockProducts[0].id);
    expect(fixture.debugElement.query(By.css(`#${confirmDeleteProductId(0)}`))).toBeTruthy();
  });

  it('confirming delete calls ProductService.delete', () => {
    const deleteBtn = fixture.debugElement.query(By.css(`#${deleteProductId(0)}`));
    deleteBtn.nativeElement.click();
    fixture.detectChanges();

    const yesBtn = fixture.debugElement.query(By.css(`#${confirmDeleteProductId(0)}`));
    yesBtn.nativeElement.click();

    expect(mockService.delete).toHaveBeenCalledWith(mockProducts[0].id);
  });

  it('a failed delete surfaces an error and leaves the row in place', () => {
    const failedStatus = HttpStatusCode.InternalServerError;
    (mockService.delete as ReturnType<typeof vi.fn>).mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: failedStatus })),
    );

    const deleteBtn = fixture.debugElement.query(By.css(`#${deleteProductId(0)}`));
    deleteBtn.nativeElement.click();
    fixture.detectChanges();
    fixture.debugElement.query(By.css(`#${confirmDeleteProductId(0)}`)).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.products()).toEqual(mockProducts);
    const alert = fixture.debugElement.query(By.css('#product-list-error'));
    expect(alert).toBeTruthy();
    expect(alert.nativeElement.textContent).toContain(String(failedStatus));
  });
});
