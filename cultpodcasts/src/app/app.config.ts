import { ApplicationConfig, provideZoneChangeDetection, isDevMode, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app-routing.module';
import { provideServiceWorker } from '@angular/service-worker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { JsonUrlInterceptor } from './JsonUrlInterceptor';
import { JsonDateInterceptor } from './JsonDateInterceptor';
import { HTTP_INTERCEPTORS, withInterceptorsFromDi, provideHttpClient, withFetch } from '@angular/common/http';
import { environment } from '../environments/environment';
import { provideAuth0 } from '@auth0/auth0-angular';
import { SiteService } from './SiteService';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(
      BrowserModule,
      AppRoutingModule,
      MatInputModule,
      MatIconModule,
      MatButtonModule,
      FormsModule,
      ReactiveFormsModule,
      NgIf,
      MatCardModule,
      MatExpansionModule,
      MatToolbarModule,
      MatProgressBarModule,
      MatMenuModule,
      MatDialogModule,
      MatProgressSpinnerModule,
      MatSnackBarModule,
      MatChipsModule,
      MatAutocompleteModule,
      MatFormFieldModule,
      MatDividerModule,
      MatBadgeModule,
      MatButtonToggleModule
    ),
    SiteService,
    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: {
        redirect_uri: environment.assetHost
      }
    }),
    {
      provide: HTTP_INTERCEPTORS, useClass: JsonDateInterceptor, multi: true
    },
    {
      provide: HTTP_INTERCEPTORS, useClass: JsonUrlInterceptor, multi: true
    },
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(),
    provideServiceWorker('service-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately' //'registerWhenStable:30000'
    }),
    provideAnimations(),
    provideAnimationsAsync(),
  ]
};
