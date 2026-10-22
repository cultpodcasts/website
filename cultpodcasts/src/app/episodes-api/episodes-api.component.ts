import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnChanges, PLATFORM_ID, SimpleChanges, ViewChild, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, UrlTree } from '@angular/router';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, firstValueFrom, forkJoin, map, Observable, of, Subject, switchMap, take } from 'rxjs';
import { environment } from './../../environments/environment';
import { ApiEpisode } from '../api-episode.interface';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, isPlatformBrowser } from '@angular/common';
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
import { EditPodcastDialogData } from '../edit-podcast-dialog-data.interface';
import { EditPodcastDialogComponent } from '../edit-podcast-dialog/edit-podcast-dialog.component';
import { EditPodcastDialogResponse, podcastPostUpdateFlags } from '../edit-podcast-dialog-response.interface';
import { applyTransferredPodcastKindClose, reviewParentLink, reviewPlayableLink } from '../catalogue-links';
import { isNonPodcastPlayableKind } from '../catalogue-playable-kind.enum';
import { isEditableCataloguePlayableKind, openCataloguePlayableEditDialog, playableEditResultMessage } from '../catalogue-playable-edit';
import { EpisodeImageComponent } from "../episode-image/episode-image.component";
import { SubjectsComponent } from "../subjects/subjects.component";
import { EpisodeGuestsComponent } from "../episode-guests/episode-guests.component";
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';
import { EpisodePublishResponseSnackbarComponent } from '../episode-publish-response-snackbar/episode-publish-response-snackbar.component';
import { PostEpisodeDialogResponse } from '../post-episode-dialog-response.interface';
import { PodcastIndexComponent } from '../podcast-index/podcast-index.component';
import { EpisodeUpdateService } from '../episode-update.service';
import { ManualTweetEpisodeDialogComponent } from '../manual-tweet-episode-dialog/manual-tweet-episode-dialog.component';
import { ClampableTextComponent } from '../clampable-text/clampable-text.component';
import { languageFlagBadgeForEpisode, LanguageFlagBadge } from '../language-flag';
import {
  armCuratorSnapAfterScroll,
  observeCuratorSnapToolbar,
  syncCuratorSnapOffset,
  toggleCuratorSnapClass
} from '../curator-snap';
import { HeroCurationService } from '../hero-curation.service';
import { HeroPromoteButtonComponent } from '../hero-promote-button/hero-promote-button.component';
import { isWithinHeroWeek } from '../hero-slides';
import { ViewerLocaleService } from '../viewer-locale';

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

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
    EpisodeGuestsComponent,
    ClampableTextComponent,
    HeroPromoteButtonComponent
  ],
  templateUrl: './episodes-api.component.html',
  styleUrl: './episodes-api.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EpisodesApiComponent implements AfterViewInit, OnChanges {
  /** When set, load these episodes instead of the `:episodeIds` route param (e.g. embedded on /discovery-review/:id). */
  readonly episodeIdsInput = input<readonly string[] | undefined>(undefined, { alias: 'episodeIds' });
  /** Embedded in another page: no snap toolbar, no site query/podcast/subject reset, compact heading. */
  readonly embedded = input<boolean>(false);
  /** Heading text (defaults to the /episodes page title). */
  readonly heading = input<string>('Review Episodes');

  @ViewChild('curatorToolbar', { static: false }) curatorToolbar: ElementRef<HTMLElement> | undefined;

  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;

  protected episodes = signal<ApiEpisode[] | undefined>(undefined);
  protected error = signal<boolean>(false);
  protected isLoading = signal<boolean>(true);
  protected sortDirection = signal<string>(sortParamDateDesc);
  protected updatingEpisodeId = signal<string | null>(null);
  protected updatingFlag = signal<'ignored' | 'removed' | 'tweeted' | 'bluesky' | 'subject' | null>(null);
  protected updatingSubjectName = signal<string | null>(null);
  protected addingGuest = signal<Record<string, string>>({});
  protected readonly curatedEpisodeIds = signal<string[]>([]);
  protected readonly curatedUpdatedAt = signal<string | null>(null);
  protected readonly curatedIdSet = computed(() => new Set(this.curatedEpisodeIds()));

  private destroyRef = inject(DestroyRef);
  private readonly viewerLocale = inject(ViewerLocaleService).locale;
  private route = inject(ActivatedRoute);
  protected auth = inject(AuthServiceWrapper);
  protected authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });
  private readonly platformId = inject(PLATFORM_ID);
  private readonly heroCuration = inject(HeroCurationService);
  /** Row title link by kind (/podcast, /news, /tv, /film); needs `contentKind` from GET /episode/{id}. Podcast episodes use the short id, so the click does not take the GUID 301. */
  protected readonly playableLink = (episode: ApiEpisode): string[] | UrlTree => {
    const link = reviewPlayableLink(episode);
    // The API `path` is already percent-encoded (e.g. /film/One%20Off/…). A plain string routerLink is split into
    // segments and encoded again (%2520), so parse it into a UrlTree, which routerLink uses as-is.
    return typeof link === 'string' ? this.router.parseUrl(link) : link;
  };
  protected readonly parentLink = reviewParentLink;
  private snapOffsetObserver: ResizeObserver | undefined;
  /** Single cancellable load stream: a newer request (ids change / Refresh) cancels any in-flight one. */
  private readonly loadRequests = new Subject<string[]>();
  /** Ids of the last requested load, compared by value to skip identical reloads. */
  private currentIds: string[] | null = null;

  constructor(
    private router: Router,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private siteService: SiteService,
    private episodeUpdate: EpisodeUpdateService
  ) {
    this.destroyRef.onDestroy(() => {
      this.snapOffsetObserver?.disconnect();
      this.snapOffsetObserver = undefined;
      toggleCuratorSnapClass(false);
    });
    this.loadRequests.pipe(
      switchMap(ids => this.fetchEpisodes(ids)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(episodes => {
      if (episodes) {
        this.episodes.set(episodes);
      }
      this.isLoading.set(false);
    });
  }

  ngOnInit() {
    if (!this.embedded()) {
      this.siteService.setQuery(null);
      this.siteService.setPodcast(null);
      this.siteService.setSubject(null);
    }

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    void this.fetchHeroCuration();

    if (this.episodeIdsInput() !== undefined) {
      this.loadEpisodes([...(this.episodeIdsInput() ?? [])]);
      return;
    }
    this.route.params.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      const serialisedEpisodeId = params['episodeIds'];
      this.loadEpisodes(serialisedEpisodeId ? JSON.parse(serialisedEpisodeId) : []);
    });
  }

  /** Reload the current ids only (no new route subscription, hero refetch or site reset). */
  refresh(): void {
    if (this.currentIds !== null) {
      this.loadEpisodes(this.currentIds, true);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes['episodeIdsInput'];
    if (change && !change.firstChange && isPlatformBrowser(this.platformId)) {
      this.loadEpisodes([...(this.episodeIdsInput() ?? [])]);
    }
  }

  /**
   * Requests a load of these ids; shared by the /episodes route and embedded use.
   * Identical ids (by value) are ignored unless `force` (Refresh), so parent reloads don't wipe card edits.
   */
  protected loadEpisodes(episodeIds: readonly string[], force = false): void {
    const ids = [...episodeIds];
    if (!force && this.currentIds !== null && sameIds(this.currentIds, ids)) {
      return;
    }
    this.currentIds = ids;
    this.loadRequests.next(ids);
  }

  /** Token then every episode; any failure (including the token) shows the error state. Emits null on error. */
  private fetchEpisodes(episodeIds: string[]): Observable<ApiEpisode[] | null> {
    this.isLoading.set(true);
    this.error.set(false);
    this.episodes.set([]);
    if (episodeIds.length === 0) {
      return of([]);
    }
    return this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }).pipe(
      take(1),
      switchMap(token => {
        const headers = new HttpHeaders().set("Authorization", "Bearer " + token);
        return forkJoin(episodeIds.map(episodeId => {
          const episodeEndpoint = new URL(`/episode/${episodeId}`, environment.api).toString();
          return this.http.get<ApiEpisode>(episodeEndpoint, { headers }).pipe(this.handleRequest(this).bind(this));
        }));
      }),
      map(episodes => episodes.filter((x): x is ApiEpisode => x != null)),
      catchError(e => {
        console.error(e);
        this.error.set(true);
        return of(null);
      })
    );
  }

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId) || this.embedded()) {
      return;
    }
    this.snapOffsetObserver = observeCuratorSnapToolbar(this.curatorToolbar?.nativeElement);
    armCuratorSnapAfterScroll(this.destroyRef, () => {
      syncCuratorSnapOffset(this.curatorToolbar?.nativeElement);
    });
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

  /** Podcast episode rows (no contentKind, or `Episode`): publish, delete and podcast menu items are podcast-only. */
  protected readonly isPodcastRow = (episode: ApiEpisode) => !isNonPodcastPlayableKind(episode.contentKind);
  /** News report / TV episode / film rows edit through their own dialogs (PATCH /newsreport, /tvshowepisode or /film). */
  protected readonly hasEditDialog = (episode: ApiEpisode) =>
    this.isPodcastRow(episode) || isEditableCataloguePlayableKind(episode.contentKind);

  editRow(episode: ApiEpisode) {
    const kind = episode.contentKind;
    if (isEditableCataloguePlayableKind(kind)) {
      openCataloguePlayableEditDialog(this.dialog, kind, episode.id).afterClosed().subscribe(async result => {
        const message = playableEditResultMessage(kind, result);
        if (message) {
          this.snackBar.open(message, "Ok", { duration: result?.updated ? 10000 : 3000 });
        }
        if (result?.updated) {
          await this.refreshEpisode(episode.id);
        }
      });
      return;
    }
    this.edit(episode.podcastId!, episode.id);
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

  languageBadge(episode: ApiEpisode): LanguageFlagBadge | undefined {
    return languageFlagBadgeForEpisode(episode, this.viewerLocale());
  }

  showHeroPromote(episode: ApiEpisode): boolean {
    return (
      this.authRoles().includes('Curator') &&
      (this.curatedIdSet().has(episode.id) || isWithinHeroWeek(episode.release))
    );
  }

  async togglePromote(episode: ApiEpisode): Promise<void> {
    if (!this.showHeroPromote(episode)) {
      return;
    }
    const previous = this.curatedEpisodeIds();
    const previousUpdatedAt = this.curatedUpdatedAt();
    const wantPromoted = !previous.includes(episode.id);
    this.curatedEpisodeIds.set(
      wantPromoted
        ? [episode.id, ...previous.filter((id) => id !== episode.id)]
        : previous.filter((id) => id !== episode.id)
    );
    try {
      const saved = await this.heroCuration.toggleEpisode(
        episode.id,
        previous,
        previousUpdatedAt
      );
      this.curatedEpisodeIds.set(saved.episodeIds);
      this.curatedUpdatedAt.set(saved.updatedAt);
    } catch {
      this.curatedEpisodeIds.set(previous);
      this.curatedUpdatedAt.set(previousUpdatedAt);
    }
  }

  private async fetchHeroCuration(): Promise<void> {
    const curation = await this.heroCuration.getHeroCuration();
    this.curatedEpisodeIds.set(curation.episodeIds ?? []);
    this.curatedUpdatedAt.set(curation.updatedAt ?? null);
  }

  loadingSubjectName(episodeId: string): string | null {
    if (!this.isUpdating(episodeId) || this.updatingFlag() !== 'subject') {
      return null;
    }
    return this.updatingSubjectName();
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
    flag: 'ignored' | 'removed' | 'tweeted' | 'bluesky' | 'subject' | null = null
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
      this.updatingSubjectName.set(null);
    }
  }

  removeSubject(episode: ApiEpisode, subject: string) {
    if (this.isUpdating(episode.id)) {
      return;
    }
    this.updatingSubjectName.set(subject);
    this.runEpisodeUpdate(episode, () => this.episodeUpdate.removeSubject(episode, subject), 'subject');
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
    if (!this.isPodcastRow(episode)) {
      // POST /episode/publish is podcast-only.
      this.snackBar.open("Tweeting from here is only for podcast episodes", "Ok", { duration: 5000 });
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
    if (next && !this.isPodcastRow(episode)) {
      // POST /episode/publish is podcast-only; removing a post (unBluesky) works for every kind.
      this.snackBar.open("Posting to Bluesky from here is only for podcast episodes", "Ok", { duration: 5000 });
      return;
    }
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
      if (!result || result.closed) {
        return;
      }
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

  editPodcast(data: EditPodcastDialogData) {
    const dialogRef = this.dialog.open(EditPodcastDialogComponent, {
      data,
      disableClose: true,
      autoFocus: true,
      width: '90%'
    });
    dialogRef.afterClosed().subscribe(async (result: EditPodcastDialogResponse | undefined) => {
      if (applyTransferredPodcastKindClose(result, data.podcastName, this.snackBar, this.router)) {
        return;
      }
      if (result?.updated) {
        var message = "Podcast updated";
        const flags = podcastPostUpdateFlags(result.response);
        if (flags.failureIndexingEpisodes) {
          message += ". Some episodes failed to index";
        }
        if (flags.failureDeletingFromIndex) {
          message += ". Some episodes failed to delete from index";
        }
        let snackBarRef = this.snackBar.open(message, "Ok", { duration: 10000 });
      } else if (result?.noChange) {
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
