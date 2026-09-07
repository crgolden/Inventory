import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CatalogDetailComponent } from './catalog-detail.component';
import { By } from '@angular/platform-browser';
import { provideRouter, Routes, ActivatedRoute } from '@angular/router';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CatalogProduct } from '../catalog-product.model';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes: Routes = [{ path: 'catalog', component: DummyComponent }];

const mockProduct: CatalogProduct = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  name: 'Sony TV',
  brand: 'Sony',
  modelNumber: 'XR55A80K',
  category: 'Electronics',
  manualUrl: null,
  msrpPrice: 999.99,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: null,
};

const ownerPrivateFields = {
  ownerId: 'PRIVATE-OWNER-DO-NOT-RENDER',
  serialNumber: 'PRIVATE-SERIAL-DO-NOT-RENDER',
  purchaseDate: 'PRIVATE-PURCHASE-DATE-DO-NOT-RENDER',
  pricePaid: 'PRIVATE-PRICE-PAID-DO-NOT-RENDER',
  description: 'PRIVATE-DESCRIPTION-DO-NOT-RENDER',
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
    const h2 = fixture.debugElement.query(By.css('h2'));
    expect(h2.nativeElement.textContent).toContain('Sony TV');
  });

  it('renders the universal catalog facts', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Sony');
    expect(text).toContain('XR55A80K');
    expect(text).toContain('Electronics');
    expect(text).toContain('999.99');
  });

  it('shows a Back to Catalog link', () => {
    const backLink = fixture.debugElement.query(By.css('a.btn-outline-secondary'));
    expect(backLink).toBeTruthy();
    expect(backLink.nativeElement.textContent).toContain('Back to Catalog');
  });

  it('does not show Edit or Delete buttons', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Edit');
    expect(text).not.toContain('Delete');
  });

  it('does not show View Manual button when manualUrl is null', () => {
    const manualBtn = fixture.debugElement.query(By.css('a.btn-primary'));
    expect(manualBtn).toBeNull();
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
    expect(text).toContain('XR55A80K');
    for (const value of Object.values(ownerPrivateFields)) {
      expect(text).not.toContain(value);
    }
  });
});

describe('CatalogDetailComponent — with manualUrl', () => {
  let fixture: ComponentFixture<CatalogDetailComponent>;

  const productWithManual: CatalogProduct = {
    ...mockProduct,
    manualUrl: 'https://example.com/sony-tv-manual.pdf',
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
    const link = fixture.debugElement.query(By.css('a.btn-primary[target="_blank"]'));
    expect(link).toBeTruthy();
    expect(link.nativeElement.getAttribute('href')).toBe(productWithManual.manualUrl);
    expect(link.nativeElement.textContent).toContain('View Manual');
  });
});
