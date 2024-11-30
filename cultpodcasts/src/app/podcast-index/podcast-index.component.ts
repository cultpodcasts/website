import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { IndexPodcastResponse } from '../index-podcast-response';

@Component({
  selector: 'app-podcast-index',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './podcast-index.component.html',
  styleUrl: './podcast-index.component.sass'
})
export class PodcastIndexComponent {
  isSending: boolean = true;
  sendError: boolean = false;

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<PodcastIndexComponent>,
    private auth: AuthServiceWrapper
  ) { }

  index(podcastName: string) {
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const indexEndpoint = new URL(`/podcast/index/${encodeURIComponent(podcastName)}`, environment.api).toString();
      this.http.post<IndexPodcastResponse>(indexEndpoint, {}, { headers: headers, observe: "response" })
        .subscribe({
          next: resp => {
            console.log(resp.body);
            this.dialogRef.close({ updated: true, episodeIds: resp.body?.indexedEpisodes?.map(x => x.episodeId) });
          },
          error: e => {
            if (e.status == 400) {
              this.dialogRef.close({ podcastNotAutoIndex: true });
            } else if (e.status == 404) {
              this.dialogRef.close({ podcastNotFound: true });
            } else {
              this.isSending = false;
              this.sendError = true;
              console.error(e);
            }
          }
        })
    }).catch(x => {
      this.isSending = false;
      this.sendError = true;
      console.error(x);
    });
  }

  close() {
    this.dialogRef.close({ updated: false });
  }
}
