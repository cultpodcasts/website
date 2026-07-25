import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { catchError, filter, map, of, switchMap, take } from 'rxjs';
import { AuthServiceWrapper } from './auth-service-wrapper.class';

/**
 * Wait for Auth0 to finish restoring the session before deciding.
 * On a hard reload `user$` emits `null` while loading — treating that as
 * unauthenticated bounced curators to /unauthorised until they client-nav from Home.
 */
export const hasRoleGuard: CanActivateFn = (route) => {
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
      const roles: string[] = user?.['https://api.cultpodcasts.com/roles'] ?? [];
      const expectedRoles: string[] = route.data['roles'] ?? [];
      const hasRole = expectedRoles.some((role) => roles.includes(role));
      if (!hasRole) {
        void router.navigate(['/unauthorised']);
      }
      return hasRole;
    }),
    catchError(() => {
      void router.navigate(['/unauthorised']);
      return of(false);
    })
  );
};
