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
import { ProductDetailActionLabels, ProductDetailComponent } from './product-detail.component';
import { By } from '@angular/platform-browser';
import { provideRouter, Routes, ActivatedRoute } from '@angular/router';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { InventoryItemView } from '../inventory-item.model';
import { AppPaths, PRODUCTS_URL } from '../../app/app-paths';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes: Routes = [
  { path: AppPaths.products, component: DummyComponent },
  { path: `${AppPaths.products}/${AppPaths.notFound}`, component: DummyComponent },
  { path: `${AppPaths.products}/:${newText()}/${AppPaths.edit}`, component: DummyComponent },
];

function newPrice(): number {
  return newCount() + newPercent() / LARGEST_PERCENT;
}

const mockProduct: InventoryItemView = {
  id: newId(),
  catalogProductId: newId(),
  name: newDisplayName(),
  brand: newText(),
  modelNumber: newText(),
  category: newText(),
  manualUrl: null,
  msrpPrice: newPrice(),
  serialNumber: newText(),
  purchaseDate: newUtcInstant(),
  pricePaid: newPrice(),
  description: null,
  createdAt: newUtcInstant(),
  updatedAt: null,
};

describe('ProductDetailComponent', () => {
  let fixture: ComponentFixture<ProductDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        provideRouter(testRoutes),
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

    fixture = TestBed.createComponent(ProductDetailComponent);
    fixture.detectChanges();
  });

  it('renders the product name', () => {
    const heading = fixture.debugElement.query(By.css('#product-detail-heading'));
    expect(heading.nativeElement.textContent).toContain(mockProduct.name);
  });

  it('renders brand, model number, and serial number', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(mockProduct.brand);
    expect(text).toContain(mockProduct.modelNumber);
    expect(text).toContain(mockProduct.serialNumber);
  });

  it('without manualUrl, shows a "Find Manual" link that routes to the edit form', () => {
    const editLink = fixture.debugElement.query(By.css('#edit-product-link'));

    expect(editLink.nativeElement.textContent.trim()).toBe(ProductDetailActionLabels.findManual);
    expect(editLink.nativeElement.getAttribute('href')).toBe(`${PRODUCTS_URL}/${mockProduct.id}/${AppPaths.edit}`);
  });
});

describe('ProductDetailComponent — with manualUrl', () => {
  let fixture: ComponentFixture<ProductDetailComponent>;

  const productWithManual: InventoryItemView = {
    ...mockProduct,
    manualUrl: newHttpsAddress(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        provideRouter(testRoutes),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => productWithManual.id },
              data: { product: productWithManual },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductDetailComponent);
    fixture.detectChanges();
  });

  it('renders "View Manual" button linking to manualUrl', () => {
    const link = fixture.debugElement.query(By.css('#view-manual-link'));
    expect(link.nativeElement.getAttribute('href')).toBe(productWithManual.manualUrl);
  });

  it('shows a plain "Edit" action instead of "Find Manual"', () => {
    const editLink = fixture.debugElement.query(By.css('#edit-product-link'));
    expect(editLink.nativeElement.textContent.trim()).toBe(ProductDetailActionLabels.edit);
  });
});
