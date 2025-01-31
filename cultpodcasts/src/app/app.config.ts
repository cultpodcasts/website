import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app-routing.module';
import { provideServiceWorker } from '@angular/service-worker';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { JsonUrlInterceptor } from './json-url.interceptor';
import { JsonDateInterceptor } from './json-date.interceptor';
import { HTTP_INTERCEPTORS, withInterceptorsFromDi, provideHttpClient, withFetch } from '@angular/common/http';
import { environment } from '../environments/environment';
import { provideAuth0 } from '@auth0/auth0-angular';
import { SiteService } from './site.service';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { InfiniteScrollStrategy } from './infinite-scroll-strategy';
import { EpisodePublishResponseAdaptor } from './episode-publish-response-adaptor';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(
      BrowserModule,
      AppRoutingModule
    ),
    SiteService,
    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: {
        redirect_uri: environment.assetHost
      }
    }),
    { provide: HTTP_INTERCEPTORS, useClass: JsonDateInterceptor, multi: true },
    {
      provide: HTTP_INTERCEPTORS, useClass: JsonUrlInterceptor, multi: true
    },
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(),
    provideServiceWorker('service-worker.js', {
      //      enabled: !isDevMode(),
      enabled: true,
      registrationStrategy: 'registerImmediately' //'registerWhenStable:30000'
    }),
    provideAnimations(),
    provideAnimationsAsync(),
    InfiniteScrollStrategy,
    EpisodePublishResponseAdaptor
  ]
};
