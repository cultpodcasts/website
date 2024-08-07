import { NgIf } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';

@Component({
  selector: 'app-outgoing-episodes-send',
  standalone: true,
  imports: [MatDialogModule, NgIf, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './outgoing-episodes-send.component.html',
  styleUrl: './outgoing-episodes-send.component.sass'
})
export class OutgoingEpisodesSendComponent {
  isSending: boolean = true;
  sendError: boolean = false;

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<OutgoingEpisodesSendComponent>,
    private auth: AuthServiceWrapper) {
  }

  close() {
    this.dialogRef.close({ error: this.sendError });
  }

  getOutgoingEpisodes() {
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
      this.http.get(episodeEndpoint, { headers: headers, observe: "response" })
        .subscribe(
          {
            next: resp => {
              this.dialogRef.close({ error: false, episodeIds: resp.body });
            },
            error: e => {
              this.isSending = false;
              this.sendError = true;
              console.log(e);
            }
          }
        );

    }).catch(x => {
      this.isSending = false;
      this.sendError = true;
      console.log(x);
    });
  }
}
