import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { IndexPodcastResponse } from '../index-podcast-response.interface';
import { CatalogueHub, hubApiRoot, hubParentLabel } from '../catalogue-hub';
import { CatalogueIndexDialogResult, CatalogueIndexResponse } from '../catalogue-index-response.interface';

/**
 * The curator "Index" progress dialog. `index(podcastName)` indexes a podcast; `indexCatalogueParent(hub, name)`
 * indexes a news outlet or TV show by name. Both POST `{}` with a `curate` token and close with the outcome; an
 * unexpected error stays open with a Close button.
 */
@Component({
  selector: 'app-podcast-index',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './podcast-index.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './podcast-index.component.sass'
})
export class PodcastIndexComponent {
  readonly isSending = signal(true);
  readonly sendError = signal(false);
  /** Dialog noun: "Podcast", "News Outlet" or "TV Show". */
  readonly subject = signal('Podcast');

  constructor(
    private http: HttpClient,
    private dialogRef: MatDialogRef<PodcastIndexComponent>,
    private auth: AuthServiceWrapper
  ) { }

  index(podcastName: string) {
    this.post<IndexPodcastResponse>(
      `/podcast/index/${encodeURIComponent(podcastName)}`,
      body => ({ updated: true, episodeIds: body?.indexedEpisodes?.map(x => `${x.podcastId}/${x.episodeId}`) }),
      e => e.status == 400 ? { podcastNotAutoIndex: true } : e.status == 404 ? { podcastNotFound: true } : undefined);
  }

  indexCatalogueParent(hub: CatalogueHub, name: string) {
    this.subject.set(hubParentLabel(hub));
    this.post<CatalogueIndexResponse>(
      `/${hubApiRoot(hub)}/index/${encodeURIComponent(name)}`,
      (body): CatalogueIndexDialogResult => ({
        updated: true,
        itemIds: body?.indexedItemIds ?? [],
        searchIndexerState: body?.searchIndexerState
      }),
      (e): CatalogueIndexDialogResult | undefined =>
        e.status == 400 ? { notIndexable: true, reason: e.error?.reason }
          : e.status == 404 ? { notFound: true }
            : e.status == 409 ? { ambiguous: true }
              : undefined);
  }

  private post<T>(
    path: string,
    onOk: (body: T | null) => object,
    onError: (e: HttpErrorResponse) => object | undefined
  ) {
    const token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const indexEndpoint = new URL(path, environment.api).toString();
      this.http.post<T>(indexEndpoint, {}, { headers: headers, observe: "response" })
        .subscribe({
          next: resp => {
            this.dialogRef.close(onOk(resp.body));
          },
          error: e => {
            const result = e instanceof HttpErrorResponse ? onError(e) : undefined;
            if (result) {
              this.dialogRef.close(result);
            } else {
              this.isSending.set(false);
              this.sendError.set(true);
              console.error(e);
            }
          }
        })
    }).catch(x => {
      this.isSending.set(false);
      this.sendError.set(true);
      console.error(x);
    });
  }

  close() {
    this.dialogRef.close({ updated: false });
  }
}
