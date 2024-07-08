import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';


import { AppComponent } from './app/app.component';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { isDevMode, importProvidersFrom } from '@angular/core';
import { ServiceWorkerModule } from '@angular/service-worker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCardModule } from '@angular/material/card';
import { NgIf } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app/app-routing.module';
import { BrowserModule, bootstrapApplication, provideClientHydration } from '@angular/platform-browser';
import { JsonUrlInterceptor } from './app/JsonUrlInterceptor';
import { JsonDateInterceptor } from './app/JsonDateInterceptor';
import { HTTP_INTERCEPTORS, withInterceptorsFromDi, provideHttpClient } from '@angular/common/http';
import { environment } from './environments/environment';
import { provideAuth0 } from '@auth0/auth0-angular';
import { SiteService } from './app/SiteService';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

bootstrapApplication(AppComponent, {
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
            ServiceWorkerModule.register('service-worker.js', {
                enabled: !isDevMode(),
                registrationStrategy: 'registerImmediately' //'registerWhenStable:30000'
            }),
            MatProgressSpinnerModule,
            MatSnackBarModule,
            MatChipsModule,
            MatAutocompleteModule,
            MatFormFieldModule,
            MatDividerModule,
            MatBadgeModule,
            MatButtonToggleModule),
        SiteService,
        provideAuth0({
            domain: environment.auth0.domain,
            clientId: environment.auth0.clientId,
            authorizationParams: {
                redirect_uri: window.location.origin
            }
        }),
        {
            provide: HTTP_INTERCEPTORS, useClass: JsonDateInterceptor, multi: true
        },
        {
            provide: HTTP_INTERCEPTORS, useClass: JsonUrlInterceptor, multi: true
        },
        provideAnimations(),
        provideHttpClient(withInterceptorsFromDi()), provideAnimationsAsync(), provideClientHydration()
    ]
})
    .catch(err => console.error(err));
