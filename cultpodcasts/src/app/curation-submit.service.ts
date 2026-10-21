import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { AUTH_SCOPE } from './auth.interceptor';
import { EpisodePost } from './episode-post.interface';
import { EpisodeChangeResponse } from './episode-change-response.interface';
import { AddPodcastPost } from './add-podcast-post.interface';
import { PodcastPostResponse } from './podcast-post-response.interface';
import { PodcastKindTransferRequest } from './podcast-kind-transfer-request.interface';
import { PodcastKindTransferResponse } from './podcast-kind-transfer-response.interface';
import { CatalogueParentKind } from './catalogue-parent-kind.enum';
import { TvShowEpisodeCanonicalChangeRequest, TvShowEpisodeCanonicalDto } from './tv-show-episode-canonical.interface';
import { Person } from './person.interface';
import { SubjectEntity } from './subject-entity.interface';
import { SubjectResponse } from './subject-response.interface';
import { CatalogueHub, hubApiRoot } from './catalogue-hub';
import {
  CatalogueParentChangeRequest,
  CatalogueParentDto,
  CatalogueParentRenameRequest,
  CatalogueParentRenameResponse
} from './catalogue-parent.interface';

/**
 * Shared authenticated catalogue writes used by spinner/send dialogs.
 * Bearer token comes from authInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class CurationSubmitService {
  constructor(private http: HttpClient) {}

  private curateContext(): HttpContext {
    return new HttpContext().set(AUTH_SCOPE, 'curate');
  }

  patchEpisode(podcastId: string, episodeId: string, changes: EpisodePost) {
    const url = new URL(`/episode/${podcastId}/${episodeId}`, environment.api).toString();
    return this.http.patch<EpisodeChangeResponse>(url, changes, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  patchPodcast(podcastId: string, body: AddPodcastPost | unknown) {
    const url = new URL(`/podcast/${encodeURIComponent(podcastId)}`, environment.api).toString();
    return this.http.patch<PodcastPostResponse>(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  postPodcastKind(podcastId: string, targetKind: CatalogueParentKind) {
    const url = new URL(`/podcast/${encodeURIComponent(podcastId)}/kind`, environment.api).toString();
    const body: PodcastKindTransferRequest = { targetKind: targetKind };
    return this.http.post<PodcastKindTransferResponse>(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  getTvShowEpisode(episodeId: string) {
    const url = new URL(`/tvshowepisode/${encodeURIComponent(episodeId)}`, environment.api).toString();
    return this.http.get<TvShowEpisodeCanonicalDto>(url, {
      context: this.curateContext()
    });
  }

  patchTvShowEpisode(episodeId: string, body: TvShowEpisodeCanonicalChangeRequest) {
    const url = new URL(`/tvshowepisode/${encodeURIComponent(episodeId)}`, environment.api).toString();
    return this.http.patch(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  /** Subject names for the subject selects (same endpoint as the podcast edit dialog). */
  getSubjects() {
    const url = new URL('/subjects', environment.api).toString();
    return this.http.get<{ name: string }[]>(url, { context: this.curateContext() });
  }

  /** Language code → name map for the language select (same endpoint as the podcast edit dialog). */
  getLanguages() {
    const url = new URL('/languages', environment.api).toString();
    return this.http.get<Record<string, string>>(url, { context: this.curateContext() });
  }

  /** GET a news outlet / TV show by guid or route-form name (curate). */
  getCatalogueParent(hub: CatalogueHub, identifier: string) {
    const url = new URL(`/${hubApiRoot(hub)}/${encodeURIComponent(identifier)}`, environment.api).toString();
    return this.http.get<CatalogueParentDto>(url, { context: this.curateContext() });
  }

  /** PATCH a news outlet / TV show by guid (curate): 202, empty body. */
  patchCatalogueParent(hub: CatalogueHub, id: string, body: CatalogueParentChangeRequest) {
    const url = new URL(`/${hubApiRoot(hub)}/${encodeURIComponent(id)}`, environment.api).toString();
    return this.http.patch(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  /** Admin rename (separate from the edit PATCH). The KV redirect `news/{old}` / `tv/{old}` is written by Azure. */
  renameCatalogueParent(hub: CatalogueHub, identifier: string, newName: string) {
    const url = new URL(`/${hubApiRoot(hub)}/name/${encodeURIComponent(identifier)}`, environment.api).toString();
    const body: CatalogueParentRenameRequest = { newName };
    return this.http.post<CatalogueParentRenameResponse>(url, body, {
      context: new HttpContext().set(AUTH_SCOPE, 'admin'),
      observe: 'response'
    });
  }

  getPerson(name: string) {
    const url = new URL(`/person/${encodeURIComponent(name)}`, environment.api).toString();
    return this.http.get<Person>(url, {
      context: this.curateContext()
    });
  }

  createPerson(body: unknown): Observable<HttpResponse<null>> {
    const url = new URL(`/person`, environment.api).toString();
    return this.http.post<null>(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  patchPerson(personId: string, body: unknown) {
    const url = new URL(`/person/${personId}`, environment.api).toString();
    return this.http.patch(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  getSubject(name: string) {
    const url = new URL(`/subject/${encodeURIComponent(name)}`, environment.api).toString();
    return this.http.get<SubjectResponse>(url, {
      context: this.curateContext()
    });
  }

  createSubject(body: SubjectEntity): Observable<HttpResponse<null>> {
    const url = new URL(`/subject`, environment.api).toString();
    return this.http.post<null>(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  patchSubject(subjectId: string, body: unknown) {
    const url = new URL(`/subject/${subjectId}`, environment.api).toString();
    return this.http.patch(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }
}