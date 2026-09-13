import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CatalogListComponent } from './catalog-list.component';
import { CatalogService } from '../catalog.service';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Params, provideRouter, Router, Routes } from '@angular/router';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogProduct } from '../catalog-product.model';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes: Routes = [{ path: 'catalog/:id', component: DummyComponent }];

const mockProducts: CatalogProduct[] = [
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    name: 'Apple TV',
    brand: 'Apple',
    modelNumber: null,
    category: 'Electronics',
    manualUrl: null,
    msrpPrice: 129.99,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
  },
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000002',
    name: 'Dyson V15',
    brand: 'Dyson',
    modelNumber: null,
    category: 'Home',
    manualUrl: null,
    msrpPrice: 499.99,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: null,
  },
];

describe('CatalogListComponent', () => {
  let fixture: ComponentFixture<CatalogListComponent>;
  let mockService: Partial<CatalogService>;
  let queryParams$: BehaviorSubject<Params>;

  beforeEach(async () => {
    vi.useFakeTimers();

    mockService = {
      getAll: vi.fn(() => of({ items: mockProducts, total: 2 })),
    };

    queryParams$ = new BehaviorSubject<Params>({});

    await TestBed.configureTestingModule({
      imports: [CatalogListComponent],
      providers: [
        { provide: CatalogService, useValue: mockService },
        provideRouter(testRoutes),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { catalog: { items: mockProducts, total: 2 } }, queryParams: {} },
            get queryParams() {
              return queryParams$.asObservable();
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

    fixture = TestBed.createComponent(CatalogListComponent);
    fixture.detectChanges();
    await vi.runAllTimersAsync();
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a row for each catalog item', () => {
    const rows = fixture.debugElement.queryAll(By.css('tbody tr'));
    expect(rows.length).toBe(2);
  });

  it('shows product name in row', () => {
    const firstRow = fixture.debugElement.queryAll(By.css('tbody tr'))[0];
    expect(firstRow.nativeElement.textContent).toContain('Apple TV');
  });

  it('renders the search input', () => {
    const input = fixture.debugElement.query(By.css('input[type="search"]'));
    expect(input).toBeTruthy();
  });

  it('shows showing text with total count', () => {
    const text = fixture.debugElement.query(By.css('small.text-muted'));
    expect(text.nativeElement.textContent).toContain('of 2');
  });

  it('Previous Page is an inert control on the first page', () => {
    const prev = fixture.debugElement.query(By.css('#catalog-prev-page'));
    expect(prev.nativeElement.tagName).toBe('BUTTON');
    expect(prev.nativeElement.disabled).toBe(true);
  });

  it('Next Page is an inert control when total fits on one page', () => {
    const next = fixture.debugElement.query(By.css('#catalog-next-page'));
    expect(next.nativeElement.tagName).toBe('BUTTON');
    expect(next.nativeElement.disabled).toBe(true);
  });

  it('offers every column header as a link rather than a click handler', () => {
    const headers = fixture.debugElement.queryAll(By.css('thead a'));
    expect(headers.length).toBe(4);
    expect(fixture.debugElement.queryAll(By.css('thead button')).length).toBe(0);
  });

  it('the Name header offers descending once Name is the active ascending sort', () => {
    expect(fixture.componentInstance.sortParams('Name')).toEqual({
      orderBy: null,
      orderDir: 'desc',
      page: null,
    });
  });

  it('a different column offers ascending, and drops orderDir rather than writing the default', () => {
    expect(fixture.componentInstance.sortParams('Brand')).toEqual({
      orderBy: 'Brand',
      orderDir: null,
      page: null,
    });
  });

  it('asks for the order the URL names', async () => {
    queryParams$.next({ orderBy: 'Brand', orderDir: 'desc' });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(mockService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: 'Brand', orderDir: 'desc' }),
    );
  });

  it('falls back to the default order when the URL names a column that does not exist', async () => {
    queryParams$.next({ orderBy: 'Nonsense', orderDir: 'sideways' });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(mockService.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: 'Name', orderDir: 'asc' }),
    );
  });

  it('typing in the search input calls getAll with the term after debounce', async () => {
    const input: HTMLInputElement = fixture.debugElement.query(
      By.css('input[type="search"]'),
    ).nativeElement;
    input.value = 'dyson';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(mockService.getAll).toHaveBeenCalledWith(expect.objectContaining({ search: 'dyson' }));
  });

  it('shows no-match message when search returns empty list', async () => {
    (mockService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(of({ items: [], total: 0 }));

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

  it('a failed load surfaces an error and stops the spinner instead of hanging on Loading', async () => {
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
    const alert = fixture.debugElement.query(By.css('#catalog-error'));
    expect(alert.nativeElement.textContent).toContain('500');
  });

  it('stays usable after a failed load, so one API error does not kill the page', async () => {
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

    (mockService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(
      of({ items: mockProducts, total: 2 }),
    );
    input.value = 'dyson';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#catalog-error'))).toBeNull();
    expect(fixture.debugElement.queryAll(By.css('tbody tr')).length).toBe(2);
  });

  it('Next Page becomes a link carrying page 2 when the total exceeds one page', () => {
    fixture.componentInstance.total.set(25);
    fixture.detectChanges();

    const next = fixture.debugElement.query(By.css('#catalog-next-page'));
    expect(next.nativeElement.tagName, 'a page turn is a link, not a click handler').toBe('A');
    expect(fixture.componentInstance.pageParams(2)).toEqual({ page: 2 });
  });

  it('drops the page parameter rather than writing page=1, so the first page has one URL', () => {
    expect(fixture.componentInstance.pageParams(1)).toEqual({ page: null });
  });

  it('asks for the page the URL names', async () => {
    (mockService.getAll as ReturnType<typeof vi.fn>).mockReturnValue(
      of({ items: mockProducts, total: 25 }),
    );

    queryParams$.next({ page: '2' });
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(mockService.getAll).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    expect(fixture.componentInstance.page()).toBe(2);
  });

  it('does not refetch the page the resolver already answered for this URL', () => {
    expect(mockService.getAll).not.toHaveBeenCalled();
  });
});
