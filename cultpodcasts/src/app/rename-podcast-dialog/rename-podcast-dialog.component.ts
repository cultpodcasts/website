import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Component, Inject, ChangeDetectionStrategy, signal } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './rename-podcast-dialog.component.sass'
})
export class RenamePodcastDialogComponent {
  readonly isSending = signal(false);
  podcastName: string;
  newPodcastName: string = "";
  readonly conflict = signal(false);
  readonly isInError = signal(false);

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

  async onSubmit() {
    this.isSending.set(true);
    this.conflict.set(false);
    this.isInError.set(false);
    try {
      const token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'admin'
        }
      }));
      const headers = new HttpHeaders().set('Authorization', 'Bearer ' + token);
      const url = new URL(`/podcast/name/${encodeURIComponent(this.podcastName)}`, environment.api);
      const newPodcastName = this.newPodcastName.trim();
      const resp = await firstValueFrom<HttpResponse<PodcastRenameResponse>>(
        this.http.post<PodcastRenameResponse>(
          url.toString(),
          { newPodcastName },
          { headers, observe: 'response' }
        )
      );
      if (resp.status === 200) {
        this.isSending.set(false);
        this.dialogRef.close({
          updated: true,
          newPodcastName,
          searchIndexerState: resp.body?.indexState
        });
        return;
      }
      console.error(resp);
      this.isInError.set(true);
      this.isSending.set(false);
    } catch (e: unknown) {
      console.error(e);
      const err = e as { status?: number };
      this.conflict.set(err.status === 409);
      this.isSending.set(false);
      this.isInError.set(true);
    }
  }

  checkControl(control: NgModel) {
    if (control.control.value && control.control.value.indexOf("/") >= 0) {
      control.control.setErrors({ unsafe: true })
    }
  }
}
