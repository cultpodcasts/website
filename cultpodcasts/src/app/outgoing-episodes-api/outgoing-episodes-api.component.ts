import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { Episode } from '../episode';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule, MatMenuItem } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, NgClass } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { PostEpisodeDialogComponent } from '../post-episode-dialog/post-episode-dialog.component';
import { SiteService } from '../SiteService';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { SetNumberOfDaysComponent } from '../set-number-of-days/set-number-of-days.component';
import { DeleteEpisodeDialogComponent } from '../delete-episode-dialog/delete-episode-dialog.component';
import { EpisodePublishResponse } from '../episode-publish-response';
import { PostEpisodeModel } from '../post-episode-model';
import { EpisodePublishResponseAdaptor } from '../episode-publish-response-adaptor';
import { EpisodeStatusComponent } from "../episode-status/episode-status.component";
import { EpisodePodcastLinksComponent } from "../episode-podcast-links/episode-podcast-links.component";
import { EditPodcastDialogComponent } from '../edit-podcast-dialog/edit-podcast-dialog.component';
import { EpisodeImageComponent } from "../episode-image/episode-image.component";
import { SubjectsComponent } from "../subjects/subjects.component";

const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";
const daysKey: string = "pref.outgoing-episodes.days";

@Component({
  selector: 'app-outgoing-episodes-api',
  imports: [
    MatProgressBarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    NgClass,
    MatCardModule,
    RouterLink,
    DatePipe,
    MatCheckboxModule,
    MatMenuItem,
    FormsModule,
    EpisodeStatusComponent,
    EpisodePodcastLinksComponent,
    EpisodeImageComponent,
    SubjectsComponent
],
  templateUrl: './outgoing-episodes-api.component.html',
  styleUrl: './outgoing-episodes-api.component.sass'
})
export class OutgoingEpisodesApiComponent {
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;

  episodes: Episode[] | undefined;
  error: boolean = false;
  isLoading: boolean = true;
  sortDirection: string = sortParamDateDesc;

  days: number | undefined;
  posted: boolean | undefined;
  tweeted: boolean | undefined;
  blueskyPosted: boolean | undefined = true;
  token: string = "";
  authRoles: string[] = [];

  constructor(
    protected auth: AuthServiceWrapper,
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
        console.error(x);
      });
    })
  }

  reset() {
    this.posted = undefined;
    this.tweeted = undefined;
    this.blueskyPosted = true;
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
    const dialogRef = this.dialog
      .open<PostEpisodeDialogComponent, any, {
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
    if (this.blueskyPosted)
      url.searchParams.append("blueskyPosted", this.blueskyPosted.toString())
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
            console.error(e);
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
