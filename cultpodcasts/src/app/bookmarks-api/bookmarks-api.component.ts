import { Component, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProfileService } from '../profile.service';
import { catchError, firstValueFrom, forkJoin, map, Observable, of, ReplaySubject } from 'rxjs';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from './../../environments/environment';
import { Episode } from '../episode';
import { AsyncPipe, DatePipe } from '@angular/common';
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
import { EpisodePublishResponse } from '../episode-publish-response';
import { PostEpisodeModel } from '../post-episode-model';
import { EpisodePublishResponseAdaptor } from '../episode-publish-response-adaptor';
import { BookmarkComponent } from "../bookmark/bookmark.component";
import { SubjectsComponent } from "../subjects/subjects.component";
import { ScrollDispatcher, ScrollingModule } from '@angular/cdk/scrolling';

export enum sortMode {
  addDatedAsc = 1,
  addDatedDesc
}

const take: number = 3;

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
    ScrollingModule,
    AsyncPipe
  ],
  templateUrl: './bookmarks-api.component.html',
  styleUrl: './bookmarks-api.component.sass'
})
export class BookmarksApiComponent {
  protected isLoading: boolean = true;
  protected isSubsequentLoading = signal<boolean>(false);
  protected error: boolean = false;
  protected sortMode = sortMode;
  protected authRoles: string[] = [];
  protected isSignedIn: boolean = false;
  protected noBookmarks: boolean = false;
  protected episodes$: ReplaySubject<Episode[]> = new ReplaySubject<Episode[]>(1);
  protected sortDirection: sortMode = sortMode.addDatedDesc;
  private page: number = 0;
  private bookmarks: Set<string> | undefined;
  private episodes: Episode[] = [];

  constructor(
    private profileService: ProfileService,
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private scrollDisplatcher: ScrollDispatcher
  ) {
    this.auth.roles.subscribe(roles => this.authRoles = roles);
    this.auth.isSignedIn.subscribe(isSignedIn => this.isSignedIn = isSignedIn);
  }

  ngOnInit() {
    this.populatePage();
  }

  async populatePage() {
    this.profileService.bookmarks$.subscribe(async bookmarks => {
      console.log("bookmarks", bookmarks);
      if (!this.bookmarks) {
        this.bookmarks = bookmarks;
        this.batch(true);
      }
    });
  }

  async batch(first: boolean = false) {
    const start = this.page * take;
    const end = start + take;
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
      this.noBookmarks = false;
      var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'curate'
        }
      }));
      token.then(_token => {
        let headers: HttpHeaders = new HttpHeaders();
        headers = headers.set("Authorization", "Bearer " + _token);

        const episodeResponses: Observable<Episode | null>[] = [];
        let orderedBookmarks = Array.from(this.bookmarks!);
        if (this.sortDirection == sortMode.addDatedDesc) {
          orderedBookmarks = orderedBookmarks.reverse();
        }
        const items = orderedBookmarks.slice(start, end);

        items.forEach(episodeId => {
          const episodeEndpoint = new URL(`/public/episode/${episodeId}`, environment.api).toString();
          const get = this.http.get<Episode>(episodeEndpoint, { headers: headers }).pipe(this.handleRequest(this).bind(this))
          episodeResponses.push(get);
        })
        forkJoin(episodeResponses).subscribe({
          next: episodes => {
            this.episodes = this.episodes.concat(episodes.filter(x => x != null));
            this.episodes$.next(this.episodes);

            this.isLoading = false;
            this.isSubsequentLoading.set(false);

            if (first && this.bookmarks!.size > take) {
              this.scrollDisplatcher.scrolled().subscribe(async () => {
                if (this.isScrolledToBottom() && this.episodes.length > 0 && !this.isSubsequentLoading()) {
                  this.page++;
                  await this.batch();
                }
              });
            }
          },
          error: e => {
            this.error = true;
            this.isLoading = false;
            this.isSubsequentLoading.set(false);
            console.error(e);
          }
        })
      });
    } else {
      this.zeroBookmarks();
    }
  }

  zeroBookmarks() {
    this.error = false;
    this.isLoading = false;
    this.isSubsequentLoading.set(false);
    this.noBookmarks = true;
  }

  handleRequest(that: any) {
    return function (observable: Observable<any>) {
      return observable.pipe(
        map((result) => {
          return result;
        }),
        catchError((err) => {
          console.error(err);
          that.error = true;
          return of(null);
        })
      );
    };
  }

  edit(id: string) {
    const dialogRef = this.dialog.open(EditEpisodeDialogComponent, {
      data: { episodeId: id },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        let snackBarRef = this.snackBar.open("Episode updated", "Ok", { duration: 10000 });
      } else if (result.noChange) {
        let snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
    });
  }

  post(id: string) {
    const dialogRef = this.dialog.open<PostEpisodeDialogComponent, any, {
      response?: EpisodePublishResponse,
      expectation?: PostEpisodeModel,
      noChange?: boolean
    }>(PostEpisodeDialogComponent, {
      data: { episodeId: id },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result!.noChange) {
        let snackBarRef = this.snackBar.open("No change made", "Ok", { duration: 10000 });
      } else if (result?.response && result.expectation) {
        var messageBuilde = new EpisodePublishResponseAdaptor();
        const message = messageBuilde.createMessage(result.response, result.expectation);
        let snackBarRef = this.snackBar.open(message, "Ok", { duration: 10000 });
      }
    });
  }

  async reset() {
    this.isLoading = true;
    this.episodes = [];
    this.episodes$.next(this.episodes);
    this.page = 0;
    await this.batch(true);
  }

  async setSort(mode: sortMode) {
    this.sortDirection = mode;
    await this.reset();
  }

  private isScrolledToBottom(): boolean {
    const scrollPosition = window.scrollY + window.innerHeight;
    const threshold = document.documentElement.scrollHeight - 1;
    return scrollPosition >= threshold;
  }
}
