import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from './../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { PodcastPost } from '../PodcastPost';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-edit-podcast-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './edit-podcast-send.component.html',
  styleUrl: './edit-podcast-send.component.sass'
})
export class EditPodcastSendComponent {
  isSending: boolean = true;
  sendError: boolean = false;

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditPodcastSendComponent>,
    private auth: AuthServiceWrapper) {
  }

  public submit(podcastId: string, changes: PodcastPost) {
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const episodeEndpoint = new URL(`/podcast/${podcastId}`, environment.api).toString();
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
