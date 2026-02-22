import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from './../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { firstValueFrom } from 'rxjs';
import { AddPodcastPost } from '../add-podcast-post.interface';
import { PodcastPostResponse } from '../podcast-post-response.interface';

@Component({
  selector: 'app-add-podcast-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './add-podcast-send.component.html',
  styleUrl: './add-podcast-send.component.sass'
})
export class AddPodcastSendComponent {
  isSending: boolean = true;
  sendError: boolean = false;

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<AddPodcastSendComponent>,
    private auth: AuthServiceWrapper) {
  }

  public submit(podcastId: string, changes: AddPodcastPost) {
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const podcastEndpoint = new URL(`/podcast/${podcastId}`, environment.api).toString();
      this.http.put<PodcastPostResponse>(podcastEndpoint, changes, { headers: headers, observe: "response" })
        .subscribe(
          {
            next: resp => {
              this.dialogRef.close({ updated: true, response: resp.body });
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
