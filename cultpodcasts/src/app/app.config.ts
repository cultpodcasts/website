import { ApplicationConfig, provideZonelessChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { BrowserModule, provideClientHydration, withNoIncrementalHydration } from '@angular/platform-browser';
import { JsonUrlInterceptor } from './json-url.interceptor';
import { JsonDateInterceptor } from './json-date.interceptor';
import { HTTP_INTERCEPTORS, withInterceptorsFromDi, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { environment } from '../environments/environment';
import { provideAuth0 } from '@auth0/auth0-angular';
import { SiteService } from './site.service';
import { InfiniteScrollStrategy } from './infinite-scroll-strategy';
import { EpisodePublishResponseAdaptor } from './episode-publish-response-adaptor';
import { authInterceptor } from './auth.interceptor';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { authRedirectUri } from './auth-redirect-uri';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(
      BrowserModule
    ),
    SiteService,
    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      // Prefer refresh tokens in localStorage. If the RT is missing, fall back to
      // the Auth0 iframe when the custom domain session cookie is still valid
      // (prod/staging apex). Preview hosts (*.pages.dev) often block that iframe;
      // AuthServiceWrapper then loginWithRedirects once on missing_refresh_token.
      useRefreshTokens: true,
      useRefreshTokensFallback: true,
      cacheLocation: 'localstorage',
      authorizationParams: {
        redirect_uri: authRedirectUri(environment.assetHost),
        audience: 'https://api.cultpodcasts.com/',
        scope: 'openid profile email offline_access curate admin submit'
      }
    }),
    { provide: HTTP_INTERCEPTORS, useClass: JsonDateInterceptor, multi: true },
    {
      provide: HTTP_INTERCEPTORS, useClass: JsonUrlInterceptor, multi: true
    },
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline', subscriptSizing: 'dynamic' } },
    { provide: MAT_DIALOG_DEFAULT_OPTIONS, useValue: { autoFocus: 'first-tabbable' } },
    provideHttpClient(withFetch(), withInterceptors([authInterceptor]), withInterceptorsFromDi()),
    provideZonelessChangeDetection(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    provideClientHydration(withNoIncrementalHydration()),
    provideServiceWorker('service-worker.js', {
      //      enabled: !isDevMode(),
      enabled: true,
      registrationStrategy: 'registerImmediately' //'registerWhenStable:30000'
    }),
    InfiniteScrollStrategy,
    EpisodePublishResponseAdaptor
  ]
};
