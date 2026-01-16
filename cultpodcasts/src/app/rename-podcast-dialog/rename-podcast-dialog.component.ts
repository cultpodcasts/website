import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Component, Inject } from '@angular/core';
import { FormsModule, NgModel } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { environment } from './../../environments/environment';
import { PodcastRenameResponse } from "../podcast-rename-response.interface";
import { RenamePodcastDialogResponse } from "../rename-podcast-dialog-response.interface";

@Component({
  selector: 'app-rename-podcast-dialog',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    FormsModule,
  ],
  templateUrl: './rename-podcast-dialog.component.html',
  styleUrl: './rename-podcast-dialog.component.sass'
})
export class RenamePodcastDialogComponent {
  isSending: boolean = false;
  podcastName: string;
  newPodcastName: string = "";
  conflict: boolean = false;
  isInError: boolean = false;

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<RenamePodcastDialogComponent, RenamePodcastDialogResponse>,
    @Inject(MAT_DIALOG_DATA) public data: { podcastName: string }
  ) {
    this.podcastName = data.podcastName;
  }

  close() {
    this.dialogRef.close({ closed: true });
  }

  onSubmit() {
    let headers: HttpHeaders = new HttpHeaders();
    var tokenCtr = 0;
    this.isSending = true;
    try {
      const token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'admin'
        }
      }));
      token.then(_token => {
        if (tokenCtr++ > 1) return;
        headers = headers.set("Authorization", "Bearer " + _token);
        const url: URL = new URL(`/podcast/name/${this.podcastName}`, environment.api);
        const newPodcastName = this.newPodcastName.trim();
        const resp = firstValueFrom<HttpResponse<PodcastRenameResponse>>(
          this.http.post<PodcastRenameResponse>(
            url.toString(),
            { newPodcastName: newPodcastName },
            { headers: headers, observe: 'response' }));
        resp.then(_resp => {
          if (_resp.status == 200) {
            this.isSending = false;
            this.conflict = false;
            this.dialogRef.close({
              updated: true,
              newPodcastName: newPodcastName,
              searchIndexerState: _resp.body?.indexState
            });
          } else {
            console.error(_resp);
            this.isInError = true;
            this.isSending = false;
            this.conflict = false;
          }
        }).catch(_respError => {
          console.error(_respError);
          if (_respError.status == 409) {
            this.conflict = true;
          } else {
            this.conflict = false;
          }
          this.isSending = false;
          this.isInError = true;
        })
      }).catch(_error => {
        console.error(_error);
      });
    } catch (e) {
      console.error(e);
    }
  }

  checkControl(control: NgModel) {
    if (control.control.value && control.control.value.indexOf("/") >= 0) {
      control.control.setErrors({ unsafe: true })
    }
  }
}