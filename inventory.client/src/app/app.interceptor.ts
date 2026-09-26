import { HttpInterceptorFn } from '@angular/common/http';
import { CSRF_HEADER, CSRF_HEADER_VALUE, REQUEST_ID_HEADER } from './http-headers';

export const appInterceptor: HttpInterceptorFn = (req, next) => {
  const headers = req.headers.set(CSRF_HEADER, CSRF_HEADER_VALUE).set(REQUEST_ID_HEADER, crypto.randomUUID());
  const modifiedRequest = req.clone({
    withCredentials: true,
    headers: headers
  });
  return next(modifiedRequest);
};
