import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductListComponent } from './product-list.component';
import { ProductService } from '../product.service';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter, Routes } from '@angular/router';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { of, throwError } from 'rxjs';
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

  beforeEach(async () => {
    vi.useFakeTimers();

    mockService = {
      getAll: vi.fn(() => of(mockProducts)),
      delete: vi.fn(() => of(void 0)),
    };

    await TestBed.configureTestingModule({
      imports: [ProductListComponent],
      providers: [
        { provide: ProductService, useValue: mockService },
        provideRouter(testRoutes),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { products: mockProducts } } },
        },
      ],
    }).compileComponents();

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

  it('typing in the search input calls ProductService.getAll with the term', async () => {
    const input: HTMLInputElement = fixture.debugElement.query(
      By.css('input[type="search"]'),
    ).nativeElement;
    input.value = 'vacuum';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(mockService.getAll).toHaveBeenCalledWith('vacuum');
  });

  it('shows no-match message when search returns empty list', async () => {
    (mockService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(of([]));

    const input: HTMLInputElement = fixture.debugElement.query(
      By.css('input[type="search"]'),
    ).nativeElement;
    input.value = 'xyz';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await vi.runAllTimersAsync();
    fixture.detectChanges();

    const emptyState = fixture.debugElement.query(By.css('.empty-state'));
    expect(emptyState.nativeElement.textContent).toContain('xyz');
  });

  it('a failed search surfaces an error and stops the spinner instead of hanging on Loading', async () => {
    (mockService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    const input: HTMLInputElement = fixture.debugElement.query(
      By.css('input[type="search"]'),
    ).nativeElement;
    input.value = 'anything';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(false);
    const alert = fixture.debugElement.query(By.css('#product-list-error'));
    expect(alert.nativeElement.textContent).toContain('500');
  });

  it('stays searchable after a failed search, so one API error does not kill the page', async () => {
    (mockService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const input: HTMLInputElement = fixture.debugElement.query(
      By.css('input[type="search"]'),
    ).nativeElement;
    input.value = 'boom';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.runAllTimersAsync();

    (mockService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(of(mockProducts));
    input.value = 'tv';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(mockService.getAll).toHaveBeenLastCalledWith('tv');
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
