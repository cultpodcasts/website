import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { map, catchError, of } from "rxjs";
import { AuthServiceWrapper } from "./AuthServiceWrapper";

export const isUserGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const user$ = inject(AuthServiceWrapper).authService.user$;
  if (user$) {
    return user$.pipe(
      map(e => {
        if (e) {
          return true;
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
};
