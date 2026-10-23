import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, map, Observable, of, switchMap, throwError } from 'rxjs';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { isCredentialFailure } from './auth-session-recovery';
import { environment } from '../environments/environment';

/**
 * Opt-in Auth0 scope for API calls.
 * Default `null` = public request (no Bearer). Curate callers must `.set(AUTH_SCOPE, 'curate')`.
 */
export const AUTH_SCOPE = new HttpContextToken<string | null>(() => null);

/** Set on the single retry that follows a credential failure, so a second 401 starts sign-in. */
const AUTH_RETRIED = new HttpContextToken<boolean>(() => false);

const API_AUDIENCE = 'https://api.cultpodcasts.com/';

/**
 * Attaches a Bearer token for API requests that opt in via AUTH_SCOPE.
 * A 401, or a 403 whose body says Unauthorised, refreshes the token and retries once.
 * If that still fails and this browser had a session the user did not sign out of,
 * sign-in starts and the error is not shown. Other statuses, including a 403 Forbidden
 * and a 500, still surface.
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

  const auth = inject(AuthServiceWrapper);
  const scope = req.context.get(AUTH_SCOPE);
  const authenticatedCall = req.headers.has('Authorization') || scope != null;

  if (req.headers.has('Authorization')) {
    return send(req, next, auth, authenticatedCall);
  }

  if (!scope) {
    return next(req);
  }

  return auth.authService.getAccessTokenSilently({
    authorizationParams: {
      audience: API_AUDIENCE,
      scope
    }
  }).pipe(
    map((token) => token ?? null),
    catchError(() => of(null)),
    switchMap((token) => {
      if (!token) {
        return auth.beginSessionRecovery() ?? next(req);
      }
      return send(
        req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
        next,
        auth,
        true
      );
    })
  );
};

/** Sign-in hides the error only after recovery actually starts. Otherwise the original error surfaces. */
function recoverOrRethrow(auth: AuthServiceWrapper, error: unknown): Observable<never> {
  return auth.beginSessionRecovery() ?? throwError(() => error);
}

function send(
  req: HttpRequest<unknown>,
  next: Parameters<HttpInterceptorFn>[1],
  auth: AuthServiceWrapper,
  authenticatedCall: boolean
) {
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!authenticatedCall || !isCredentialFailure(error) || !(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }
      if (req.context.get(AUTH_RETRIED)) {
        return recoverOrRethrow(auth, error);
      }
      const scope = req.context.get(AUTH_SCOPE);
      return auth.authService.getAccessTokenSilently({
        cacheMode: 'off',
        authorizationParams: {
          audience: API_AUDIENCE,
          ...(scope ? { scope } : {})
        }
      }).pipe(
        catchError(() => recoverOrRethrow(auth, error)),
        switchMap((token) => {
          if (!token) {
            return recoverOrRethrow(auth, error);
          }
          const retry = req.clone({
            setHeaders: { Authorization: `Bearer ${token}` },
            context: req.context.set(AUTH_RETRIED, true)
          });
          return next(retry).pipe(
            catchError((retryError: unknown) =>
              isCredentialFailure(retryError)
                ? recoverOrRethrow(auth, retryError)
                : throwError(() => retryError))
          );
        })
      );
    })
  );
}
