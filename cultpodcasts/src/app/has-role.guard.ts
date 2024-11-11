import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthServiceWrapper } from './AuthServiceWrapper';

export const hasRoleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const user$ = inject(AuthServiceWrapper).authService.user$;
  if (user$) {
    return user$.pipe(
      map(e => {
        if (e && e["https://api.cultpodcasts.com/roles"]) {
          const roles: string[] = e["https://api.cultpodcasts.com/roles"];
          const expectedRoles: string[] = route.data['roles'];
          const hasRole: boolean = expectedRoles.some((role) => roles.includes(role));
          if (!hasRole) {
            router.navigate(['/unauthorised']);
          }
          return hasRole;
        }
        router.navigate(['/unauthorised']);
        return false;
      }),
      catchError((err) => {
        router.navigate(['/unauthorised']);
        return of(false);
      })
    );
  } else {
    router.navigate(['/unauthorised']);
    return of(false);
  }
}