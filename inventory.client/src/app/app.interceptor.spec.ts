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
    let modifiedReq: HttpRequest<unknown> | undefined;

    const next = (req: HttpRequest<unknown>) => {
      modifiedReq = req;
      return of(new HttpResponse({ status: HttpStatusCode.Ok }));
    };

    interceptor(request, next).subscribe(() => {
      if (modifiedReq === undefined) {
        throw new Error('The interceptor never forwarded a request to the next handler.');
      }

      expect(modifiedReq.headers.get(CSRF_HEADER)).toBe(CSRF_HEADER_VALUE);
    });
  });
});
