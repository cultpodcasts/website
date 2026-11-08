import { Component, Inject, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CataloguePlayableKind } from '../catalogue-playable-kind.enum';
import { playablePublishSubjectNoun } from '../content-kind-label';
import { environment } from './../../environments/environment';

export interface DeletePlayableDialogData {
  episodeId: string;
  podcastId?: string;
  contentKind?: string | null;
}

function deleteEndpoint(data: DeletePlayableDialogData): string | null {
  const id = data.episodeId;
  switch (data.contentKind) {
    case CataloguePlayableKind.Film:
      return new URL(`/film/${id}`, environment.api).toString();
    case CataloguePlayableKind.NewsReport:
      return new URL(`/newsreport/${id}`, environment.api).toString();
    case CataloguePlayableKind.TvShowEpisode:
      return new URL(`/tvshowepisode/${id}`, environment.api).toString();
    default:
      if (!data.podcastId) {
        return null;
      }
      return new URL(`/episode/${data.podcastId}/${id}`, environment.api).toString();
  }
}

@Component({
  selector: 'app-delete-episode-dialog',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
  ],
  templateUrl: './delete-episode-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './delete-episode-dialog.component.sass'
})
export class DeleteEpisodeDialogComponent {
  readonly isInError = signal(false);
  readonly isSending = signal(false);
  readonly error = signal<any | undefined>(undefined);
  readonly noun = computed(() => playablePublishSubjectNoun(this.data.contentKind).toLowerCase());
  readonly title = computed(() => `Delete ${playablePublishSubjectNoun(this.data.contentKind)}`);

  constructor(private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<DeleteEpisodeDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: DeletePlayableDialogData) {
  }

  close() {
    this.dialogRef.close({ closed: true });
  }

  onSubmit() {
    const endpoint = deleteEndpoint(this.data);
    if (!endpoint) {
      this.isInError.set(true);
      this.error.set({ message: 'Missing ids for delete' });
      return;
    }
    this.isSending.set(true);
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'admin'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      this.http.delete<any>(endpoint, { headers: headers })
        .subscribe(
          {
            next: resp => {
              this.isSending.set(false);
              this.dialogRef.close({ response: resp, deleted: true })
            },
            error: e => {
              console.error(e);
              this.isSending.set(false);
              this.isInError.set(true);
              if (e.status == 403) {
                this.error.set({ message: "You do not have permission" });
              } else {
                this.error.set(e.error);
              }
            }
          }
        )
    }).catch(x => {
      console.error(x);
      this.isSending.set(false);
      this.isInError.set(true);
    });
  }

}
