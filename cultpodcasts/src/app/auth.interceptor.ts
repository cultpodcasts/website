import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, of, switchMap } from 'rxjs';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { environment } from '../environments/environment';

/**
 * Opt-in Auth0 scope for API calls.
 * Default `null` = public request (no Bearer). Curate callers must `.set(AUTH_SCOPE, 'curate')`.
 */
export const AUTH_SCOPE = new HttpContextToken<string | null>(() => null);

/**
 * Attaches Bearer token for API requests that opt in via AUTH_SCOPE.
 * Skips when no scope, Authorization already set, or not running in the browser.
 * If silent auth fails, continues without a token so public GETs still work.
 * API HTTP errors (e.g. 400 with a body) must propagate — do not retry unauthenticated.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  const apiBase = environment.api.replace(/\/$/, '');
  if (!req.url.startsWith(apiBase)) {
    return next(req);
  }

  if (req.headers.has('Authorization')) {
    return next(req);
  }

  const scope = req.context.get(AUTH_SCOPE);
  if (!scope) {
    return next(req);
  }

  const auth = inject(AuthServiceWrapper);

  return auth.authService.getAccessTokenSilently({
    authorizationParams: {
      audience: 'https://api.cultpodcasts.com/',
      scope
    }
  }).pipe(
    catchError(() => of(null)),
    switchMap((token: string | null) => {
      if (!token) {
        return next(req);
      }
      return next(
        req.clone({
          setHeaders: { Authorization: `Bearer ${token}` }
        })
      );
    })
  );
};
