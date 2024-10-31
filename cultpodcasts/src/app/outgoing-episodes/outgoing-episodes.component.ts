import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { Episode } from '../episode';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule, MatMenuItem } from '@angular/material/menu';
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { SetNumberOfDaysComponent } from '../set-number-of-days/set-number-of-days.component';
import { DeleteEpisodeDialogComponent } from '../delete-episode-dialog/delete-episode-dialog.component';

const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";
const daysKey: string = "pref.outgoing-episodes.days";

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
    DatePipe,
    MatCheckboxModule,
    MatMenuItem,
    FormsModule
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

  days: number | undefined;
  posted: boolean | undefined;
  tweeted: boolean | undefined;
  token: string = "";
  authRoles: string[] = [];

  constructor(
    protected auth: AuthServiceWrapper,
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
    this.auth.roles.subscribe(roles => this.authRoles = roles);
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.siteService.setQuery(null);
      this.siteService.setPodcast(null);
      this.siteService.setSubject(null);

      const daysValue: string | null = localStorage.getItem(daysKey);
      if (daysValue && parseInt(daysValue)) {
        this.days = parseInt(daysValue);
      }

      this.isLoading = true;
      this.error = false;
      this.episodes = [];

      this.route.params.subscribe(params => {
        const token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
          authorizationParams: {
            audience: `https://api.cultpodcasts.com/`,
            scope: 'curate'
          }
        }));
        token.then(_token => {
          this.token = _token;
          this.getEpisodes();
        }).catch(x => {
          this.isLoading = false;
          this.error = true;
          console.log(x);
        });
      })
    }
  }

  reset() {
    this.posted = undefined;
    this.tweeted = undefined;
    this.days = undefined;
    this.ngOnInit()
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


  getEpisodes() {
    this.isLoading = true;
    let headers: HttpHeaders = new HttpHeaders();
    headers = headers.set("Authorization", "Bearer " + this.token);

    const url = new URL(`/episodes/outgoing`, environment.api);
    if (this.days)
      url.searchParams.append("days", this.days.toString());
    if (this.tweeted)
      url.searchParams.append("tweeted", this.tweeted.toString());
    if (this.posted)
      url.searchParams.append("posted", this.posted.toString());
    const episodeEndpoint = url.toString();
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
  }

  openSetDays() {
    var _days = this.days || 7;
    this.dialog
      .open(SetNumberOfDaysComponent, { disableClose: true, autoFocus: true, data: { days: _days } })
      .afterClosed()
      .subscribe(async result => {
        if (result?.days && parseInt(result.days)) {
          var days = parseInt(result.days);
          if (days != _days) {
            localStorage.setItem(daysKey, days.toString());
            this.days = days;
            this.getEpisodes();
          }
        }
      });
  }
}
