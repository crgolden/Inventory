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
import { CatalogDetailComponent } from './catalog-detail.component';
import { By } from '@angular/platform-browser';
import { provideRouter, Routes, ActivatedRoute } from '@angular/router';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CatalogProduct } from '../catalog-product.model';
import { AppPaths, CATALOG_URL } from '../../app/app-paths';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes: Routes = [{ path: AppPaths.catalog, component: DummyComponent }];

const mockProduct: CatalogProduct = {
  id: newId(),
  name: newDisplayName(),
  brand: newText(),
  modelNumber: newText(),
  category: newText(),
  manualUrl: null,
  msrpPrice: newCount() + newPercent() / LARGEST_PERCENT,
  createdAt: newUtcInstant(),
  updatedAt: null,
};

const ownerPrivateFields = {
  ownerId: newText(),
  serialNumber: newText(),
  purchaseDate: newText(),
  pricePaid: newText(),
  description: newText(),
};

describe('CatalogDetailComponent', () => {
  let fixture: ComponentFixture<CatalogDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogDetailComponent],
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

    fixture = TestBed.createComponent(CatalogDetailComponent);
    fixture.detectChanges();
  });

  it('renders the product name', () => {
    const heading = fixture.debugElement.query(By.css('#catalog-detail-heading'));
    expect(heading.nativeElement.textContent).toContain(mockProduct.name);
  });

  it('renders the universal catalog facts', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(mockProduct.brand);
    expect(text).toContain(mockProduct.modelNumber);
    expect(text).toContain(mockProduct.category);
    expect(text).toContain(String(mockProduct.msrpPrice));
  });

  it('shows a Back to Catalog link', () => {
    const backLink = fixture.debugElement.query(By.css('#catalog-back-link'));
    expect(backLink.nativeElement.getAttribute('href')).toBe(CATALOG_URL);
  });

  it('offers no owner actions on the public page', () => {
    expect(fixture.debugElement.query(By.css('#edit-product-link'))).toBeNull();
    expect(fixture.debugElement.queryAll(By.css('button'))).toEqual([]);
  });

  it('does not show View Manual button when manualUrl is null', () => {
    expect(fixture.debugElement.query(By.css('#catalog-view-manual-link'))).toBeNull();
  });
});

describe('CatalogDetailComponent — resolved data carrying owner-private fields', () => {
  let fixture: ComponentFixture<CatalogDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogDetailComponent],
      providers: [
        provideRouter(testRoutes),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => mockProduct.id },
              data: { product: { ...mockProduct, ...ownerPrivateFields } },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CatalogDetailComponent);
    fixture.detectChanges();
  });

  it('renders none of them, so the public page cannot leak another owner', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(mockProduct.modelNumber);
    for (const value of Object.values(ownerPrivateFields)) {
      expect(text).not.toContain(value);
    }
  });
});

describe('CatalogDetailComponent — with manualUrl', () => {
  let fixture: ComponentFixture<CatalogDetailComponent>;

  const productWithManual: CatalogProduct = {
    ...mockProduct,
    manualUrl: newHttpsAddress(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogDetailComponent],
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

    fixture = TestBed.createComponent(CatalogDetailComponent);
    fixture.detectChanges();
  });

  it('renders the View Manual button linking to manualUrl', () => {
    const link = fixture.debugElement.query(By.css('#catalog-view-manual-link'));
    expect(link.nativeElement.getAttribute('href')).toBe(productWithManual.manualUrl);
  });
});
