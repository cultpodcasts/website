import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { ApiEpisode } from '../api-episode.interface';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule, MatMenuItem } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { PostEpisodeDialogComponent } from '../post-episode-dialog/post-episode-dialog.component';
import { SiteService } from '../site.service';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { SetNumberOfDaysComponent } from '../set-number-of-days/set-number-of-days.component';
import { DeleteEpisodeDialogComponent } from '../delete-episode-dialog/delete-episode-dialog.component';
import { EpisodeStatusComponent } from "../episode-status/episode-status.component";
import { EpisodePodcastLinksComponent } from "../episode-podcast-links/episode-podcast-links.component";
import { EditPodcastDialogComponent } from '../edit-podcast-dialog/edit-podcast-dialog.component';
import { EpisodeImageComponent } from "../episode-image/episode-image.component";
import { SubjectsComponent } from "../subjects/subjects.component";
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';
import { EpisodePublishResponseSnackbarComponent } from '../episode-publish-response-snackbar/episode-publish-response-snackbar.component';
import { PostEpisodeDialogResponse } from '../post-episode-dialog-response.interface';
import { EpisodeGuestsComponent } from '../episode-guests/episode-guests.component';
import { EpisodeUpdateService } from '../episode-update.service';

const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";
const daysKey: string = "pref.outgoing-episodes.days";

@Component({
  selector: 'app-outgoing-episodes-api',
  imports: [
    MatProgressBarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    MatCardModule,
    RouterLink,
    DatePipe,
    MatCheckboxModule,
    MatMenuItem,
    FormsModule,
    EpisodeStatusComponent,
    EpisodePodcastLinksComponent,
    EpisodeImageComponent,
    SubjectsComponent,
    EpisodeGuestsComponent
  ],
  templateUrl: './outgoing-episodes-api.component.html',
  styleUrl: './outgoing-episodes-api.component.sass'
})
export class OutgoingEpisodesApiComponent {
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;

  episodes: ApiEpisode[] | undefined;
  error: boolean = false;
  isLoading: boolean = true;
  sortDirection: string = sortParamDateDesc;

  days: number | undefined;
  posted: boolean | undefined;
  tweeted: boolean | undefined;
  blueskyPosted: boolean | undefined = true;
  token: string = "";
  authRoles: string[] = [];
  updatingEpisodeId: string | null = null;
  updatingFlag: 'ignored' | 'removed' | null = null;

  constructor(
    protected auth: AuthServiceWrapper,
    private http: HttpClient,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private siteService: SiteService,
    private episodeUpdate: EpisodeUpdateService
  ) {
    this.auth.roles.subscribe(roles => this.authRoles = roles);
  }

  ngOnInit() {
    this.siteService.setQuery(null);
    this.siteService.setPodcast(null);
    this.siteService.setSubject(null);

    const daysValue: string | null = localStorage.getItem(daysKey);
    if (daysValue && parseInt(daysValue)) {
      this.days = parseInt(daysValue);
    }

    this.isLoading = true;
    this.error = false;
    this.episodes = [];

    this.route.params.subscribe(params => {
      const token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'curate'
        }
      }));
      token.then(_token => {
        this.token = _token;
        this.getEpisodes();
      }).catch(x => {
        this.isLoading = false;
        this.error = true;
        console.error(x);
      });
    })
  }

  reset() {
    this.posted = undefined;
    this.tweeted = undefined;
    this.blueskyPosted = true;
    this.days = undefined;
    this.ngOnInit()
  }

  setSort(sort: string) {
    if (sort != sortParamDateDesc) {
      this.episodes = this.episodes?.sort((a: ApiEpisode, b: ApiEpisode) => {
        return a.release.getTime() - b.release.getTime();
      })
    } else {
      this.episodes = this.episodes?.sort((a: ApiEpisode, b: ApiEpisode) => {
        return b.release.getTime() - a.release.getTime();
      })
    }
  }

  edit(podcastId: string, episodeId: string) {
    const dialogRef = this.dialog.open<EditEpisodeDialogComponent, any, EditEpisodeDialogResponse>(EditEpisodeDialogComponent, {
      data: { podcastIdentifier: podcastId, episodeId: episodeId },
      disableClose: true,
      autoFocus: true,
      width: '90%'
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        if (result.updated) {
          this.snackBar.open("Episode updated", "Ok", { duration: 10000 });
          await this.refreshEpisode(episodeId);
        } else if (result.noChange) {
          this.snackBar.open("No change", "Ok", { duration: 3000 });
        }
      }
    });
  }

  isUpdating(episodeId: string): boolean {
    return this.updatingEpisodeId === episodeId;
  }

  isLoadingIgnored(episodeId: string): boolean {
    return this.isUpdating(episodeId) && this.updatingFlag === 'ignored';
  }

  isLoadingRemoved(episodeId: string): boolean {
    return this.isUpdating(episodeId) && this.updatingFlag === 'removed';
  }

  async refreshEpisode(episodeId: string) {
    try {
      const updated = await this.episodeUpdate.fetchEpisode(episodeId);
      this.episodes = this.episodeUpdate.replaceEpisode(this.episodes, updated);
    } catch (e) {
      console.error(e);
    }
  }

  private async runEpisodeUpdate(
    episode: ApiEpisode,
    action: () => Promise<ApiEpisode>,
    flag: 'ignored' | 'removed' | null = null
  ) {
    if (this.isUpdating(episode.id)) {
      return;
    }
    this.updatingEpisodeId = episode.id;
    this.updatingFlag = flag;
    try {
      const updated = await action();
      this.episodes = this.episodeUpdate.replaceEpisode(this.episodes, updated);
    } catch (e) {
      console.error(e);
      this.snackBar.open("Failed to update episode", "Ok", { duration: 5000 });
      throw e;
    } finally {
      this.updatingEpisodeId = null;
      this.updatingFlag = null;
    }
  }

  removeSubject(episode: ApiEpisode, subject: string) {
    this.runEpisodeUpdate(episode, () => this.episodeUpdate.removeSubject(episode, subject));
  }

  removeGuest(episode: ApiEpisode, guestName: string) {
    this.runEpisodeUpdate(episode, () => this.episodeUpdate.removeGuest(episode, guestName));
  }

  addSuggestedGuest(episode: ApiEpisode, guestName: string) {
    this.runEpisodeUpdate(episode, () => this.episodeUpdate.addGuest(episode, guestName));
  }

  toggleIgnored(episode: ApiEpisode) {
    if (this.isUpdating(episode.id)) {
      return;
    }
    const previousIgnored = episode.ignored;
    const previousRemoved = episode.removed;
    const next = !previousIgnored;
    episode.ignored = next;
    if (next) {
      episode.removed = false;
    }
    this.runEpisodeUpdate(
      episode,
      () => this.episodeUpdate.toggleIgnored(episode, next),
      'ignored'
    ).catch(() => {
      episode.ignored = previousIgnored;
      episode.removed = previousRemoved;
    });
  }

  toggleRemoved(episode: ApiEpisode) {
    if (this.isUpdating(episode.id)) {
      return;
    }
    const previousIgnored = episode.ignored;
    const previousRemoved = episode.removed;
    const next = !previousRemoved;
    episode.removed = next;
    if (next) {
      episode.ignored = false;
    }
    this.runEpisodeUpdate(
      episode,
      () => this.episodeUpdate.toggleRemoved(episode, next),
      'removed'
    ).catch(() => {
      episode.ignored = previousIgnored;
      episode.removed = previousRemoved;
    });
  }

  post(podcastId: string, episodeId: string) {
    const dialogRef = this.dialog
      .open<PostEpisodeDialogComponent, any, PostEpisodeDialogResponse>(PostEpisodeDialogComponent, {
        data: { podcastIdentifier: podcastId, episodeId: episodeId },
        disableClose: true,
        autoFocus: true
      });
    dialogRef.afterClosed().subscribe(async result => {
      this.snackBar.openFromComponent(EpisodePublishResponseSnackbarComponent,
        { duration: 10000, data: { postEpisodeDialogResponse: result, podcastId: podcastId, episodeId: episodeId } });
    });
  }

  delete(podcastId: string, episodeId: string) {
    const dialogRef = this.dialog.open(DeleteEpisodeDialogComponent, {
      data: { podcastId: podcastId, episodeId: episodeId },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.deleted) {
        let snackBarRef = this.snackBar.open("Episode deleted.", "Ok", { duration: 10000 });
      }
    });
  }

  getEpisodes() {
    this.isLoading = true;
    let headers: HttpHeaders = new HttpHeaders();
    headers = headers.set("Authorization", "Bearer " + this.token);

    const url = new URL(`/episodes/outgoing`, environment.api);
    if (this.days)
      url.searchParams.append("days", this.days.toString());
    if (this.tweeted)
      url.searchParams.append("tweeted", this.tweeted.toString());
    if (this.posted)
      url.searchParams.append("posted", this.posted.toString());
    if (this.blueskyPosted)
      url.searchParams.append("blueskyPosted", this.blueskyPosted.toString())
    const episodeEndpoint = url.toString();
    this.http.get<ApiEpisode[]>(episodeEndpoint, { headers: headers, observe: "response" })
      .subscribe(
        {
          next: resp => {
            this.isLoading = false;
            this.error = false;
            this.episodes = resp.body!;
          },
          error: e => {
            this.isLoading = false;
            this.error = true;
            console.error(e);
          }
        }
      );
  }

  openSetDays() {
    var _days = this.days || 7;
    this.dialog
      .open(SetNumberOfDaysComponent, { disableClose: true, autoFocus: true, data: { days: _days } })
      .afterClosed()
      .subscribe(async result => {
        if (result?.days && parseInt(result.days)) {
          var days = parseInt(result.days);
          if (days != _days) {
            localStorage.setItem(daysKey, days.toString());
            this.days = days;
            this.getEpisodes();
          }
        }
      });
  }

  editPodcast(podcastName: string) {
    const dialogRef = this.dialog.open(EditPodcastDialogComponent, {
      data: { podcastName: podcastName },
      disableClose: true,
      autoFocus: true,
      width: '90%'
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        var message = "Podcast updated";
        if (result.response?.failureIndexingEpisodes) {
          message += ". Some episodes failed to index";
        }
        if (result.response?.failureDeletingFromIndex) {
          message += ". Some episodes failed to delete from index";
        }
        let snackBarRef = this.snackBar.open(message, "Ok", { duration: 10000 });
      } else if (result.noChange) {
        let snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
    });
  }
}
