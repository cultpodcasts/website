import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, forkJoin, Observable } from 'rxjs';
import { environment } from './../../environments/environment';
import { Episode } from '../episode';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, isPlatformBrowser, NgClass, NgFor, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { Title } from '@angular/platform-browser';
import { PostEpisodeDialogComponent } from '../post-episode-dialog/post-episode-dialog.component';

const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";

@Component({
  selector: 'app-episodes',
  standalone: true,
  imports: [
    NgIf,
    MatProgressBarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    NgClass,
    NgFor,
    MatCardModule,
    RouterLink,
    DatePipe

  ],
  templateUrl: './episodes.component.html',
  styleUrl: './episodes.component.sass'
})
export class EpisodesComponent {
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;

  episodes: Episode[] | undefined;
  error: boolean = false;
  isLoading: boolean = true;
  sortDirection: string = sortParamDateDesc;
  isBrowser: boolean;

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    @Inject(PLATFORM_ID) platformId: any,
    private title: Title
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    title.setTitle("Review");
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.isLoading = true;
      this.error = false;
      this.episodes = [];
      this.route.params.subscribe(params => {
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

          const episodeResponses: Observable<Episode>[] = [];
          episodeIds.forEach(episodeId => {
            const episodeEndpoint = new URL(`/episode/${episodeId}`, environment.api).toString();
            const get = this.http.get<Episode>(episodeEndpoint, { headers: headers })
            episodeResponses.push(get);
          })
          forkJoin(episodeResponses).subscribe({
            next: episodes => {
              this.episodes = episodes;
              this.isLoading = false;
            },
            error: e => {
              this.error = true;
              this.isLoading = false;
              console.error(e);
            }
          })
        });
      })
    }
  }

  setSort(sort: string) {
    if (sort != sortParamDateDesc) {
      this.episodes = this.episodes?.sort((a: Episode, b: Episode) => {
        return a.release.getTime() - b.release.getTime();
      })
    } else {
      this.episodes = this.episodes?.sort((a: Episode, b: Episode) => {
        return b.release.getTime() - a.release.getTime();
      })
    }
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
    const dialogRef = this.dialog.open(PostEpisodeDialogComponent, {
      data: { episodeId: id },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.noChange) {
        let snackBarRef = this.snackBar.open("No change made", "Ok", { duration: 10000 });
      } else if (result.response) {
        let message: string = "Episode tweeted and posted";
        if (!result.response.tweeted && result.response.posted) {
          message = "Episode posted";
          if (result.expectation.tweet) {
            message += ". Failed to tweet";
          }
        } else if (result.response.tweeted && !result.response.posted) {
          message = "Episode tweeted";
          if (result.expectation.post) {
            message += ". Failed to post";
          }
        }
        let snackBarRef = this.snackBar.open(message, "Ok", { duration: 10000 });
      }
    });
  }
}
