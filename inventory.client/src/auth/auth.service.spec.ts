import { TestBed } from '@angular/core/testing';
import { AuthService, Claim, Session } from './auth.service';
import { BFF_USER_PATH, LOGOUT_URL_CLAIM_TYPE, NAME_CLAIM_TYPE } from './auth-contract';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { newDisplayName, newPathSegment, newText } from '@crgolden/modules/testing';
import { HttpMethods } from '../app/http-headers';
import { DuendeBffClaimTypes } from '../testing/duende-bff-constants';

describe('AuthService', () => {
  let service: AuthService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(withXhr()), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created without making any HTTP requests', () => {
    expect(service).toBeTruthy();
    httpTestingController.expectNone(BFF_USER_PATH);
  });

  it('should return session data after initialize', async () => {
    const username = newDisplayName();
    const logoutUrl = `/${newPathSegment()}`;
    const mockSession: Session = [
      { type: NAME_CLAIM_TYPE, value: username },
      { type: LOGOUT_URL_CLAIM_TYPE, value: logoutUrl },
    ];

    const result = firstValueFrom(service.initialize());
    const req = httpTestingController.expectOne(BFF_USER_PATH);
    expect(req.request.method).toBe(HttpMethods.get);
    req.flush(mockSession);
    await result;

    expect(service.isAuthenticated()).toBe(true);
    expect(service.isAnonymous()).toBe(false);
    expect(service.username()).toBe(username);
    expect(service.logoutUrl()).toBe(logoutUrl);
  });

  it('should be unauthenticated on HTTP error', async () => {
    const result = firstValueFrom(service.initialize());
    const req = httpTestingController.expectOne(BFF_USER_PATH);
    req.error(new ProgressEvent(newText()));
    await result;

    expect(service.isAuthenticated()).toBe(false);
    expect(service.isAnonymous()).toBe(true);
    expect(service.username()).toBeNull();
    expect(service.logoutUrl()).toBeNull();
    expect(service.session()).toEqual([]);
  });

  it('should not make a new HTTP request when reading session signal after initialize', async () => {
    const mockSession: Session = [{ type: NAME_CLAIM_TYPE, value: newDisplayName() }];

    const result = firstValueFrom(service.initialize());
    const req = httpTestingController.expectOne(BFF_USER_PATH);
    req.flush(mockSession);
    await result;

    service.session();
    httpTestingController.expectNone(BFF_USER_PATH);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should re-fetch on refresh', async () => {
    const refreshedUsername = newDisplayName();
    const mockSession1: Session = [{ type: NAME_CLAIM_TYPE, value: newDisplayName() }];
    const mockSession2: Session = [{ type: NAME_CLAIM_TYPE, value: refreshedUsername }];

    const init = firstValueFrom(service.initialize());
    httpTestingController.expectOne(BFF_USER_PATH).flush(mockSession1);
    await init;

    service.refresh();
    httpTestingController.expectOne(BFF_USER_PATH).flush(mockSession2);

    expect(service.username()).toBe(refreshedUsername);
  });

  it('should treat empty session array as authenticated', async () => {
    const result = firstValueFrom(service.initialize());
    httpTestingController.expectOne(BFF_USER_PATH).flush([]);
    await result;

    expect(service.isAuthenticated()).toBe(true);
    expect(service.isAnonymous()).toBe(false);
    expect(service.session()).toEqual([]);
    expect(service.username()).toBeNull();
    expect(service.logoutUrl()).toBeNull();
  });

  it('should return logoutUrl as-is when sid claim is present', async () => {
    const sessionId = newText();
    const logoutUrl = `/${newPathSegment()}?${new URLSearchParams({ [DuendeBffClaimTypes.sessionId]: sessionId }).toString()}`;
    const mockSession: Claim[] = [
      { type: LOGOUT_URL_CLAIM_TYPE, value: logoutUrl },
      { type: DuendeBffClaimTypes.sessionId, value: sessionId },
    ];

    const result = firstValueFrom(service.initialize());
    httpTestingController.expectOne(BFF_USER_PATH).flush(mockSession);
    await result;

    expect(service.logoutUrl()).toBe(logoutUrl);
  });
});
