import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomeComponent } from './home.component';
import { AuthService } from '../auth/auth.service';
import { By } from '@angular/platform-browser';
import { provideRouter, Routes } from '@angular/router';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { signal } from '@angular/core';
import { AppPaths, PRODUCTS_URL } from '../app/app-paths';
import { BFF_LOGIN_URL } from '../auth/auth-contract';
import { BENEFIT_CARD_ID_PREFIX } from './home-ids';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes: Routes = [
  { path: '', component: DummyComponent },
  { path: AppPaths.products, component: DummyComponent },
];

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;

  const setup = async (isAuthenticated: boolean) => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: signal(isAuthenticated) } },
        provideRouter(testRoutes),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
  };

  it('renders the hero headline', async () => {
    await setup(false);
    expect(fixture.debugElement.query(By.css('#home-heading'))).toBeTruthy();
  });

  it('renders a card for every benefit', async () => {
    await setup(false);
    const cards = fixture.debugElement.queryAll(By.css(`[id^="${BENEFIT_CARD_ID_PREFIX}"]`));
    expect(cards.length).toBe(fixture.componentInstance.benefits.length);
  });

  it('shows login CTA when anonymous', async () => {
    await setup(false);
    const loginLink = fixture.debugElement.query(By.css('#home-login-link'));
    expect(loginLink.nativeElement.getAttribute('href')).toBe(BFF_LOGIN_URL);
    expect(fixture.debugElement.query(By.css('#my-products-link'))).toBeNull();
  });

  it('shows products link when authenticated', async () => {
    await setup(true);
    const productsLink = fixture.debugElement.query(By.css('#my-products-link'));
    expect(productsLink.nativeElement.getAttribute('href')).toBe(PRODUCTS_URL);
    expect(fixture.debugElement.query(By.css('#home-login-link'))).toBeNull();
  });
});
