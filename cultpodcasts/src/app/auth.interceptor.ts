import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { switchMap } from 'rxjs';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { environment } from '../environments/environment';

/** Opt-in Auth0 scope for API calls (default: curate). */
export const AUTH_SCOPE = new HttpContextToken(() => 'curate' as string);

/**
 * Attaches Bearer token for requests targeting the Cult Podcasts API host.
 * Skips when Authorization is already set, or when not running in the browser.
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

  const auth = inject(AuthServiceWrapper);
  const scope = req.context.get(AUTH_SCOPE);

  return auth.authService.getAccessTokenSilently({
    authorizationParams: {
      audience: 'https://api.cultpodcasts.com/',
      scope
    }
  }).pipe(
    switchMap((token) =>
      next(
        req.clone({
          setHeaders: { Authorization: `Bearer ${token}` }
        })
      )
    )
  );
};
