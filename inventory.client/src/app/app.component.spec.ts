import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { RouterOutlet } from '@angular/router';
import { NavMenuComponent } from '../nav-menu/nav-menu.component';
import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter, Routes } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';

@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: '' })
class DummyComponent {}

const testRoutes: Routes = [
  { path: '', component: DummyComponent },
  { path: 'user-session', component: DummyComponent },
];

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  const setup = async (isAuthenticated: boolean) => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterOutlet, NavMenuComponent],
      providers: [
        provideRouter(testRoutes),
        provideHttpClient(withXhr()),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: signal(isAuthenticated),
            isAnonymous: signal(!isAuthenticated),
            logoutUrl: signal(null),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('should create the app', async () => {
    await setup(false);
    expect(component).toBeTruthy();
  });

  it('should render nav-menu', async () => {
    await setup(false);
    const navMenu = fixture.debugElement.query(By.directive(NavMenuComponent));
    expect(navMenu).toBeTruthy();
  });

  it('should render router-outlet', async () => {
    await setup(false);
    const routerOutlet = fixture.debugElement.query(By.directive(RouterOutlet));
    expect(routerOutlet).toBeTruthy();
  });
});
