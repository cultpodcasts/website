import { Component, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProfileService } from '../profile.service';
import { catchError, firstValueFrom, forkJoin, map, Observable, of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

const take: number = 10;

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
  protected episodes = signal<ApiEpisode[]>([]);
  protected sortDirection: sortMode = sortMode.addDatedDesc;
  private page: number = 0;
  private bookmarks: Set<string> | undefined;

  constructor(
    private profileService: ProfileService,
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private scrollDisplatcher: ScrollDispatcher,
    private infiniteScrollStrategy: InfiniteScrollStrategy,
    private siteService: SiteService
  ) {
    this.auth.roles.subscribe(roles => this.authRoles = roles);
    this.auth.isSignedIn.subscribe(isSignedIn => this.isSignedIn = isSignedIn);
  }

  ngOnInit() {
    this.siteService.setQuery(null);
    this.siteService.setPodcast(null);
    this.siteService.setSubject(null);
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
        const episodeResponses: Observable<ApiEpisode | null>[] = [];
        let orderedBookmarks = Array.from(this.bookmarks!);
        if (this.sortDirection == sortMode.addDatedDesc) {
          orderedBookmarks = orderedBookmarks.reverse();
        }
        const items = orderedBookmarks.slice(start, end);
        items.forEach(episodeId => {
          const episodeEndpoint = new URL(`/public/episode/${episodeId}`, environment.api).toString();
          const get = this.http.get<ApiEpisode>(episodeEndpoint, { headers: headers }).pipe(this.handleRequest(this).bind(this))
          episodeResponses.push(get);
        })
        forkJoin(episodeResponses).subscribe({
          next: episodes => {
            this.episodes.update(v => v.concat(episodes.filter(x => x != null)));
            this.isLoading = false;
            this.isSubsequentLoading.set(false);
            if (first && this.bookmarks!.size > take) {
              this.scrollDisplatcher.scrolled().subscribe(async () => {
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
    const dialogRef = this.dialog.open<EditEpisodeDialogComponent, any, EditEpisodeDialogResponse>(EditEpisodeDialogComponent, {
      data: { episodeId: id },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        if (result.response && !result.response.blueskyPostDeleted || !result.response?.tweetDeleted) {
          console.error(result.response);
        }
        if (result.updated) {
          let snackBarRef = this.snackBar.open("Episode updated", "Ok", { duration: 10000 });
        } else if (result.noChange) {
          let snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
        }
      }
    });
  }

  post(id: string) {
    const dialogRef = this.dialog
      .open<PostEpisodeDialogComponent, any, PostEpisodeDialogResponse>(PostEpisodeDialogComponent, {
        data: { episodeId: id },
        disableClose: true,
        autoFocus: true
      });
    dialogRef.afterClosed().subscribe(async result => {
      this.snackBar.openFromComponent(EpisodePublishResponseSnackbarComponent,
        { duration: 10000, data: { postEpisodeDialogResponse: result, episodeId: id } });
    });
  }

  async reset() {
    this.isLoading = true;
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
