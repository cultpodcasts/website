import { Component } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProfileService } from '../profile.service';
import { catchError, firstValueFrom, forkJoin, map, Observable, of } from 'rxjs';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from './../../environments/environment';
import { Episode } from '../episode';
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
import { EpisodePublishResponse } from '../episode-publish-response';
import { PostEpisodeModel } from '../post-episode-model';
import { EpisodePublishResponseAdaptor } from '../episode-publish-response-adaptor';
import { BookmarkComponent } from "../bookmark/bookmark.component";
import { SubjectsComponent } from "../subjects/subjects.component";
import { ScrollDispatcher, ScrollingModule } from '@angular/cdk/scrolling';

export enum sortMode {
  addDatedAsc = 1,
  addDatedDesc,
  releaseDateDesc,
  releaseDateAsc
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
  styleUrl: './bookmarks-api.component.sass'
})
export class BookmarksApiComponent {
  isLoading: boolean = true;
  error: boolean = false;
  private episodes: Set<Episode> = new Set<Episode>();
  protected episodeItems: Episode[] = [];
  sortDirection: sortMode = sortMode.addDatedDesc;
  protected sortMode = sortMode;
  authRoles: string[] = [];
  isSignedIn: boolean = false;
  noBookmarks: boolean = false;
  private take: number = 3;
  private page: number = 0;
  bookmarks: Set<string> = new Set<string>();

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
      this.bookmarks = bookmarks;
      await this.batch(true);
    });
  }

  async batch(first: boolean = false) {
    if (this.bookmarks.size > 0) {
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
        const start = this.page * this.take;
        const end = start + this.take;
        if (start >= this.bookmarks.size) {
          return;
        }
        Array.from(this.bookmarks).slice(start, end).forEach(episodeId => {
          const episodeEndpoint = new URL(`/public/episode/${episodeId}`, environment.api).toString();
          const get = this.http.get<Episode>(episodeEndpoint, { headers: headers }).pipe(this.handleRequest(this).bind(this))
          episodeResponses.push(get);
        })
        forkJoin(episodeResponses).subscribe({
          next: episodes => {
            (episodes.filter(x => x != null)).forEach(item => this.episodes.add(item));
            this.episodeItems = {...Array.from(this.episodes)};
            console.log("this.episodeItems size", this.episodeItems.length, this.episodeItems);

            this.isLoading = false;

            if (first && this.bookmarks.size > this.take) {
              this.scrollDisplatcher.scrolled().subscribe(async () => {
                if (this.isScrolledToBottom()) {
                  console.log("scrolled to bottom");
                  this.page++;
                  await this.batch();
                }
              });
            }
          },
          error: e => {
            this.error = true;
            this.isLoading = false;
            console.error(e);
          }
        })
      });
    } else {
      this.error = false;
      this.isLoading = false;
      this.noBookmarks = true;
    }
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

  private isScrolledToBottom(): boolean {
    const scrollPosition = window.scrollY + window.innerHeight;
    const threshold = document.documentElement.scrollHeight - 1;
    return scrollPosition >= threshold;
  }

}
