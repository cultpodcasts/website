import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, firstValueFrom, forkJoin, map, Observable, of } from 'rxjs';
import { environment } from './../../environments/environment';
import { ApiEpisode } from '../api-episode.interface';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { PostEpisodeDialogComponent } from '../post-episode-dialog/post-episode-dialog.component';
import { SiteService } from '../site.service';
import { EpisodeStatusComponent } from "../episode-status/episode-status.component";
import { EpisodePodcastLinksComponent } from "../episode-podcast-links/episode-podcast-links.component";
import { DeleteEpisodeDialogComponent } from '../delete-episode-dialog/delete-episode-dialog.component';
import { EditPodcastDialogComponent } from '../edit-podcast-dialog/edit-podcast-dialog.component';
import { EpisodeImageComponent } from "../episode-image/episode-image.component";
import { SubjectsComponent } from "../subjects/subjects.component";
import { EpisodeGuestsComponent } from "../episode-guests/episode-guests.component";
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';
import { EpisodePublishResponseSnackbarComponent } from '../episode-publish-response-snackbar/episode-publish-response-snackbar.component';
import { PostEpisodeDialogResponse } from '../post-episode-dialog-response.interface';
import { PodcastIndexComponent } from '../podcast-index/podcast-index.component';
import { EpisodeUpdateService } from '../episode-update.service';
import { ManualTweetEpisodeDialogComponent } from '../manual-tweet-episode-dialog/manual-tweet-episode-dialog.component';

const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";

@Component({
  selector: 'app-episodes-api',
  imports: [
    MatProgressBarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    MatCardModule,
    RouterLink,
    DatePipe,
    EpisodeStatusComponent,
    EpisodePodcastLinksComponent,
    EpisodeImageComponent,
    SubjectsComponent,
    EpisodeGuestsComponent
  ],
  templateUrl: './episodes-api.component.html',
  styleUrl: './episodes-api.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EpisodesApiComponent {
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;

  protected episodes = signal<ApiEpisode[] | undefined>(undefined);
  protected error = signal<boolean>(false);
  protected isLoading = signal<boolean>(true);
  sortDirection: string = sortParamDateDesc;
  protected updatingEpisodeId = signal<string | null>(null);
  protected updatingFlag = signal<'ignored' | 'removed' | 'tweeted' | 'bluesky' | null>(null);
  protected addingGuest = signal<Record<string, string>>({});

  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  protected auth = inject(AuthServiceWrapper);
  protected authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });

  constructor(
    private router: Router,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private siteService: SiteService,
    private episodeUpdate: EpisodeUpdateService
  ) {
  }

  ngOnInit() {
    this.siteService.setQuery(null);
    this.siteService.setPodcast(null);
    this.siteService.setSubject(null);

    this.isLoading.set(true);
    this.error.set(false);
    this.episodes.set([]);
    this.route.params.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      this.isLoading.set(true);
      var serialisedEpisodeId = params['episodeIds'];
      let episodeIds: string[] = [];
      if (serialisedEpisodeId) {
        episodeIds = JSON.parse(serialisedEpisodeId);
      }
      var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'curate'
        }
      }));
      token.then(_token => {
        let headers: HttpHeaders = new HttpHeaders();
        headers = headers.set("Authorization", "Bearer " + _token);

        const episodeResponses: Observable<ApiEpisode | null>[] = [];
        episodeIds.forEach(episodeId => {
          const episodeEndpoint = new URL(`/episode/${episodeId}`, environment.api).toString();
          const get = this.http.get<ApiEpisode>(episodeEndpoint, { headers: headers }).pipe(this.handleRequest(this).bind(this))
          episodeResponses.push(get);
        })
        forkJoin(episodeResponses).subscribe({
          next: episodes => {
            this.episodes.set(episodes.filter(x => x != null));
            this.isLoading.set(false);
          },
          error: e => {
            this.error.set(true);
            this.isLoading.set(false);
            console.error(e);
          }
        })
      });
    })
  }

  handleRequest(that: EpisodesApiComponent) {
    return function (observable: Observable<any>) {
      return observable.pipe(
        map((result) => {
          return result;
        }),
        catchError((err) => {
          console.error(err);
          that.error.set(true);
          return of(null);
        })
      );
    };
  }

  setSort(sort: string) {
    this.sortDirection = sort;
    const current = this.episodes();
    if (!current) {
      return;
    }
    if (sort != sortParamDateDesc) {
      this.episodes.set([...current].sort((a: ApiEpisode, b: ApiEpisode) => {
        return a.release.getTime() - b.release.getTime();
      }));
    } else {
      this.episodes.set([...current].sort((a: ApiEpisode, b: ApiEpisode) => {
        return b.release.getTime() - a.release.getTime();
      }));
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
    return this.updatingEpisodeId() === episodeId;
  }

  isLoadingIgnored(episodeId: string): boolean {
    return this.isUpdating(episodeId) && this.updatingFlag() === 'ignored';
  }

  isLoadingRemoved(episodeId: string): boolean {
    return this.isUpdating(episodeId) && this.updatingFlag() === 'removed';
  }

  isLoadingTweeted(episodeId: string): boolean {
    return this.isUpdating(episodeId) && this.updatingFlag() === 'tweeted';
  }

  isLoadingBluesky(episodeId: string): boolean {
    return this.isUpdating(episodeId) && this.updatingFlag() === 'bluesky';
  }

  isStatusActionLoading(episodeId: string): boolean {
    return this.isLoadingIgnored(episodeId)
      || this.isLoadingRemoved(episodeId)
      || this.isLoadingTweeted(episodeId)
      || this.isLoadingBluesky(episodeId);
  }

  async refreshEpisode(episodeId: string) {
    try {
      const updated = await this.episodeUpdate.fetchEpisode(episodeId);
      this.episodes.set(this.episodeUpdate.replaceEpisode(this.episodes(), updated) ?? []);
    } catch (e) {
      console.error(e);
    }
  }

  private refreshEpisodesSignal() {
    this.episodes.set([...(this.episodes() ?? [])]);
  }

  private async runEpisodeUpdate(
    episode: ApiEpisode,
    action: () => Promise<ApiEpisode>,
    flag: 'ignored' | 'removed' | 'tweeted' | 'bluesky' | null = null
  ) {
    if (this.isUpdating(episode.id)) {
      return;
    }
    this.updatingEpisodeId.set(episode.id);
    this.updatingFlag.set(flag);
    try {
      const updated = await action();
      this.episodes.set(this.episodeUpdate.replaceEpisode(this.episodes(), updated) ?? []);
    } catch (e) {
      console.error(e);
      this.snackBar.open("Failed to update episode", "Ok", { duration: 5000 });
      throw e;
    } finally {
      this.updatingEpisodeId.set(null);
      this.updatingFlag.set(null);
    }
  }

  removeSubject(episode: ApiEpisode, subject: string) {
    this.runEpisodeUpdate(episode, () => this.episodeUpdate.removeSubject(episode, subject));
  }

  removeGuest(episode: ApiEpisode, guestName: string) {
    this.runEpisodeUpdate(episode, () => this.episodeUpdate.removeGuest(episode, guestName));
  }

  addSuggestedGuest(episode: ApiEpisode, guestName: string) {
    if (this.isUpdating(episode.id) || this.addingGuest()[episode.id]) {
      return;
    }
    const suggestion = episode.guestSuggestions?.find(x => x.person.name === guestName);
    if (!suggestion) {
      return;
    }
    const previousGuests = episode.guestPeople ? [...episode.guestPeople] : [];
    const previousSuggestions = episode.guestSuggestions ? [...episode.guestSuggestions] : [];
    const previousGuestNames = this.episodeUpdate.getGuestNames(episode);

    episode.guestPeople = [...previousGuests, suggestion.person];
    episode.guestSuggestions = previousSuggestions.filter(x => x.person.name !== guestName);
    this.refreshEpisodesSignal();
    this.addingGuest.update(m => ({ ...m, [episode.id]: guestName }));

    const nextGuestNames = previousGuestNames.includes(guestName)
      ? previousGuestNames
      : [...previousGuestNames, guestName];

    this.episodeUpdate.setGuests(episode, nextGuestNames)
      .then(updated => {
        this.episodes.set(this.episodeUpdate.replaceEpisode(this.episodes(), updated) ?? []);
      })
      .catch(e => {
        console.error(e);
        episode.guestPeople = previousGuests;
        episode.guestSuggestions = previousSuggestions;
        this.refreshEpisodesSignal();
        this.snackBar.open("Failed to add guest", "Ok", { duration: 5000 });
      })
      .finally(() => {
        this.addingGuest.update(m => {
          const next = { ...m };
          delete next[episode.id];
          return next;
        });
      });
  }

  loadingGuestName(episodeId: string): string | null {
    return this.addingGuest()[episodeId] ?? null;
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
    this.refreshEpisodesSignal();
    this.runEpisodeUpdate(
      episode,
      () => this.episodeUpdate.toggleIgnored(episode, next),
      'ignored'
    ).catch(() => {
      episode.ignored = previousIgnored;
      episode.removed = previousRemoved;
      this.refreshEpisodesSignal();
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
    this.refreshEpisodesSignal();
    this.runEpisodeUpdate(
      episode,
      () => this.episodeUpdate.toggleRemoved(episode, next),
      'removed'
    ).catch(() => {
      episode.ignored = previousIgnored;
      episode.removed = previousRemoved;
      this.refreshEpisodesSignal();
    });
  }

  toggleTweeted(episode: ApiEpisode) {
    if (this.isUpdating(episode.id)) {
      return;
    }
    if (episode.tweeted) {
      const previous = episode.tweeted;
      episode.tweeted = false;
      this.refreshEpisodesSignal();
      this.runEpisodeUpdate(
        episode,
        () => this.episodeUpdate.untweet(episode),
        'tweeted'
      ).catch(() => {
        episode.tweeted = previous;
        this.refreshEpisodesSignal();
      });
      return;
    }
    this.runManualTweet(episode);
  }

  private async runManualTweet(episode: ApiEpisode) {
    if (this.isUpdating(episode.id)) {
      return;
    }
    if (!episode.podcastId) {
      this.snackBar.open("Episode podcastId is required to tweet", "Ok", { duration: 5000 });
      return;
    }
    this.updatingEpisodeId.set(episode.id);
    this.updatingFlag.set('tweeted');
    try {
      const result = await this.episodeUpdate.publishTweet(episode);
      if (result.tweeted) {
        const updated = await this.episodeUpdate.fetchEpisode(episode.id);
        this.episodes.set(this.episodeUpdate.replaceEpisode(this.episodes(), updated) ?? []);
        return;
      }
      if (result.failedTweetContent) {
        const dialogRef = this.dialog.open<ManualTweetEpisodeDialogComponent, { tweet: string, episodeId: string, podcastId: string }, any>(
          ManualTweetEpisodeDialogComponent,
          {
            data: {
              tweet: result.failedTweetContent,
              episodeId: episode.id,
              podcastId: episode.podcastId
            },
            disableClose: true,
            autoFocus: true
          }
        );
        const dialogResult = await firstValueFrom(dialogRef.afterClosed());
        if (dialogResult?.updated) {
          const updated = await this.episodeUpdate.fetchEpisode(episode.id);
          this.episodes.set(this.episodeUpdate.replaceEpisode(this.episodes(), updated) ?? []);
        }
        return;
      }
      this.snackBar.open("Failed to tweet", "Ok", { duration: 5000 });
    } catch (e) {
      console.error(e);
      this.snackBar.open("Failed to tweet", "Ok", { duration: 5000 });
    } finally {
      this.updatingEpisodeId.set(null);
      this.updatingFlag.set(null);
    }
  }

  toggleBluesky(episode: ApiEpisode) {
    if (this.isUpdating(episode.id)) {
      return;
    }
    const previous = episode.bluesky == true;
    const next = !previous;
    episode.bluesky = next;
    this.refreshEpisodesSignal();
    this.runEpisodeUpdate(
      episode,
      () => next ? this.episodeUpdate.postBluesky(episode) : this.episodeUpdate.unpostBluesky(episode),
      'bluesky'
    ).catch(() => {
      episode.bluesky = previous;
      this.refreshEpisodesSignal();
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

  editPodcast(podcastName: string, episodeId?: string) {
    const dialogRef = this.dialog.open(EditPodcastDialogComponent, {
      data: { podcastName: podcastName, episodeId: episodeId },
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

  index(podcastName: string) {
    const dialogRef = this.dialog.open(PodcastIndexComponent, { disableClose: true, autoFocus: true });
    dialogRef.componentInstance.index(podcastName);
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        let message = "Podcast Indexed";
        let action = "Ok";
        if (result.episodeIds && result.episodeIds.length > 0) {
          message += `. ${result.episodeIds.length} episode${result.episodeIds.length > 1 ? 's' : ''} updated`;
          action = "Review";
        }
        let snackBarRef = this.snackBar.open(message, action, { duration: 10000 });
        if (result.episodeIds && result.episodeIds.length > 0) {
          snackBarRef.onAction().subscribe(() => {
            const episodeId = JSON.stringify(result.episodeIds);
            this.router.navigate(["/episodes", episodeId])
          });
        }
      } else if (result.podcastNotAutoIndex) {
        let snackBarRef = this.snackBar.open("Podcast not indexable", "Ok", { duration: 10000 });
      } else if (result.podcastNotFound) {
        let snackBarRef = this.snackBar.open("Podcast not found", "Ok", { duration: 10000 });
      }
    });
  }
}
