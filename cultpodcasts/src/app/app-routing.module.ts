import { Injectable, NgModule } from '@angular/core';
import { PodcastComponent } from './podcast/podcast.component';
import { ActivatedRouteSnapshot, Resolve, RouterModule, Routes } from '@angular/router';
import { ContentComponent } from './content/content.component';
import { DiscoveryComponent } from './discovery/discovery.component';
import { hasRoleGuard } from './has-role.guard';
import { UnauthorisedComponent } from './unauthorised/unauthorised.component';
import { HomeWrapperComponent } from './home-wrapper/home-wrapper.component';
import { SubjectWrapperComponent } from './subject-wrapper/subject-wrapper.component';
import { SearchWrapperComponent } from './search-wrapper/search-wrapper.component';

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
        title = "Terms and Conditions";
        break;
      default:
        break;
    }
    return `${title} - ${siteTitle}`;
  }
}

export const routes: Routes = [
  { path: '', component: HomeWrapperComponent, title: "Cult Podcasts" },
  { path: 'search/:query', component: SearchWrapperComponent, title: QueryTitle },
  { path: 'podcast/:podcastName', component: PodcastComponent, title: PodcastTitle },
  { path: 'podcast/:podcastName/:query', component: PodcastComponent, title: PodcastTitle },
  { path: 'subject/:subjectName', component: SubjectWrapperComponent, title: SubjectTitle },
  { path: 'subject/:subjectName/:query', component: SubjectWrapperComponent, title: SubjectTitle },
  { path: 'content/:path', component: ContentComponent, title: ContentTitle },
  { path: 'discovery', component: DiscoveryComponent, title: "Cult Podcasts", canActivate: [hasRoleGuard], data: { roles: ["Curator"] } },
  { path: 'unauthorised', component: UnauthorisedComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }

