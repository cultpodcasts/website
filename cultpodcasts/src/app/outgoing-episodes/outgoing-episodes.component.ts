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
import { SiteService } from '../SiteService';

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
  templateUrl: './outgoing-episodes.component.html',
  styleUrl: './outgoing-episodes.component.sass'
})
export class OutgoingEpisodesComponent {
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
    private siteService: SiteService,
    @Inject(PLATFORM_ID) platformId: any,
    private title: Title
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    title.setTitle("Review");
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.siteService.setQuery(null);
      this.siteService.setPodcast(null);
      this.siteService.setSubject(null);

      this.isLoading = true;
      this.error = false;
      this.episodes = [];
      this.route.params.subscribe(params => {



        var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
          authorizationParams: {
            audience: `https://api.cultpodcasts.com/`,
            scope: 'curate'
          }
        }));
        token.then(_token => {
          let headers: HttpHeaders = new HttpHeaders();
          headers = headers.set("Authorization", "Bearer " + _token);


          const episodeEndpoint = new URL(`/episodes/outgoing`, environment.api).toString();
          this.http.get<Episode[]>(episodeEndpoint, { headers: headers, observe: "response" })
            .subscribe(
              {
                next: resp => {
                  this.isLoading = false;
                  this.error = false;
                  this.episodes = resp.body!;
                },
                error: e => {
                  this.isLoading = false;
                  this.error = true;
                  console.log(e);
                }
              }
            );

        }).catch(x => {
          this.isLoading = false;
          this.error = true;
          console.log(x);
        });
      }









      )
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
