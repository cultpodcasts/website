import { NgModule } from '@angular/core';
import { PodcastComponent } from './podcast/podcast.component';
import { RouterModule, Routes } from '@angular/router';
import { ContentComponent } from './content/content.component';
import { DiscoveryComponent } from './discovery/discovery.component';
import { hasRoleGuard } from './has-role.guard';
import { UnauthorisedComponent } from './unauthorised/unauthorised.component';
import { SearchComponent } from './search/search.component';
import { SubjectComponent } from './subject/subject.component';
import { EpisodesComponent } from './episodes/episodes.component';
import { OutgoingEpisodesComponent } from './outgoing-episodes/outgoing-episodes.component';
import { HomeComponent } from './home/home.component';

export const routes: Routes = [
  { path: '/', component: HomeComponent, title: "Cult Podcasts", pathMatch: "full" },
  { path: '/search/:query', component: SearchComponent, pathMatch: "full" },
  { path: '/podcast/:podcastName', component: PodcastComponent, pathMatch: "full" },
  { path: '/podcast/:podcastName/:query', component: PodcastComponent, pathMatch: "full" },
  { path: '/subject/:subjectName', component: SubjectComponent, pathMatch: "full" },
  { path: '/subject/:subjectName/:query', component: SubjectComponent, pathMatch: "full" },
  { path: '/content/:path', component: ContentComponent, pathMatch: "full" },
  { path: '/discovery', component: DiscoveryComponent, canActivate: [hasRoleGuard], data: { roles: ["Curator"] }, title: "Discovery", pathMatch: "full" },
  { path: '/episodes/:episodeIds', component: EpisodesComponent, canActivate: [hasRoleGuard], data: { roles: ["Curator"] }, title: "Review Episodes", pathMatch: "full" },
  { path: '/outgoingEpisodes', component: OutgoingEpisodesComponent, canActivate: [hasRoleGuard], data: { roles: ["Curator"] }, title: "Outgoing Episodes", pathMatch: "full" },
  { path: '/unauthorised', component: UnauthorisedComponent, title: "Unauthorised", pathMatch: "full" }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }

