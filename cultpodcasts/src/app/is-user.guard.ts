import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, filter, map, of, switchMap, take } from 'rxjs';
import { AuthServiceWrapper } from './auth-service-wrapper.class';

/** Same SSR/browser split as hasRoleGuard — never bounce on the server FakeAuth session. */
export const isUserGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const router = inject(Router);
  const auth = inject(AuthServiceWrapper).authService;

  if (!auth?.isLoading$ || !auth.user$) {
    void router.navigate(['/unauthorised']);
    return of(false);
  }

  return auth.isLoading$.pipe(
    filter((loading) => !loading),
    take(1),
    switchMap(() => auth.user$),
    take(1),
    map((user) => {
      if (user) {
        return true;
      }
      void router.navigate(['/unauthorised']);
      return false;
    }),
    catchError(() => {
      void router.navigate(['/unauthorised']);
      return of(false);
    })
  );
};
