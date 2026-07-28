import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ProfileService } from '../profile.service';
import { catchError, firstValueFrom, forkJoin, map, Observable, of, take } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from './../../environments/environment';
import { ApiEpisode } from '../api-episode.interface';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { PostEpisodeDialogComponent } from '../post-episode-dialog/post-episode-dialog.component';
import { BookmarkComponent } from '../bookmark/bookmark.component';
import { ScrollDispatcher, ScrollingModule } from '@angular/cdk/scrolling';
import { InfiniteScrollStrategy } from '../infinite-scroll-strategy';
import { SiteService } from '../site.service';
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';
import { EpisodePublishResponseSnackbarComponent } from '../episode-publish-response-snackbar/episode-publish-response-snackbar.component';
import { PostEpisodeDialogResponse } from '../post-episode-dialog-response.interface';
import { EpisodePosterComponent } from '../episode-poster/episode-poster.component';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';
import { BrowseLoadingSkeletonComponent } from '../browse-loading-skeleton/browse-loading-skeleton.component';
import { apiEpisodeToHomepageEpisode } from '../api-episode-display';
import { SearchDisplayEpisode } from '../search-result-links';
import { canPlayEpisode } from '../episode-embed';
import { PlayerService } from '../player.service';

export enum sortMode {
  addDatedAsc = 1,
  addDatedDesc
}

const removedEpisodesMessage =
  'Cultpodcasts.com has removed episodes it finds unsuitable.';

interface BookmarkEpisodeLoadResult {
  episode: ApiEpisode | null;
  notFound: boolean;
  failed: boolean;
}

@Component({
  selector: 'app-bookmarks-api',
  imports: [
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    BookmarkComponent,
    ScrollingModule,
    EpisodePosterComponent,
    SiteLoadingComponent,
    BrowseLoadingSkeletonComponent,
  ],
  templateUrl: './bookmarks-api.component.html',
  styleUrl: './bookmarks-api.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class BookmarksApiComponent {
  protected isLoading = signal<boolean>(true);
  protected isSubsequentLoading = signal<boolean>(false);
  protected error = signal<boolean>(false);
  protected removedEpisodesNotice = signal<boolean>(false);
  protected readonly removedEpisodesMessage = removedEpisodesMessage;
  protected sortMode = sortMode;
  protected auth = inject(AuthServiceWrapper);
  protected authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });
  protected noBookmarks = signal<boolean>(false);
  protected episodes = signal<ApiEpisode[]>([]);
  protected displayEpisodes = computed(() =>
    this.episodes().map(apiEpisodeToHomepageEpisode)
  );
  protected sortDirection = signal<sortMode>(sortMode.addDatedDesc);
  protected readonly playerService = inject(PlayerService);
  protected bookmarkTotal = signal(0);
  protected readonly resultsHeading = computed(() => {
    const n = this.bookmarkTotal();
    if (this.noBookmarks() || n === 0) {
      return 'My Bookmarks';
    }
    return n === 1 ? '1 bookmark' : `${n} bookmarks`;
  });
  protected readonly sortLabel = computed(() =>
    this.sortDirection() === sortMode.addDatedAsc
      ? 'Oldest bookmarked'
      : 'Newest bookmarked'
  );
  private page: number = 0;
  private bookmarks: Set<string> | undefined;
  private scrollSubscribed = false;
  private destroyRef = inject(DestroyRef);
  private readonly pageSize: number;

  constructor(
    private profileService: ProfileService,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private scrollDispatcher: ScrollDispatcher,
    private infiniteScrollStrategy: InfiniteScrollStrategy,
    private siteService: SiteService
  ) {
    this.pageSize = this.infiniteScrollStrategy.getTake(1);
  }

  ngOnInit() {
    this.siteService.setQuery(null);
    this.siteService.setPodcast(null);
    this.siteService.setSubject(null);
    this.populatePage();
  }

  async populatePage() {
    this.error.set(false);
    this.removedEpisodesNotice.set(false);
    this.isLoading.set(true);
    this.episodes.set([]);
    this.page = 0;

    if (this.bookmarks) {
      this.bookmarkTotal.set(this.bookmarks.size);
      await this.batch(true);
      return;
    }

    this.profileService.bookmarks$.pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(async bookmarks => {
      this.bookmarks = bookmarks;
      this.bookmarkTotal.set(bookmarks.size);
      await this.batch(true);
    });
  }

  async batch(first: boolean = false) {
    const start = this.page * this.pageSize;
    const end = start + this.pageSize;
    if (start >= this.bookmarks!.size) {
      if (this.bookmarks!.size == 0) {
        this.zeroBookmarks();
      }
      return;
    }
    this.bookmarkTotal.set(this.bookmarks!.size);
    if (!first) {
      this.isSubsequentLoading.set(true);
    }
    if (this.bookmarks!.size > 0) {
      this.noBookmarks.set(false);
      // Bookmarks are available to any signed-in user; do not require curator scope.
      firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: ''
        }
      })).then(_token => {
        let headers: HttpHeaders = new HttpHeaders();
        headers = headers.set("Authorization", "Bearer " + _token);
        const episodeResponses: Observable<BookmarkEpisodeLoadResult>[] = [];
        let orderedBookmarks = Array.from(this.bookmarks!);
        if (this.sortDirection() == sortMode.addDatedDesc) {
          orderedBookmarks = orderedBookmarks.reverse();
        }
        const items = orderedBookmarks.slice(start, end);
        items.forEach(episodeId => {
          const episodeEndpoint = new URL(`/public/episode/${episodeId}`, environment.api).toString();
          const get = this.http.get<ApiEpisode>(episodeEndpoint, { headers: headers }).pipe(this.handleRequest())
          episodeResponses.push(get);
        })
        forkJoin(episodeResponses).subscribe({
          next: episodes => {
            const loaded = episodes
              .filter((x): x is BookmarkEpisodeLoadResult & { episode: ApiEpisode } => x.episode != null)
              .map(x => x.episode);
            const hasRemoved = episodes.some(x => x.notFound);
            const hasFailure = episodes.some(x => x.failed);

            if (hasRemoved) {
              this.removedEpisodesNotice.set(true);
            }
            this.episodes.update(v => v.concat(loaded));
            if (hasFailure) {
              this.error.set(true);
            } else if (loaded.length === 0 && items.length > 0 && !hasRemoved) {
              this.error.set(true);
            }
            this.isLoading.set(false);
            this.isSubsequentLoading.set(false);
            if (!this.scrollSubscribed && first && this.bookmarks!.size > this.pageSize) {
              this.scrollSubscribed = true;
              this.scrollDispatcher.scrolled().pipe(
                takeUntilDestroyed(this.destroyRef)
              ).subscribe(async () => {
                if (
                  this.bookmarks &&
                  this.episodes().length < this.bookmarks.size &&
                  this.isScrolledToBottom() &&
                  this.episodes().length > 0 &&
                  !this.isSubsequentLoading()) {
                  this.page++;
                  await this.batch();
                }
              });
            }
          },
          error: e => {
            this.error.set(true);
            this.isLoading.set(false);
            this.isSubsequentLoading.set(false);
            console.error(e);
          }
        })
      }).catch(e => {
        this.error.set(true);
        this.isLoading.set(false);
        this.isSubsequentLoading.set(false);
        console.error(e);
      });
    } else {
      this.zeroBookmarks();
    }
  }

  zeroBookmarks() {
    this.error.set(false);
    this.isLoading.set(false);
    this.isSubsequentLoading.set(false);
    this.noBookmarks.set(true);
    this.bookmarkTotal.set(0);
  }

  handleRequest() {
    return (observable: Observable<ApiEpisode>) => {
      return observable.pipe(
        map((result): BookmarkEpisodeLoadResult => ({
          episode: result,
          notFound: false,
          failed: false
        })),
        catchError((err: HttpErrorResponse): Observable<BookmarkEpisodeLoadResult> => {
          if (err.status === 404) {
            return of({ episode: null, notFound: true, failed: false });
          }
          console.error(err);
          return of({ episode: null, notFound: false, failed: true });
        })
      );
    };
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
        } else if (result.noChange) {
          this.snackBar.open("No change", "Ok", { duration: 3000 });
        }
      }
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

  async reset() {
    this.error.set(false);
    this.removedEpisodesNotice.set(false);
    this.isLoading.set(true);
    this.episodes.set([]);
    this.page = 0;
    await this.batch(true);
  }

  async setSort(mode: sortMode) {
    this.sortDirection.set(mode);
    await this.reset();
  }

  playEpisode(episode: SearchDisplayEpisode): void {
    if (!canPlayEpisode(episode)) {
      return;
    }
    this.playerService.play(episode);
  }

  isPlayingId(id: string): boolean {
    return this.playerService.episode()?.id === id;
  }

  isQueuedId(id: string): boolean {
    return this.playerService.isQueuedId(id);
  }

  private isScrolledToBottom(): boolean {
    const scrollPosition = window.scrollY + window.innerHeight;
    const threshold = document.documentElement.scrollHeight - this.infiniteScrollStrategy.getYThreshold(this.page);
    return scrollPosition >= threshold;
  }
}
