import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductFormComponent } from './product-form.component';
import { ProductService } from '../product.service';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, Routes, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse, provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { of, throwError } from 'rxjs';
import { InventoryItemView } from '../inventory-item.model';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes: Routes = [
  { path: 'products', component: DummyComponent },
  { path: 'products/:id', component: DummyComponent },
  { path: 'products/not-found', component: DummyComponent },
];

const CATALOG_PRODUCT_ID = 'bbbbbbbb-0000-0000-0000-000000000042';

const PURCHASED_WALL_CLOCK = '2024-01-15T09:00';
const PURCHASED_INSTANT = new Date(PURCHASED_WALL_CLOCK).toISOString();

const mockProduct: InventoryItemView = {
  id: 'aaaaaaaa-0000-0000-0000-000000000042',
  catalogProductId: CATALOG_PRODUCT_ID,
  name: 'Test TV',
  brand: 'Sony',
  modelNumber: 'X90L',
  category: 'Electronics',
  manualUrl: null,
  msrpPrice: 1499.99,
  serialNumber: 'SN-001',
  purchaseDate: PURCHASED_INSTANT,
  pricePaid: 999.99,
  description: null,
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: null,
};

function typeInto(fixture: ComponentFixture<ProductFormComponent>, id: string, value: string): void {
  const input: HTMLInputElement = fixture.debugElement.query(By.css(id)).nativeElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

describe('ProductFormComponent — create mode', () => {
  let fixture: ComponentFixture<ProductFormComponent>;
  let mockService: Partial<ProductService>;

  beforeEach(async () => {
    mockService = {
      getById: vi.fn(),
      create: vi.fn(() => of(mockProduct.id)),
      patch: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ProductFormComponent],
      providers: [
        { provide: ProductService, useValue: mockService },
        provideRouter(testRoutes),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductFormComponent);
    fixture.detectChanges();
  });

  it('submit button is disabled when name is empty', () => {
    const btn = fixture.debugElement.query(By.css('button[type="submit"]'));
    expect(btn.nativeElement.disabled).toBe(true);
  });

  it('submit button stays disabled when only the name is filled, since the match key needs brand and model', () => {
    typeInto(fixture, '#name', 'My Product');

    const btn = fixture.debugElement.query(By.css('button[type="submit"]'));
    expect(btn.nativeElement.disabled).toBe(true);
  });

  it('submit button is enabled once name, brand and model number are filled', () => {
    typeInto(fixture, '#name', 'My Product');
    typeInto(fixture, '#brand', 'Acme');
    typeInto(fixture, '#modelNumber', 'AC-1');

    const btn = fixture.debugElement.query(By.css('button[type="submit"]'));
    expect(btn.nativeElement.disabled).toBe(false);
  });

  it('submit calls ProductService.create in create mode', () => {
    typeInto(fixture, '#name', 'My Product');
    typeInto(fixture, '#brand', 'Acme');
    typeInto(fixture, '#modelNumber', 'AC-1');

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');

    expect(mockService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Product', brand: 'Acme', modelNumber: 'AC-1' }),
    );
  });

  it('reads the purchase date as the local wall clock the user typed', () => {
    const typed = '2024-03-04T17:45';
    typeInto(fixture, '#name', 'My Product');
    typeInto(fixture, '#brand', 'Acme');
    typeInto(fixture, '#modelNumber', 'AC-1');
    typeInto(fixture, '#purchaseDate', typed);

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');

    expect(mockService.create).toHaveBeenCalledWith(
      expect.objectContaining({ purchaseDate: new Date(typed).toISOString() }),
    );
  });

  it('renders separate controls for what the owner paid and the shared list price', () => {
    expect(fixture.debugElement.query(By.css('#pricePaid'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('#msrpPrice'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('#price'))).toBeNull();
  });

  it('embeds the manual-chat panel (collapsed by default)', () => {
    const panel = fixture.debugElement.query(By.css('app-manual-chat-panel'));
    expect(panel).toBeTruthy();
    expect(fixture.debugElement.query(By.css('button.manual-chat-toggle'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.manual-chat-panel'))).toBeNull();
  });

  it('onManualUrlSelected patches the manualUrl control and marks it dirty', () => {
    const component = fixture.componentInstance;
    component.onManualUrlSelected('https://example.com/manual.pdf');
    expect(component.form.controls.manualUrl.value).toBe('https://example.com/manual.pdf');
    expect(component.form.controls.manualUrl.dirty).toBe(true);
  });

  it('productContext() reflects the current form values', () => {
    const component = fixture.componentInstance;
    component.form.patchValue({ name: 'My Laptop', brand: 'Dell', modelNumber: 'XPS-15' });
    fixture.detectChanges();
    const ctx = component.productContext();
    expect(ctx.name).toBe('My Laptop');
    expect(ctx.brand).toBe('Dell');
    expect(ctx.modelNumber).toBe('XPS-15');
    expect(ctx.id).toBeNull();
  });
});

describe('ProductFormComponent — edit mode', () => {
  let fixture: ComponentFixture<ProductFormComponent>;
  let mockService: Partial<ProductService>;

  beforeEach(async () => {
    mockService = {
      getById: vi.fn(),
      create: vi.fn(),
      patch: vi.fn(() => of<void>(undefined)),
      patchCatalogProduct: vi.fn(() => of<void>(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [ProductFormComponent],
      providers: [
        { provide: ProductService, useValue: mockService },
        provideRouter(testRoutes),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'aaaaaaaa-0000-0000-0000-000000000042' },
              data: { product: mockProduct },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductFormComponent);
    fixture.detectChanges();
  });

  it('pre-populates the name field from the existing product', () => {
    const nameInput: HTMLInputElement = fixture.debugElement.query(By.css('#name')).nativeElement;
    expect(nameInput.value).toBe('Test TV');
  });

  it('pre-populates what the owner paid and the shared list price into separate fields', () => {
    const pricePaid: HTMLInputElement = fixture.debugElement.query(
      By.css('#pricePaid'),
    ).nativeElement;
    const msrpPrice: HTMLInputElement = fixture.debugElement.query(
      By.css('#msrpPrice'),
    ).nativeElement;

    expect(pricePaid.value).toBe('999.99');
    expect(msrpPrice.value).toBe('1499.99');
  });

  it('pre-populates the purchase date as the local wall clock, in the format datetime-local accepts', () => {
    const purchaseDate: HTMLInputElement = fixture.debugElement.query(
      By.css('#purchaseDate'),
    ).nativeElement;

    expect(purchaseDate.value).toBe(PURCHASED_WALL_CLOCK);
  });

  it('sends nothing when nothing was touched', () => {
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');

    expect(mockService.patch).not.toHaveBeenCalled();
    expect(mockService.patchCatalogProduct).not.toHaveBeenCalled();
  });

  it('routes an owner-private edit to the inventory item alone', () => {
    typeInto(fixture, '#serialNumber', 'SN-002');

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');

    expect(mockService.patch).toHaveBeenCalledWith('aaaaaaaa-0000-0000-0000-000000000042', {
      serialNumber: 'SN-002',
    });
    expect(mockService.patchCatalogProduct).not.toHaveBeenCalled();
  });

  it('routes a shared catalog edit to the catalog product alone', () => {
    typeInto(fixture, '#brand', 'Panasonic');

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');

    expect(mockService.patchCatalogProduct).toHaveBeenCalledWith(CATALOG_PRODUCT_ID, {
      brand: 'Panasonic',
    });
    expect(mockService.patch).not.toHaveBeenCalled();
  });

  it('sends only the touched fields, so one owner cannot blank another contributor’s facts', () => {
    typeInto(fixture, '#category', 'Home Theatre');

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');

    expect(mockService.patchCatalogProduct).toHaveBeenCalledWith(CATALOG_PRODUCT_ID, {
      category: 'Home Theatre',
    });
  });

  it('converts an edited purchase date from the local wall clock back to a UTC instant', () => {
    const typed = '2024-01-15T11:30';
    typeInto(fixture, '#purchaseDate', typed);

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');

    expect(mockService.patch).toHaveBeenCalledWith('aaaaaaaa-0000-0000-0000-000000000042', {
      purchaseDate: new Date(typed).toISOString(),
    });
  });

  it('leaves an untouched purchase date out of the payload, so it cannot drift by an offset per save', () => {
    typeInto(fixture, '#serialNumber', 'SN-002');

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');

    expect(mockService.patch).toHaveBeenCalledWith('aaaaaaaa-0000-0000-0000-000000000042', {
      serialNumber: 'SN-002',
    });
  });

  it('names which half survived when the shared write fails after the private one lands', () => {
    (mockService.patchCatalogProduct as ReturnType<typeof vi.fn>).mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    typeInto(fixture, '#serialNumber', 'SN-002');
    typeInto(fixture, '#brand', 'Panasonic');
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');
    fixture.detectChanges();

    const alert = fixture.debugElement.query(By.css('.alert-danger'));
    expect(alert.nativeElement.textContent).toContain('shared product facts were not');
    expect(alert.nativeElement.textContent).toContain('403');
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('productContext() includes the product id in edit mode', () => {
    const component = fixture.componentInstance;
    const ctx = component.productContext();
    expect(ctx.id).toBe('aaaaaaaa-0000-0000-0000-000000000042');
    expect(ctx.name).toBe('Test TV');
  });
});
