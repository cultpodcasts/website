import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable, catchError, of, throwError } from 'rxjs';
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
import { EpisodeFilmMoveRequest, EpisodeFilmMoveResponse } from './episode-film-move.interface';
import { EpisodeTrailerAttachRequest, EpisodeTrailerAttachResponse } from './episode-trailer-attach.interface';
import { EpisodeTvShowMoveRequest, EpisodeTvShowMoveResponse } from './episode-tv-show-move.interface';
import {
  FilmApiDto,
  FilmChangeRequest,
  NewsReportChangeRequest,
  NewsReportDto,
  PlayableChangeResponse,
  TvShowEpisodeChangeRequest,
  TvShowEpisodeDto
} from './playable-edit.interface';
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
import {
  CatalogueIdentityLookupRequest,
  CatalogueIdentityLookupResponse
} from './catalogue-identity-lookup.interface';

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

  /** Moves one podcast episode into a new Film with the same id. */
  postEpisodeToFilm(podcastId: string, episodeId: string, request: EpisodeFilmMoveRequest = {}) {
    const url = new URL(
      `/episode/${encodeURIComponent(podcastId)}/${encodeURIComponent(episodeId)}/film`,
      environment.api).toString();
    return this.http.post<EpisodeFilmMoveResponse>(url, request, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  /** Curator: attach one podcast episode to an existing film as a trailer (the episode row is then deleted). */
  postEpisodeAsTrailer(podcastId: string, episodeId: string, filmId: string, title: string | null) {
    const url = new URL(
      `/episode/${encodeURIComponent(podcastId)}/${encodeURIComponent(episodeId)}/trailer`,
      environment.api).toString();
    const body: EpisodeTrailerAttachRequest = title ? { filmId, title } : { filmId };
    return this.http.post<EpisodeTrailerAttachResponse>(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  /** Curator: move one podcast episode into an existing or new TV show with the same id (the episode row is then deleted). */
  postEpisodeToTvShow(podcastId: string, episodeId: string, request: EpisodeTvShowMoveRequest) {
    const url = new URL(
      `/episode/${encodeURIComponent(podcastId)}/${encodeURIComponent(episodeId)}/tvshow`,
      environment.api).toString();
    return this.http.post<EpisodeTvShowMoveResponse>(url, request, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  /** Curator GET of a news report by guid: playable fields plus the outlet id and name. */
  getNewsReport(reportId: string) {
    const url = new URL(`/newsreport/${encodeURIComponent(reportId)}`, environment.api).toString();
    return this.http.get<NewsReportDto>(url, { context: this.curateContext() });
  }

  /** PATCH only the changed playable fields: 202 with the episode-style update body. */
  patchNewsReport(reportId: string, body: NewsReportChangeRequest) {
    const url = new URL(`/newsreport/${encodeURIComponent(reportId)}`, environment.api).toString();
    return this.http.patch<PlayableChangeResponse | null>(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  /** Curator GET of a TV-show episode by guid: playable fields, show id/name, and IMDb / TheTVDB. */
  getTvShowEpisode(episodeId: string) {
    const url = new URL(`/tvshowepisode/${encodeURIComponent(episodeId)}`, environment.api).toString();
    return this.http.get<TvShowEpisodeDto>(url, {
      context: this.curateContext()
    });
  }

  patchTvShowEpisode(episodeId: string, body: TvShowEpisodeChangeRequest) {
    const url = new URL(`/tvshowepisode/${encodeURIComponent(episodeId)}`, environment.api).toString();
    return this.http.patch<PlayableChangeResponse | null>(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  /** Curator GET of a film by guid: publisher fields (name, publisher, …), playable fields and IMDb. */
  getFilm(filmId: string) {
    const url = new URL(`/film/${encodeURIComponent(filmId)}`, environment.api).toString();
    return this.http.get<FilmApiDto>(url, { context: this.curateContext() });
  }

  /** PATCH only the changed film fields (never `title`; renames are admin-only): 202 with the episode-style body. */
  patchFilm(filmId: string, body: FilmChangeRequest) {
    const url = new URL(`/film/${encodeURIComponent(filmId)}`, environment.api).toString();
    return this.http.patch<PlayableChangeResponse | null>(url, body, {
      context: this.curateContext(),
      observe: 'response'
    });
  }

  /** Published people list for the guest selects. A 404 (nothing published yet) is an empty list. */
  getPeople() {
    const url = new URL('/people', environment.api).toString();
    return this.http.get<Person[]>(url, { context: this.curateContext() }).pipe(
      catchError((err) => (err?.status === 404 ? of([] as Person[]) : throwError(() => err)))
    );
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

  /** Edit-time Identity tab probe (does not write Cosmos). */
  lookupCatalogueIdentity(body: CatalogueIdentityLookupRequest) {
    const url = new URL(`/catalogue/identity/lookup`, environment.api).toString();
    return this.http.post<CatalogueIdentityLookupResponse>(url, body, {
      context: this.curateContext()
    });
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