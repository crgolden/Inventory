import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavMenuComponent } from './nav-menu.component';
import { AuthService } from '../auth/auth.service';
import { By } from '@angular/platform-browser';
import { provideRouter, Routes } from '@angular/router';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { AppPaths } from '../app/app-paths';
import { newPathSegment } from '@crgolden/modules/testing';

const LOGOUT_URL = `/${newPathSegment()}`;

describe('NavMenuComponent', () => {
  let component: NavMenuComponent;
  let fixture: ComponentFixture<NavMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavMenuComponent],
      providers: [{ provide: AuthService, useClass: AuthServiceStub }, provideRouter(testRoutes)],
    }).compileComponents();

    fixture = TestBed.createComponent(NavMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle isExpanded when toggle is called', () => {
    expect(component.isExpanded()).toBe(false);
    component.toggle();
    expect(component.isExpanded()).toBe(true);
    component.toggle();
    expect(component.isExpanded()).toBe(false);
  });

  it('marks the collapsible list open when toggled, so it shows below the sm breakpoint', () => {
    component.toggle();
    fixture.detectChanges();
    const collapsible = fixture.debugElement.query(By.css('#nav-collapse'));
    expect(collapsible.nativeElement.getAttribute('data-open')).toBe(String(true));
  });

  it('should collapse when collapse is called', () => {
    component.isExpanded.set(true);
    component.collapse();
    expect(component.isExpanded()).toBe(false);
  });

  it('should render signout link when authenticated', () => {
    fixture.detectChanges();
    const signoutLink = fixture.debugElement.query(By.css('#nav-signout'));
    expect(signoutLink.nativeElement.getAttribute('href')).toBe(LOGOUT_URL);
  });
});
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class DummyComponent {}
const testRoutes: Routes = [
  { path: '', component: DummyComponent },
  { path: AppPaths.products, component: DummyComponent },
];

class AuthServiceStub {
  isAuthenticated = () => true;
  isAnonymous = () => false;
  logoutUrl = () => LOGOUT_URL;
}
