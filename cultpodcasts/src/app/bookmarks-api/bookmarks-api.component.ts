import { Component } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ProfileService } from '../profile.service';
import { catchError, firstValueFrom, forkJoin, map, Observable, of } from 'rxjs';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from './../../environments/environment';
import { Episode } from '../episode';
import { NgClass, DatePipe } from '@angular/common';
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
    NgClass,
    MatCardModule,
    RouterLink,
    DatePipe,
    EpisodePodcastLinksComponent,
    EpisodeImageComponent,
    BookmarkComponent
  ],
  templateUrl: './bookmarks-api.component.html',
  styleUrl: './bookmarks-api.component.sass'
})
export class BookmarksApiComponent {
  isLoading: boolean = true;
  error: boolean = false;
  private episodes: Episode[] = [];
  protected sortedEpisodes: Episode[] = [];

  sortDirection: sortMode = sortMode.addDatedDesc;
  protected sortMode = sortMode;
  authRoles: string[] = [];
  noBookmarks: boolean = false;
  constructor(
    private profileService: ProfileService,
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.auth.roles.subscribe(roles => this.authRoles = roles);
  }

  ngOnInit() {
    this.populatePage();
  }

  async populatePage() {
    this.profileService.bookmarks$.subscribe(bookmarks => {
      if (bookmarks.size > 0) {
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
          bookmarks.forEach(episodeId => {
            const episodeEndpoint = new URL(`/public/episode/${episodeId}`, environment.api).toString();
            const get = this.http.get<Episode>(episodeEndpoint, { headers: headers }).pipe(this.handleRequest(this).bind(this))
            episodeResponses.push(get);
          })
          forkJoin(episodeResponses).subscribe({
            next: episodes => {
              this.episodes = episodes.filter(x => x != null);
              this.setSort(this.sortDirection);
              this.isLoading = false;
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
    });
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

  setSort(mode: sortMode) {
    var episodes: Episode[] = [];
    this.episodes.forEach(val => episodes.push(Object.assign({}, val)));
    switch (mode) {
      case sortMode.addDatedAsc: {
        this.sortedEpisodes = episodes;
        break;
      }
      case sortMode.addDatedDesc: {
        this.sortedEpisodes = episodes.reverse();
        break;
      }
      case sortMode.releaseDateAsc: {
        this.sortedEpisodes = episodes.sort((n1, n2) => {
          let n1Release = n1.release.getTime();
          let n2Release = n2.release.getTime();
          if (n1Release > n2Release) {
            return 1;
          }
          if (n1Release < n2Release) {
            return -1;
          }
          return 0;
        })
        break;
      };
      case sortMode.releaseDateDesc: {
        this.sortedEpisodes = episodes.sort((n1, n2) => {
          let n1Release = n1.release.getTime();
          let n2Release = n2.release.getTime();
          if (n1Release > n2Release) {
            return -1;
          }
          if (n1Release < n2Release) {
            return 1;
          }
          return 0;
        })
        break;
      };
      default: {
        console.error("Unhandled sort-mode", mode);
        break;
      }
    }
    this.sortDirection = mode;
  }
}
