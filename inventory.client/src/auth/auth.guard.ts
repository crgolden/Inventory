import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { BFF_LOGIN_URL } from './auth-contract';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  if (authService.isAuthenticated()) {
    return true;
  }
  globalThis.location.href = BFF_LOGIN_URL;
  return false;
};
