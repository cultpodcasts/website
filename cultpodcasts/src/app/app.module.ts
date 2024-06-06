import { NgModule, Component, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgIf } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SearchComponent } from './search/search.component';
import { HomeComponent } from './home/home.component';
import { MatMenuModule } from '@angular/material/menu';
import { SiteService } from './SiteService';
import { PodcastComponent } from './podcast/podcast.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { SubjectComponent } from './subject/subject.component';
import { MatDialogModule } from "@angular/material/dialog";
import { SubmitPodcastComponent } from './submit-podcast/submit-podcast.component';
import { SendPodcastComponent } from './send-podcast/send-podcast.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from './../environments/environment';
import { ContentComponent } from './content/content.component';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy.component';
import { TermsAndConditionsComponent } from './terms-and-conditions/terms-and-conditions.component';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { DiscoveryComponent } from './discovery/discovery.component';
import { UnauthorisedComponent } from './unauthorised/unauthorised.component';
import { JsonDateInterceptor} from './JsonDateInterceptor'
import { JsonUrlInterceptor } from './JsonUrlInterceptor';
import { DiscoverySubmitComponent } from './discovery-submit/discovery-submit.component';
import { ConfirmComponent } from './confirm/confirm.component';
import { DiscoveryItemComponent } from './discovery-item/discovery-item.component';
import { DiscoveryItemFilter } from './discovery-item-filterr';
import { MatDividerModule } from '@angular/material/divider';

@NgModule({
  declarations: [
    AppComponent,
    SearchComponent,
    HomeComponent,
    PodcastComponent,
    SubjectComponent,
    SubmitPodcastComponent,
    SendPodcastComponent,
    ContentComponent,
    PrivacyPolicyComponent,
    TermsAndConditionsComponent,
    DiscoveryComponent,
    UnauthorisedComponent,
    DiscoverySubmitComponent,
    ConfirmComponent,
    DiscoveryItemComponent,
    DiscoveryItemFilter
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    FormsModule,
    ReactiveFormsModule,
    NgIf,
    HttpClientModule,
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
    MatDividerModule
  ],
  providers: [
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
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }

