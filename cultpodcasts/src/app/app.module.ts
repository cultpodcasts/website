import { NgModule,Component, isDevMode } from '@angular/core';
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
import { MatDialogModule } from "@angular/material/dialog";
import { SubmitPodcastComponent } from './submit-podcast/submit-podcast.component';

@NgModule({
  declarations: [
    AppComponent,
    SearchComponent,
    HomeComponent,
    PodcastComponent,
    SubjectComponent,
    SubmitPodcastComponent
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
    ServiceWorkerModule.register('my-service-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ],
  providers: [SiteService],
  bootstrap: [AppComponent]
})
export class AppModule { }

