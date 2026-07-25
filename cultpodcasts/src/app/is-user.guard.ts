import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, filter, map, of, switchMap, take } from 'rxjs';
import { AuthServiceWrapper } from './auth-service-wrapper.class';

/** Same loading gate as hasRoleGuard — avoid bouncing on Auth0's initial null user. */
export const isUserGuard: CanActivateFn = () => {
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
