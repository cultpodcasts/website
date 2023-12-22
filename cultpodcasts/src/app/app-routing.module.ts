import { Injectable, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeComponent } from './home/home.component';
import { SearchComponent } from './search/search.component';
import { PodcastComponent } from './podcast/podcast.component';
import { ActivatedRouteSnapshot, Resolve, RouterModule, Routes } from '@angular/router';
import { SubjectComponent } from './subject/subject.component';

const siteTitle= "Cult Podcasts";

@Injectable({ providedIn: 'root' })
class QueryTitle implements Resolve<string> {
  constructor() { }
  resolve(route: ActivatedRouteSnapshot) {
    return `${siteTitle} | Search | ${route.params['query']}`;
  }
}

@Injectable({ providedIn: 'root' })
class PodcastTitle implements Resolve<string> {
  constructor() { }
  resolve(route: ActivatedRouteSnapshot) {
    return `${siteTitle} | Podcasts | ${route.params['podcastName']}`;
  }
}

@Injectable({ providedIn: 'root' })
class SubjectTitle implements Resolve<string> {
  constructor() { }
  resolve(route: ActivatedRouteSnapshot) {
    return `${siteTitle} | Subject | ${route.params['subjectName']}`;
  }
}

const routes: Routes = [
  { path: '', component: HomeComponent, title: "Cult Podcasts" },
  { path: 'search/:query', component: SearchComponent, title: QueryTitle },
  { path: 'podcast/:podcastName', component: PodcastComponent, title: PodcastTitle },
  { path: 'subject/:subjectName', component: SubjectComponent, title: SubjectTitle },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled'})],
  exports: [RouterModule]
})
export class AppRoutingModule { }

