import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { EpisodePublishResponse } from '../episode-publish-response.interface';
import { PostEpisodeModel } from '../post-episode-model.interface';
import { EpisodePublishResponseAdaptor } from '../episode-publish-response-adaptor';
import { EpisodeStatusComponent } from "../episode-status/episode-status.component";
import { EpisodePodcastLinksComponent } from "../episode-podcast-links/episode-podcast-links.component";
import { DeleteEpisodeDialogComponent } from '../delete-episode-dialog/delete-episode-dialog.component';
import { EditPodcastDialogComponent } from '../edit-podcast-dialog/edit-podcast-dialog.component';
import { EpisodeImageComponent } from "../episode-image/episode-image.component";
import { SubjectsComponent } from "../subjects/subjects.component";
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';

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
    SubjectsComponent
  ],
  templateUrl: './episodes-api.component.html',
  styleUrl: './episodes-api.component.sass'
})
export class EpisodesApiComponent {
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;

  episodes: ApiEpisode[] | undefined;
  error: boolean = false;
  isLoading: boolean = true;
  sortDirection: string = sortParamDateDesc;
  authRoles: string[] = [];

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private siteService: SiteService
  ) {
    this.auth.roles.subscribe(roles => this.authRoles = roles);
  }

  ngOnInit() {
    this.siteService.setQuery(null);
    this.siteService.setPodcast(null);
    this.siteService.setSubject(null);

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

        const episodeResponses: Observable<ApiEpisode | null>[] = [];
        episodeIds.forEach(episodeId => {
          const episodeEndpoint = new URL(`/episode/${episodeId}`, environment.api).toString();
          const get = this.http.get<ApiEpisode>(episodeEndpoint, { headers: headers }).pipe(this.handleRequest(this).bind(this))
          episodeResponses.push(get);
        })
        forkJoin(episodeResponses).subscribe({
          next: episodes => {
            this.episodes = episodes.filter(x => x != null);
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

  handleRequest(that: any) {
    return function (observable: Observable<any>) {
      return observable.pipe(
        map((result) => {
          return result;
        }),
        catchError((err) => {
          console.log(err);
          that.error = true;
          return of(null);
        })
      );
    };
  }

  setSort(sort: string) {
    if (sort != sortParamDateDesc) {
      this.episodes = this.episodes?.sort((a: ApiEpisode, b: ApiEpisode) => {
        return a.release.getTime() - b.release.getTime();
      })
    } else {
      this.episodes = this.episodes?.sort((a: ApiEpisode, b: ApiEpisode) => {
        return b.release.getTime() - a.release.getTime();
      })
    }
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
        if (result.response.failedTweetContent) {
          console.error(result.response.failedTweetContent)
        }
      }
    });
  }

  delete(id: string) {
    const dialogRef = this.dialog.open(DeleteEpisodeDialogComponent, {
      data: { episodeId: id },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.deleted) {
        let snackBarRef = this.snackBar.open("Episode deleted.", "Ok", { duration: 10000 });
      }
    });
  }

  editPodcast(podcastName: string) {
    const dialogRef = this.dialog.open(EditPodcastDialogComponent, {
      data: { podcastName: podcastName },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        let snackBarRef = this.snackBar.open("Podcast updated", "Ok", { duration: 10000 });
      } else if (result.noChange) {
        let snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
    });
  }
}
