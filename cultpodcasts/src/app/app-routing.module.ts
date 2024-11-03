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
  { path: '', component: HomeComponent, title: "Cult Podcasts" },
  { path: 'search/:query', component: SearchComponent },
  { path: 'podcast/:podcastName', component: PodcastComponent },
  { path: 'podcast/:podcastName/:query', component: PodcastComponent },
  { path: 'subject/:subjectName', component: SubjectComponent },
  { path: 'subject/:subjectName/:query', component: SubjectComponent },
  { path: 'content/:path', component: ContentComponent },
  { path: 'discovery', component: DiscoveryComponent, canActivate: [hasRoleGuard], data: { roles: ["Curator"] }, title: "Discovery" },
  { path: 'episodes/:episodeIds', component: EpisodesComponent, canActivate: [hasRoleGuard], data: { roles: ["Curator"] } },
  { path: 'outgoingEpisodes', component: OutgoingEpisodesComponent, canActivate: [hasRoleGuard], data: { roles: ["Curator"] } },
  { path: 'unauthorised', component: UnauthorisedComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }

