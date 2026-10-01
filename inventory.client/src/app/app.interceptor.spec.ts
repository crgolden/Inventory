import { TestBed } from '@angular/core/testing';
import { HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { HttpRequest, HttpHeaders, HttpResponse } from '@angular/common/http';
import { appInterceptor } from './app.interceptor';
import { CSRF_HEADER, CSRF_HEADER_VALUE, HttpMethods } from './http-headers';
import { of } from 'rxjs';
import { newPathSegment } from '@crgolden/modules/testing';

describe('appInterceptor', () => {
  const interceptor: HttpInterceptorFn = (req, next) =>
    TestBed.runInInjectionContext(() => appInterceptor(req, next));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should set the X-CSRF header to 1', () => {
    const request = new HttpRequest(HttpMethods.get, `/${newPathSegment()}`, { headers: new HttpHeaders() });
    const forwarded: HttpRequest<unknown>[] = [];

    const next = (req: HttpRequest<unknown>) => {
      forwarded.push(req);
      return of(new HttpResponse({ status: HttpStatusCode.Ok }));
    };

    interceptor(request, next).subscribe();

    expect(forwarded.map((req) => req.headers.get(CSRF_HEADER))).toEqual([CSRF_HEADER_VALUE]);
  });
});
