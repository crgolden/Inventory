import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  LARGEST_PERCENT,
  newCount,
  newDisplayName,
  newHttpsAddress,
  newId,
  newPercent,
  newText,
  newUtcInstant,
} from '@crgolden/modules/testing';
import { ProductFormComponent, sharedFactsNotSavedMessage } from './product-form.component';
import { ProductService } from '../product.service';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, Routes, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse, HttpStatusCode, provideHttpClient, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { of, throwError } from 'rxjs';
import { InventoryItemView } from '../inventory-item.model';
import { AngularFormEvents } from '../../testing/angular-constants';
import { AppPaths } from '../../app/app-paths';
import { ManualChatPanelComponent } from '../manual-chat/manual-chat-panel.component';
import { utcInstantToDateTimeLocalInput } from '../../datetime-local';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes: Routes = [
  { path: AppPaths.products, component: DummyComponent },
  { path: `${AppPaths.products}/:${newText()}`, component: DummyComponent },
  { path: `${AppPaths.products}/${AppPaths.notFound}`, component: DummyComponent },
];

function newWallClock(): string {
  const wallClock = utcInstantToDateTimeLocalInput(newUtcInstant());
  if (wallClock === null) {
    throw new Error('A generated instant must convert to a datetime-local value.');
  }
  return wallClock;
}

function newPrice(): number {
  return newCount() + newPercent() / LARGEST_PERCENT;
}

const CATALOG_PRODUCT_ID = newId();

const PURCHASED_WALL_CLOCK = newWallClock();
const PURCHASED_INSTANT = new Date(PURCHASED_WALL_CLOCK).toISOString();

const mockProduct: InventoryItemView = {
  id: newId(),
  catalogProductId: CATALOG_PRODUCT_ID,
  name: newDisplayName(),
  brand: newText(),
  modelNumber: newText(),
  category: newText(),
  manualUrl: null,
  msrpPrice: newPrice(),
  serialNumber: newText(),
  purchaseDate: PURCHASED_INSTANT,
  pricePaid: newPrice(),
  description: null,
  createdAt: newUtcInstant(),
  updatedAt: null,
};

interface MatchKey {
  name: string;
  brand: string;
  modelNumber: string;
}

function newMatchKey(): MatchKey {
  return { name: newDisplayName(), brand: newText(), modelNumber: newText() };
}

function typeInto(fixture: ComponentFixture<ProductFormComponent>, id: string, value: string): void {
  const input: HTMLInputElement = fixture.debugElement.query(By.css(id)).nativeElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function typeMatchKey(fixture: ComponentFixture<ProductFormComponent>, key: MatchKey): void {
  typeInto(fixture, '#name', key.name);
  typeInto(fixture, '#brand', key.brand);
  typeInto(fixture, '#modelNumber', key.modelNumber);
}

function submit(fixture: ComponentFixture<ProductFormComponent>): void {
  fixture.debugElement.query(By.css('#product-form')).triggerEventHandler(AngularFormEvents.ngSubmit);
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
    typeInto(fixture, '#name', newDisplayName());

    const btn = fixture.debugElement.query(By.css('button[type="submit"]'));
    expect(btn.nativeElement.disabled).toBe(true);
  });

  it('submit button is enabled once name, brand and model number are filled', () => {
    typeMatchKey(fixture, newMatchKey());

    const btn = fixture.debugElement.query(By.css('button[type="submit"]'));
    expect(btn.nativeElement.disabled).toBe(false);
  });

  it('submit calls ProductService.create in create mode', () => {
    const key = newMatchKey();
    typeMatchKey(fixture, key);

    submit(fixture);

    expect(mockService.create).toHaveBeenCalledWith(expect.objectContaining(key));
  });

  it('sends a chip-selected manual URL on submit, so choosing one is not silently discarded', () => {
    const chosen = newHttpsAddress();
    typeMatchKey(fixture, newMatchKey());

    fixture.componentInstance.onManualUrlSelected(chosen);
    fixture.detectChanges();
    submit(fixture);

    expect(mockService.create).toHaveBeenCalledWith(expect.objectContaining({ manualUrl: chosen }));
  });

  it('reads the purchase date as the local wall clock the user typed', () => {
    const typed = newWallClock();
    typeMatchKey(fixture, newMatchKey());
    typeInto(fixture, '#purchaseDate', typed);

    submit(fixture);

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
    const panel = fixture.debugElement.query(By.directive(ManualChatPanelComponent));
    expect(panel).toBeTruthy();
    expect(fixture.debugElement.query(By.css('#manual-chat-toggle'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('#manual-chat-panel'))).toBeNull();
  });

  it('onManualUrlSelected patches the manualUrl control and marks it dirty', () => {
    const component = fixture.componentInstance;
    const manualUrl = newHttpsAddress();
    component.onManualUrlSelected(manualUrl);
    expect(component.form.controls.manualUrl.value).toBe(manualUrl);
    expect(component.form.controls.manualUrl.dirty).toBe(true);
  });

  it('productContext() reflects the current form values', () => {
    const component = fixture.componentInstance;
    const key = newMatchKey();
    component.form.patchValue(key);
    fixture.detectChanges();
    const ctx = component.productContext();
    expect(ctx.name).toBe(key.name);
    expect(ctx.brand).toBe(key.brand);
    expect(ctx.modelNumber).toBe(key.modelNumber);
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
              paramMap: { get: () => mockProduct.id },
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
    expect(nameInput.value).toBe(mockProduct.name);
  });

  it('pre-populates what the owner paid and the shared list price into separate fields', () => {
    const pricePaid: HTMLInputElement = fixture.debugElement.query(
      By.css('#pricePaid'),
    ).nativeElement;
    const msrpPrice: HTMLInputElement = fixture.debugElement.query(
      By.css('#msrpPrice'),
    ).nativeElement;

    expect(pricePaid.value).toBe(String(mockProduct.pricePaid));
    expect(msrpPrice.value).toBe(String(mockProduct.msrpPrice));
  });

  it('pre-populates the purchase date as the local wall clock, in the format datetime-local accepts', () => {
    const purchaseDate: HTMLInputElement = fixture.debugElement.query(
      By.css('#purchaseDate'),
    ).nativeElement;

    expect(purchaseDate.value).toBe(PURCHASED_WALL_CLOCK);
  });

  it('sends nothing when nothing was touched', () => {
    submit(fixture);

    expect(mockService.patch).not.toHaveBeenCalled();
    expect(mockService.patchCatalogProduct).not.toHaveBeenCalled();
  });

  it('routes an owner-private edit to the inventory item alone', () => {
    const serialNumber = newText();
    typeInto(fixture, '#serialNumber', serialNumber);

    submit(fixture);

    expect(mockService.patch).toHaveBeenCalledWith(mockProduct.id, { serialNumber });
    expect(mockService.patchCatalogProduct).not.toHaveBeenCalled();
  });

  it('routes a shared catalog edit to the catalog product alone', () => {
    const brand = newText();
    typeInto(fixture, '#brand', brand);

    submit(fixture);

    expect(mockService.patchCatalogProduct).toHaveBeenCalledWith(CATALOG_PRODUCT_ID, { brand });
    expect(mockService.patch).not.toHaveBeenCalled();
  });

  it('sends only the touched fields, so one owner cannot blank another contributor’s facts', () => {
    const category = newDisplayName();
    typeInto(fixture, '#category', category);

    submit(fixture);

    expect(mockService.patchCatalogProduct).toHaveBeenCalledWith(CATALOG_PRODUCT_ID, { category });
  });

  it('converts an edited purchase date from the local wall clock back to a UTC instant', () => {
    const typed = newWallClock();
    typeInto(fixture, '#purchaseDate', typed);

    submit(fixture);

    expect(mockService.patch).toHaveBeenCalledWith(mockProduct.id, {
      purchaseDate: new Date(typed).toISOString(),
    });
  });

  it('leaves an untouched purchase date out of the payload, so it cannot drift by an offset per save', () => {
    const serialNumber = newText();
    typeInto(fixture, '#serialNumber', serialNumber);

    submit(fixture);

    expect(mockService.patch).toHaveBeenCalledWith(mockProduct.id, { serialNumber });
  });

  it('names which half survived when the shared write fails after the private one lands', () => {
    const refusedStatus = HttpStatusCode.Forbidden;
    (mockService.patchCatalogProduct as ReturnType<typeof vi.fn>).mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: refusedStatus })),
    );
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    typeInto(fixture, '#serialNumber', newText());
    typeInto(fixture, '#brand', newText());
    submit(fixture);
    fixture.detectChanges();

    const alert = fixture.debugElement.query(By.css('#product-form-error'));
    expect(alert.nativeElement.textContent).toContain(sharedFactsNotSavedMessage(refusedStatus));
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('productContext() includes the product id in edit mode', () => {
    const component = fixture.componentInstance;
    const ctx = component.productContext();
    expect(ctx.id).toBe(mockProduct.id);
    expect(ctx.name).toBe(mockProduct.name);
  });
});
