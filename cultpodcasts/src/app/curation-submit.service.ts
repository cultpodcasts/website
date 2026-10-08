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