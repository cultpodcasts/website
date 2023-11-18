import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeComponent } from './home/home.component';
import { SearchComponent } from './search/search.component';
import { PodcastComponent } from './podcast/podcast.component';
import { RouterModule, Routes } from '@angular/router';
import { SubjectComponent } from './subject/subject.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'search/:query', component: SearchComponent },
  { path: 'podcast/:podcastName', component: PodcastComponent },
  { path: 'subject/:subjectName', component: SubjectComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled'})],
  exports: [RouterModule]
})
export class AppRoutingModule { }
