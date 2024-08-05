import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, forkJoin, Observable } from 'rxjs';
import { environment } from './../../environments/environment';
import { Episode } from '../episode';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';

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


  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) { }
  ngOnInit() {
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
    const dialogRef = this.dialog.open(EditEpisodeDialogComponent, { data: { episodeId: id } });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        let snackBarRef = this.snackBar.open("Episode updated", "Ok", { duration: 10000 });
      } else if (result.noChange) {
        let snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
    });
  }
}
