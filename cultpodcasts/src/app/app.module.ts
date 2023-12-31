import { NgModule,Component, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { NgIf } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { HttpClientModule } from '@angular/common/http';
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


@NgModule({
  declarations: [
    AppComponent,
    SearchComponent,
    HomeComponent,
    PodcastComponent,
    SubjectComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    FormsModule,
    NgIf,
    HttpClientModule,
    MatCardModule,
    MatExpansionModule,
    MatToolbarModule,
    MatProgressBarModule,
    MatMenuModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ],
  providers: [SiteService],
  bootstrap: [AppComponent]
})
export class AppModule { }

