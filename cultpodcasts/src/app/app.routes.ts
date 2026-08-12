import { Routes } from '@angular/router';
import { PodcastComponent } from './podcast/podcast.component';
import { ContentComponent } from './content/content.component';
import { ContentNotFoundComponent } from './content/content-not-found.component';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy.component';
import { TermsAndConditionsComponent } from './terms-and-conditions/terms-and-conditions.component';
import { DiscoveryComponent } from './discovery/discovery.component';
import { hasRoleGuard } from './has-role.guard';
import { isUserGuard } from './is-user.guard';
import { UnauthorisedComponent } from './unauthorised/unauthorised.component';
import { SearchComponent } from './search/search.component';
import { SubjectComponent } from './subject/subject.component';
import { EpisodesComponent } from './episodes/episodes.component';
import { OutgoingEpisodesComponent } from './outgoing-episodes/outgoing-episodes.component';
import { HomeComponent } from './home/home.component';
import { BookmarksComponent } from './bookmarks/bookmarks.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: "Cult Podcasts" },
  { path: 'search/:query', component: SearchComponent },
  { path: 'podcast/:podcastName', component: PodcastComponent },
  { path: 'podcast/:podcastName/:query', component: PodcastComponent },
  { path: 'subject/:subjectName', component: SubjectComponent },
  { path: 'subject/:subjectName/:query', component: SubjectComponent },
  {
    path: 'content',
    component: ContentComponent,
    children: [
      { path: 'privacy-policy', component: PrivacyPolicyComponent },
      { path: 'terms-and-conditions', component: TermsAndConditionsComponent },
      { path: '**', component: ContentNotFoundComponent },
    ],
  },
  { path: 'discovery', component: DiscoveryComponent, canActivate: [hasRoleGuard], data: { roles: ["Curator"] }, title: "Discovery" },
  { path: 'episodes/:episodeIds', component: EpisodesComponent, canActivate: [hasRoleGuard], data: { roles: ["Curator"] }, title: "Review Episodes" },
  { path: 'outgoingEpisodes', component: OutgoingEpisodesComponent, canActivate: [hasRoleGuard], data: { roles: ["Curator"] }, title: "Outgoing Episodes" },
  { path: 'unauthorised', component: UnauthorisedComponent, title: "Unauthorised" },
  { path: 'bookmarks', component: BookmarksComponent, canActivate: [isUserGuard], title: 'My Bookmarks' }
];
