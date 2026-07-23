import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import { FeatureSwitch } from '../feature-switch.enum';
import { FeatureSwitchService } from '../feature-switch-service';
import { ManualTweetEpisodeDialogComponent } from '../manual-tweet-episode-dialog/manual-tweet-episode-dialog.component';

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
  styleUrl: './outgoing-episodes-api.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OutgoingEpisodesApiComponent {
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;
  protected FeatureSwitch = FeatureSwitch;

  protected episodes = signal<ApiEpisode[] | undefined>(undefined);
  protected error = signal<boolean>(false);
  protected isLoading = signal<boolean>(true);
  protected sortDirection = signal<string>(sortParamDateDesc);

  days = signal<number | undefined>(undefined);
  posted = signal<boolean | undefined>(undefined);
  tweeted = signal<boolean | undefined>(undefined);
  blueskyPosted = signal<boolean | undefined>(true);
  token: string = "";
  protected updatingEpisodeId = signal<string | null>(null);
  protected updatingFlag = signal<'ignored' | 'removed' | 'tweeted' | 'bluesky' | null>(null);
  protected addingGuest = signal<{ [episodeId: string]: string }>({});

  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  protected auth = inject(AuthServiceWrapper);
  protected authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private siteService: SiteService,
    private episodeUpdate: EpisodeUpdateService,
    protected featureSwitchService: FeatureSwitchService
  ) {
  }

  ngOnInit() {
    this.siteService.setQuery(null);
    this.siteService.setPodcast(null);
    this.siteService.setSubject(null);

    const daysValue: string | null = localStorage.getItem(daysKey);
    if (daysValue && parseInt(daysValue)) {
      this.days.set(parseInt(daysValue));
    }

    this.isLoading.set(true);
    this.error.set(false);
    this.episodes.set([]);

    this.route.params.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
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
        this.isLoading.set(false);
        this.error.set(true);
        console.error(x);
      });
    })
  }

  reset() {
    this.posted.set(undefined);
    this.tweeted.set(undefined);
    this.blueskyPosted.set(true);
    this.days.set(undefined);
    this.ngOnInit()
  }

  setSort(sort: string) {
    this.sortDirection.set(sort);
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

  private refreshEpisodesSignal() {
    const current = this.episodes();
    if (current) {
      this.episodes.set([...current]);
    }
  }

  async refreshEpisode(episodeId: string) {
    try {
      const updated = await this.episodeUpdate.fetchEpisode(episodeId);
      this.episodes.set(this.episodeUpdate.replaceEpisode(this.episodes(), updated));
    } catch (e) {
      console.error(e);
    }
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
      this.episodes.set(this.episodeUpdate.replaceEpisode(this.episodes(), updated));
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
    this.addingGuest.update(g => ({ ...g, [episode.id]: guestName }));

    const nextGuestNames = previousGuestNames.includes(guestName)
      ? previousGuestNames
      : [...previousGuestNames, guestName];

    this.episodeUpdate.setGuests(episode, nextGuestNames)
      .then(updated => {
        this.episodes.set(this.episodeUpdate.replaceEpisode(this.episodes(), updated));
      })
      .catch(e => {
        console.error(e);
        episode.guestPeople = previousGuests;
        episode.guestSuggestions = previousSuggestions;
        this.refreshEpisodesSignal();
        this.snackBar.open("Failed to add guest", "Ok", { duration: 5000 });
      })
      .finally(() => {
        this.addingGuest.update(g => {
          const next = { ...g };
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
        this.episodes.set(this.episodeUpdate.replaceEpisode(this.episodes(), updated));
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
          this.episodes.set(this.episodeUpdate.replaceEpisode(this.episodes(), updated));
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

  getEpisodes() {
    this.isLoading.set(true);
    let headers: HttpHeaders = new HttpHeaders();
    headers = headers.set("Authorization", "Bearer " + this.token);

    const url = new URL(`/episodes/outgoing`, environment.api);
    if (this.days())
      url.searchParams.append("days", this.days()!.toString());
    if (this.tweeted())
      url.searchParams.append("tweeted", this.tweeted()!.toString());
    if (this.featureSwitchService.IsEnabled(FeatureSwitch.redditPost) && this.posted())
      url.searchParams.append("posted", this.posted()!.toString());
    if (this.blueskyPosted())
      url.searchParams.append("blueskyPosted", this.blueskyPosted()!.toString())
    const episodeEndpoint = url.toString();
    this.http.get<ApiEpisode[]>(episodeEndpoint, { headers: headers, observe: "response" })
      .subscribe(
        {
          next: resp => {
            this.isLoading.set(false);
            this.error.set(false);
            this.episodes.set(resp.body!);
          },
          error: e => {
            this.isLoading.set(false);
            this.error.set(true);
            console.error(e);
          }
        }
      );
  }

  openSetDays() {
    var _days = this.days() || 7;
    this.dialog
      .open(SetNumberOfDaysComponent, { disableClose: true, autoFocus: true, data: { days: _days } })
      .afterClosed()
      .subscribe(async result => {
        if (result?.days && parseInt(result.days)) {
          var days = parseInt(result.days);
          if (days != _days) {
            localStorage.setItem(daysKey, days.toString());
            this.days.set(days);
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
