import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
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
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
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
      // Firefox (and Safari) block Auth0 silent auth iframes when the app host
      // (e.g. *.pages.dev) is cross-site to the Auth0 custom domain. Refresh
      // tokens + localStorage avoid that path for getAccessTokenSilently.
      useRefreshTokens: true,
      useRefreshTokensFallback: false,
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
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    provideClientHydration(withNoIncrementalHydration()),
    provideServiceWorker('service-worker.js', {
      //      enabled: !isDevMode(),
      enabled: true,
      registrationStrategy: 'registerImmediately' //'registerWhenStable:30000'
    }),
    provideAnimationsAsync(),
    InfiniteScrollStrategy,
    EpisodePublishResponseAdaptor
  ]
};
