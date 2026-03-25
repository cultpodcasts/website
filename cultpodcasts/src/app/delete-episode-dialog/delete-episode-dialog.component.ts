import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';

@Component({
  selector: 'app-delete-episode-dialog',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
  ],
  templateUrl: './delete-episode-dialog.component.html',
  styleUrl: './delete-episode-dialog.component.sass'
})
export class DeleteEpisodeDialogComponent {
  isInError: boolean = false;
  isSending: boolean = false;
  podcastId: string;
  episodeId: string;
  error: any | undefined;

  constructor(private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<DeleteEpisodeDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: { podcastId: string, episodeId: string }) {
    this.podcastId = data.podcastId;
    this.episodeId = data.episodeId;
  }

  close() {
    this.dialogRef.close({ closed: true });
  }

  onSubmit() {
    this.isSending = true;
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'admin'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const episodeEndpoint = new URL(`/episode/${this.podcastId}/${this.episodeId}`, environment.api).toString();
      this.http.delete<any>(episodeEndpoint, { headers: headers })
        .subscribe(
          {
            next: resp => {
              this.isSending = false;
              this.dialogRef.close({ response: resp, deleted: true })
            },
            error: e => {
              console.error(e);
              this.isSending = false;
              this.isInError = true;
              if (e.status == 403) {
                this.error = { message: "You do not have permission" };
              } else {
                this.error = e.error;
              }
            }
          }
        )
    }).catch(x => {
      console.error(x);
      this.isSending = false;
      this.isInError = true;
    });
  }

}
