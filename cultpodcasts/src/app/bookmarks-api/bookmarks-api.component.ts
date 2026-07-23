import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProfileService } from '../profile.service';
import { catchError, firstValueFrom, forkJoin, map, Observable, of, take } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from './../../environments/environment';
import { ApiEpisode } from '../api-episode.interface';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { EpisodeImageComponent } from '../episode-image/episode-image.component';
import { EpisodePodcastLinksComponent } from '../episode-podcast-links/episode-podcast-links.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { PostEpisodeDialogComponent } from '../post-episode-dialog/post-episode-dialog.component';
import { BookmarkComponent } from "../bookmark/bookmark.component";
import { SubjectsComponent } from "../subjects/subjects.component";
import { ScrollDispatcher, ScrollingModule } from '@angular/cdk/scrolling';
import { InfiniteScrollStrategy } from '../infinite-scroll-strategy';
import { SiteService } from '../site.service';
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';
import { EpisodePublishResponseSnackbarComponent } from '../episode-publish-response-snackbar/episode-publish-response-snackbar.component';
import { PostEpisodeDialogResponse } from '../post-episode-dialog-response.interface';

export enum sortMode {
  addDatedAsc = 1,
  addDatedDesc
}

const pageSize = 10;

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
    MatProgressBarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    MatCardModule,
    RouterLink,
    DatePipe,
    EpisodePodcastLinksComponent,
    EpisodeImageComponent,
    BookmarkComponent,
    SubjectsComponent,
    ScrollingModule
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
  protected isSignedIn = toSignal(this.auth.isSignedIn, { initialValue: false });
  protected noBookmarks = signal<boolean>(false);
  protected episodes = signal<ApiEpisode[]>([]);
  protected sortDirection: sortMode = sortMode.addDatedDesc;
  private page: number = 0;
  private bookmarks: Set<string> | undefined;
  private scrollSubscribed = false;
  private destroyRef = inject(DestroyRef);

  constructor(
    private profileService: ProfileService,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private scrollDispatcher: ScrollDispatcher,
    private infiniteScrollStrategy: InfiniteScrollStrategy,
    private siteService: SiteService
  ) {
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
      await this.batch(true);
      return;
    }

    this.profileService.bookmarks$.pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(async bookmarks => {
      this.bookmarks = bookmarks;
      await this.batch(true);
    });
  }

  async batch(first: boolean = false) {
    const start = this.page * pageSize;
    const end = start + pageSize;
    if (start >= this.bookmarks!.size) {
      if (this.bookmarks!.size == 0) {
        this.zeroBookmarks();
      }
      return;
    }
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
        if (this.sortDirection == sortMode.addDatedDesc) {
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
            if (!this.scrollSubscribed && first && this.bookmarks!.size > pageSize) {
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
          let snackBarRef = this.snackBar.open("Episode updated", "Ok", { duration: 10000 });
        } else if (result.noChange) {
          let snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
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
    this.sortDirection = mode;
    await this.reset();
  }

  private isScrolledToBottom(): boolean {
    const scrollPosition = window.scrollY + window.innerHeight;
    const threshold = document.documentElement.scrollHeight - this.infiniteScrollStrategy.getYThreshold(this.page);
    return scrollPosition >= threshold;
  }
}
