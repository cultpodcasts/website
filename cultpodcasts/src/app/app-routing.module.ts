import { Injectable, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeComponent } from './home/home.component';
import { SearchComponent } from './search/search.component';
import { PodcastComponent } from './podcast/podcast.component';
import { ActivatedRouteSnapshot, Resolve, RouterModule, Routes } from '@angular/router';
import { SubjectComponent } from './subject/subject.component';
import { ContentComponent } from './content/content.component';
import { DiscoveryComponent } from './discovery/discovery.component';

const siteTitle = "Cult Podcasts";

@Injectable({ providedIn: 'root' })
class QueryTitle implements Resolve<string> {
  constructor() { }
  resolve(route: ActivatedRouteSnapshot) {
    return `${route.params['query']} Search Results - ${siteTitle}`;
  }
}

@Injectable({ providedIn: 'root' })
class PodcastTitle implements Resolve<string> {
  constructor() { }
  resolve(route: ActivatedRouteSnapshot) {
    return `${route.params['podcastName']} - ${siteTitle}`;
  }
}

@Injectable({ providedIn: 'root' })
class SubjectTitle implements Resolve<string> {
  constructor() { }
  resolve(route: ActivatedRouteSnapshot) {
    return `${route.params['subjectName']} - ${siteTitle}`;
  }
}

@Injectable({ providedIn: 'root' })
class ContentTitle implements Resolve<string> {
  constructor() { }
  resolve(route: ActivatedRouteSnapshot) {
    let title: string = "";
    switch (route.params['path']) {
      case "privacy-poicy":
        title = "Privacy Policy";
        break;
      case "terms-and-conditions":
        title= "Terms and Conditions";
        break;
      default:
        break;
    }
    return `${title} - ${siteTitle}`;
  }
}

const routes: Routes = [
  { path: '', component: HomeComponent, title: "Cult Podcasts" },
  { path: 'search/:query', component: SearchComponent, title: QueryTitle },
  { path: 'podcast/:podcastName', component: PodcastComponent, title: PodcastTitle },
  { path: 'podcast/:podcastName/:query', component: PodcastComponent, title: PodcastTitle },
  { path: 'subject/:subjectName', component: SubjectComponent, title: SubjectTitle },
  { path: 'subject/:subjectName/:query', component: SubjectComponent, title: SubjectTitle },
  { path: 'content/:path', component: ContentComponent, title: ContentTitle },
  { path: 'discovery', component: DiscoveryComponent, title: "Cult Podcasts" }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }

