import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, CanActivateFn } from '@angular/router';
import { catchError, filter, map, of, switchMap, take } from 'rxjs';
import { AuthServiceWrapper } from './auth-service-wrapper.class';

/**
 * Curator (etc.) role gate.
 *
 * Server/prerender uses FakeAuth with no session — denying there redirects to
 * /unauthorised while the URL is still /discovery and blows up client hydration
 * (`hasAttribute` on null). Allow the route on the server; enforce Auth0 only in
 * the browser after `isLoading$` completes.
 */
export const hasRoleGuard: CanActivateFn = (route) => {
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
