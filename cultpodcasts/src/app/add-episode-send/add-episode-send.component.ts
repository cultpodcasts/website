import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { EpisodePost } from '../EpisodePost';

@Component({
  selector: 'app-add-episode-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './add-episode-send.component.html',
  styleUrl: './add-episode-send.component.sass'
})
export class AddEpisodeSendComponent {
  isSending: boolean = true;
  sendError: boolean = false;

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<AddEpisodeSendComponent>,
    private auth: AuthServiceWrapper) {
  }

  public submit(episodeId: string, changes: EpisodePost) {
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const episodeEndpoint = new URL(`/episode/${episodeId}`, environment.api).toString();
      this.http.post(episodeEndpoint, changes, { headers: headers, observe: "response" })
        .subscribe(
          {
            next: resp => {
              this.dialogRef.close({ updated: true });
            },
            error: e => {
              this.isSending = false;
              this.sendError = true;
              console.error(e);
            }
          }
        )
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
