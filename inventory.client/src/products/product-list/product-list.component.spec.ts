import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductListComponent } from './product-list.component';
import { ProductService } from '../product.service';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Data, Params, provideRouter, Router, Routes } from '@angular/router';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { InventoryItemView } from '../inventory-item.model';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes: Routes = [
  { path: 'products/new', component: DummyComponent },
  { path: 'products/:id', component: DummyComponent },
  { path: 'products/:id/edit', component: DummyComponent },
];

const mockProducts: InventoryItemView[] = [
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    catalogProductId: 'bbbbbbbb-0000-0000-0000-000000000001',
    name: 'TV',
    brand: 'LG',
    modelNumber: null,
    category: 'Electronics',
    manualUrl: null,
    msrpPrice: 1099.99,
    serialNumber: null,
    purchaseDate: null,
    pricePaid: 999.99,
    description: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
  },
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000002',
    catalogProductId: 'bbbbbbbb-0000-0000-0000-000000000002',
    name: 'Vacuum',
    brand: 'Dyson',
    modelNumber: null,
    category: 'Home',
    manualUrl: null,
    msrpPrice: null,
    serialNumber: null,
    purchaseDate: null,
    pricePaid: null,
    description: null,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: null,
  },
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
    const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(rows.length).toBe(2);
  });

  it('shows product name in row', () => {
    const firstRow = fixture.debugElement.queryAll(By.css('tbody tr'))[0];
    expect(firstRow.nativeElement.textContent).toContain('TV');
  });

  it('renders the search input', () => {
    const input = fixture.debugElement.query(By.css('input[type="search"]'));
    expect(input).toBeTruthy();
  });

  it('shows no-match message when the resolver answers an empty list', async () => {
    queryParams$.next({ q: 'xyz' });
    data$.next({ products: [] });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    const emptyState = fixture.debugElement.query(By.css('.empty-state'));
    expect(emptyState.nativeElement.textContent).toContain('xyz');
  });

  it('puts the search term in the URL so a filtered list can be shared, and so the resolver re-runs', async () => {
    const input: HTMLInputElement = fixture.debugElement.query(
      By.css('input[type="search"]'),
    ).nativeElement;
    input.value = 'dyson';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(queryParams$.value['q']).toBe('dyson');
  });

  it('restores the search box from the URL rather than opening blank on a shared link', async () => {
    queryParams$.next({ q: 'kettle' });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(fixture.componentInstance.searchTerm()).toBe('kettle');
  });

  it('never fetches the list itself, on the first render or on a URL change', async () => {
    queryParams$.next({ q: 'dyson' });
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
    expect(alert.nativeElement.textContent).toContain('Could not load your products');
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
    expect(fixture.debugElement.queryAll(By.css('tbody tr')).length).toBe(2);
  });

  it('clicking Delete shows inline confirmation', () => {
    const deleteBtn = fixture.debugElement.queryAll(By.css('button.btn-outline-danger'))[0];
    deleteBtn.nativeElement.click();
    fixture.detectChanges();

    const confirmText = fixture.debugElement.query(By.css('.text-danger'));
    expect(confirmText.nativeElement.textContent).toContain('Delete?');
  });

  it('confirming delete calls ProductService.delete', () => {
    const deleteBtn = fixture.debugElement.queryAll(By.css('button.btn-outline-danger'))[0];
    deleteBtn.nativeElement.click();
    fixture.detectChanges();

    const yesBtn = fixture.debugElement.query(By.css('button.btn-danger'));
    yesBtn.nativeElement.click();

    expect(mockService.delete).toHaveBeenCalledWith('aaaaaaaa-0000-0000-0000-000000000001');
  });

  it('a failed delete surfaces an error and leaves the row in place', () => {
    (mockService.delete as ReturnType<typeof vi.fn>).mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    const deleteBtn = fixture.debugElement.queryAll(By.css('button.btn-outline-danger'))[0];
    deleteBtn.nativeElement.click();
    fixture.detectChanges();
    fixture.debugElement.query(By.css('button.btn-danger')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.products().length).toBe(2);
    const alert = fixture.debugElement.query(By.css('#product-list-error'));
    expect(alert).toBeTruthy();
    expect(alert.nativeElement.textContent).toContain('500');
  });
});
