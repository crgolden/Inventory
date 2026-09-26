import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Routes } from '@angular/router';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ProductNotFoundComponent } from './product-not-found.component';
import { AppPaths, PRODUCTS_URL } from '../../app/app-paths';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes: Routes = [{ path: AppPaths.products, component: DummyComponent }];

describe('ProductNotFoundComponent', () => {
  let fixture: ComponentFixture<ProductNotFoundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductNotFoundComponent],
      providers: [provideRouter(testRoutes)],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductNotFoundComponent);
    fixture.detectChanges();
  });

  it('renders the not-found heading', () => {
    expect(fixture.debugElement.query(By.css('#product-not-found-heading'))).toBeTruthy();
  });

  it('renders a link back to /products', () => {
    const link: HTMLAnchorElement = fixture.debugElement.query(By.css('#product-not-found-back-link')).nativeElement;
    expect(link.getAttribute('href')).toBe(PRODUCTS_URL);
  });
});
