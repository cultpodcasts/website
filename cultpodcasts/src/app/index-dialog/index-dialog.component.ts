import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { IndexPodcastResponse, PodcastIndexDialogResult } from '../index-podcast-response.interface';
import { CatalogueHub, hubApiRoot, hubParentLabel } from '../catalogue-hub';
import { CatalogueIndexDialogResult, CatalogueIndexResponse } from '../catalogue-index-response.interface';

/** What the index dialog should index: a podcast, or a news outlet / TV show. */
export type IndexDialogData =
  | { kind: 'podcast'; name: string; /** When true, POST `?backlog=true` for a full-catalogue walk (Edit/Add). */ backlog?: boolean }
  | { kind: 'catalogueParent'; hub: CatalogueHub; name: string };

export type IndexDialogResult = PodcastIndexDialogResult | CatalogueIndexDialogResult;

/**
 * The curator "Index" progress dialog. Opens with `MAT_DIALOG_DATA` naming the podcast or catalogue parent
 * to index. POSTs `{}` with a `curate` token and closes with the outcome; an unexpected error stays open
 * with a Close button.
 */
@Component({
  selector: 'app-index-dialog',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './index-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './index-dialog.component.sass'
})
export class IndexDialogComponent {
  private readonly http = inject(HttpClient);
  private readonly dialogRef = inject<MatDialogRef<IndexDialogComponent, IndexDialogResult>>(MatDialogRef);
  private readonly auth = inject(AuthServiceWrapper);
  private readonly data = inject<IndexDialogData>(MAT_DIALOG_DATA);

  readonly isSending = signal(true);
  readonly sendError = signal(false);
  /** Dialog noun: "Podcast", "News Outlet" or "TV Show". */
  readonly subject = signal(
    this.data.kind === 'catalogueParent' ? hubParentLabel(this.data.hub) : 'Podcast'
  );

  constructor() {
    if (this.data.kind === 'podcast') {
      void this.indexPodcast(this.data.name);
    } else {
      void this.indexCatalogueParent(this.data.hub, this.data.name);
    }
  }

  private indexPodcast(podcastName: string) {
    const backlog = this.data.kind === 'podcast' && this.data.backlog === true;
    const path =
      `/podcast/index/${encodeURIComponent(podcastName)}` + (backlog ? '?backlog=true' : '');
    return this.post<IndexPodcastResponse, PodcastIndexDialogResult>(
      path,
      body => ({ updated: true, episodeIds: body?.indexedEpisodes?.map(x => `${x.podcastId}/${x.episodeId}`) }),
      e =>
        e.status === 400 ? { podcastNotAutoIndex: true }
          : e.status === 404 ? { podcastNotFound: true }
            : e.status === 409 ? { alreadyRunning: true }
              : e.status === 504 ? { timedOut: true }
                : undefined);
  }

  private indexCatalogueParent(hub: CatalogueHub, name: string) {
    return this.post<CatalogueIndexResponse, CatalogueIndexDialogResult>(
      `/${hubApiRoot(hub)}/index/${encodeURIComponent(name)}`,
      (body): CatalogueIndexDialogResult => ({
        updated: true,
        itemIds: body?.indexedItemIds ?? [],
        searchIndexerState: body?.searchIndexerState,
        ...(body?.enrichOnly === true ? { enrichOnly: true } : {})
      }),
      (e): CatalogueIndexDialogResult | undefined =>
        e.status === 400
          ? {
            notIndexable: true,
            reason: e.error?.reason,
            ...(typeof e.error?.message === 'string' ? { message: e.error.message } : {})
          }
          : e.status === 404 ? { notFound: true }
            : e.status === 409 ? { ambiguous: true }
              : e.status === 503 ? catalogueUnavailable(e)
                : e.status === 504 ? { timedOut: true }
                  : undefined);
  }

  private async post<TBody, TResult extends IndexDialogResult>(
    path: string,
    onOk: (body: TBody | null) => TResult,
    onError: (e: HttpErrorResponse) => TResult | undefined
  ): Promise<void> {
    try {
      const token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'curate'
        }
      }));
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + token);
      const indexEndpoint = new URL(path, environment.api).toString();
      const resp = await firstValueFrom(
        this.http.post<TBody>(indexEndpoint, {}, { headers: headers, observe: "response" })
      );
      this.dialogRef.close(onOk(resp.body));
    } catch (e) {
      const result = e instanceof HttpErrorResponse ? onError(e) : undefined;
      if (result) {
        this.dialogRef.close(result);
      } else {
        this.isSending.set(false);
        this.sendError.set(true);
        console.error(e);
      }
    }
  }

  close() {
    this.dialogRef.close({ updated: false });
  }
}

/**
 * A 503 from the outlet / show index: `EnrichFailed` (with the Api's message) when the body says so; anything else
 * (no reason, or a non-JSON body such as Azure's own 503 page) is a generic "unavailable, try again later".
 */
export function catalogueUnavailable(e: HttpErrorResponse): CatalogueIndexDialogResult {
  const body: unknown = e.error;
  if (body && typeof body === 'object' && (body as { reason?: unknown }).reason === 'EnrichFailed') {
    const message = (body as { message?: unknown }).message;
    return { enrichFailed: true, ...(typeof message === 'string' ? { message } : {}) };
  }
  return { unavailable: true };
}