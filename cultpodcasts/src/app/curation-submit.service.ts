import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { AUTH_SCOPE } from './auth.interceptor';
import { EpisodePost } from './episode-post.interface';
import { EpisodeChangeResponse } from './episode-change-response.interface';
import { AddPodcastPost } from './add-podcast-post.interface';
import { PodcastPostResponse } from './podcast-post-response.interface';

/**
 * Shared authenticated API posts used by spinner/send dialogs.
 * Bearer token comes from authInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class CurationSubmitService {
  constructor(private http: HttpClient) {}

  private curateContext(): HttpContext {
    return new HttpContext().set(AUTH_SCOPE, 'curate');
  }

  postEpisode(podcastId: string, episodeId: string, changes: EpisodePost) {
    const url = new URL(`/episode/${podcastId}/${episodeId}`, environment.api).toString();
    return this.http.post<EpisodeChangeResponse>(url, changes, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  putPodcast(podcastId: string, body: AddPodcastPost | unknown) {
    const url = new URL(`/podcast/${podcastId}`, environment.api).toString();
    return this.http.put<PodcastPostResponse>(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  postPodcast(podcastId: string, body: unknown) {
    const url = new URL(`/podcast/${podcastId}`, environment.api).toString();
    return this.http.post<PodcastPostResponse>(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  putPerson(body: unknown) {
    const url = new URL(`/person`, environment.api).toString();
    return this.http.put(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  postPerson(personId: string, body: unknown) {
    const url = new URL(`/person/${personId}`, environment.api).toString();
    return this.http.post(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  putSubject(body: unknown) {
    const url = new URL(`/subject`, environment.api).toString();
    return this.http.put(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  postSubject(subjectId: string, body: unknown) {
    const url = new URL(`/subject/${subjectId}`, environment.api).toString();
    return this.http.post(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }
}