import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserSessionComponent } from './user-session.component';
import { signal, WritableSignal } from '@angular/core';
import { AuthService, Claim, Session } from '../auth/auth.service';
import { By } from '@angular/platform-browser';
import { newText } from '@crgolden/modules/testing';
import {
  USER_SESSION_CLAIM_TYPE_ID_PREFIX,
  USER_SESSION_CLAIM_VALUE_ID_PREFIX,
  USER_SESSION_ROW_ID_PREFIX,
} from './user-session-ids';

describe('UserSessionComponent', () => {
  let component: UserSessionComponent;
  let fixture: ComponentFixture<UserSessionComponent>;
  let mockAuthService: Partial<AuthService>;
  let mockSession: WritableSignal<Session>;
  let mockIsAuthenticated: WritableSignal<boolean>;
  let mockIsAnonymous: WritableSignal<boolean>;

  beforeEach(async () => {
    mockSession = signal<Session>([]);
    mockIsAuthenticated = signal(false);
    mockIsAnonymous = signal(true);

    mockAuthService = {
      session: mockSession,
      isAuthenticated: mockIsAuthenticated,
      isAnonymous: mockIsAnonymous,
    };
    await TestBed.configureTestingModule({
      imports: [UserSessionComponent], providers: [{
        provide: AuthService, useValue: mockAuthService
      }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserSessionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display "Loading..." when anonymous', () => {
    mockIsAnonymous.set(true);
    mockIsAuthenticated.set(false);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#user-session-loading'))).toBeTruthy();

    const tableElement = fixture.debugElement.query(By.css('#user-session-table'));
    expect(tableElement).toBeNull();
  });

  it('should display the table with claims when authenticated', () => {
    const testClaims: Claim[] = [
      { type: newText(), value: newText() },
      { type: newText(), value: newText() },
    ];
    mockSession.set(testClaims);
    mockIsAnonymous.set(false);
    mockIsAuthenticated.set(true);
    fixture.detectChanges();

    const tableElement = fixture.debugElement.query(By.css('#user-session-table'));
    expect(tableElement).toBeTruthy();

    const rows = fixture.debugElement.queryAll(By.css(`[id^="${USER_SESSION_ROW_ID_PREFIX}"]`));
    expect(rows.length).toBe(testClaims.length);

    const renderedTypes = fixture.debugElement
      .queryAll(By.css(`[id^="${USER_SESSION_CLAIM_TYPE_ID_PREFIX}"]`))
      .map(cell => (cell.nativeElement.textContent as string).trim());
    const renderedValues = fixture.debugElement
      .queryAll(By.css(`[id^="${USER_SESSION_CLAIM_VALUE_ID_PREFIX}"]`))
      .map(cell => (cell.nativeElement.textContent as string).trim());

    expect(renderedTypes).toEqual(testClaims.map(claim => claim.type));
    expect(renderedValues).toEqual(testClaims.map(claim => claim.value));
  });

  it('should display "No claims available" when authenticated but session is empty', () => {
    mockSession.set([]);
    mockIsAuthenticated.set(true);
    mockIsAnonymous.set(false);
    fixture.detectChanges();

    const tableElement = fixture.debugElement.query(By.css('#user-session-table'));
    expect(tableElement).toBeTruthy();

    expect(fixture.debugElement.query(By.css('#user-session-no-claims'))).toBeTruthy();
  });
});
