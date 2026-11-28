import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { of } from 'rxjs';
import { environment } from '../environments/environment';
import { AUTH_SCOPE, authInterceptor } from './auth.interceptor';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { CatalogueParentKind } from './catalogue-parent-kind.enum';
import { CurationSubmitService } from './curation-submit.service';

describe('CurationSubmitService', () => {
  let service: CurationSubmitService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthServiceWrapper,
          useValue: {
            authService: {
              getAccessTokenSilently: () => of('test-token')
            }
          }
        },
        CurationSubmitService
      ]
    });
    service = TestBed.inject(CurationSubmitService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('POSTs /catalogue/identity/lookup with curate scope', async () => {
    const pending = firstValueFrom(service.lookupCatalogueIdentity({
      kind: 'Film',
      title: 'Synthetic Film',
      year: 2021
    }));
    const expected = new URL('/catalogue/identity/lookup', environment.api).toString();
    const req = httpMock.expectOne(expected);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ kind: 'Film', title: 'Synthetic Film', year: 2021 });
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    req.flush({ status: 'Matched', ids: { imdbId: 'tt0000001', tmdbId: 12 } });
    const body = await pending;
    expect(body.status).toBe('Matched');
    expect(body.ids?.imdbId).toBe('tt0000001');
  });

  it('POSTs /film with the request body and curate scope, and returns the 202 acknowledgement only', async () => {
    const filmId = '11111111-2222-4333-8444-555555555555';
    const pending = firstValueFrom(service.postFilm({ tmdbId: 278, title: 'Synthetic Film' }));
    const req = httpMock.expectOne(new URL('/film', environment.api).toString());
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tmdbId: 278, title: 'Synthetic Film' });
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush({ filmId, name: 'Synthetic Film' }, { status: 202, statusText: 'Accepted' });
    const resp = await pending;
    expect(resp.status).toBe(202);
    expect(resp.body).toEqual({ filmId, name: 'Synthetic Film' });
  });

  it('POSTs /episode/{podcastId}/{episodeId}/tvshow-trailer with the show id and curate scope (RPP #1412)', async () => {
    const pending = firstValueFrom(service.postEpisodeAsTvShowTrailer('podcast 1', 'episode-1', { tvShowId: 'show-1', title: 'Synthetic Teaser' }));
    const req = httpMock.expectOne(new URL('/episode/podcast%201/episode-1/tvshow-trailer', environment.api).toString());
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tvShowId: 'show-1', title: 'Synthetic Teaser' });
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    req.flush({ tvShowId: 'show-1', tvShowName: 'Synthetic Show' }, { status: 202, statusText: 'Accepted' });
    const resp = await pending;
    expect(resp.status).toBe(202);
    expect(resp.body?.tvShowName).toBe('Synthetic Show');
  });

  it('POSTs the tvshow-trailer createShow form with the name and publisher, sent as given', async () => {
    const pending = firstValueFrom(service.postEpisodeAsTvShowTrailer('podcast-1', 'episode-1', { createShow: true, tvShowName: 'New Show', publisher: 'Synthetic Network' }));
    const req = httpMock.expectOne(new URL('/episode/podcast-1/episode-1/tvshow-trailer', environment.api).toString());
    expect(req.request.body).toEqual({ createShow: true, tvShowName: 'New Show', publisher: 'Synthetic Network' });
    req.flush({ tvShowId: 'show-2', tvShowName: 'New Show', showCreated: true }, { status: 202, statusText: 'Accepted' });
    expect((await pending).body?.showCreated).toBe(true);
  });

  it('GETs /tvshow/{identifier} with curate scope and returns the show with its trailers', async () => {
    const pending = firstValueFrom(service.getCatalogueParent('tv', 'Synthetic / Show'));
    const req = httpMock.expectOne(new URL('/tvshow/' + encodeURIComponent('Synthetic / Show'), environment.api).toString());
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    req.flush({ id: 'show-1', name: 'Synthetic / Show', trailers: [{ id: 't1', title: 'Synthetic Teaser', url: 'https://www.youtube.com/watch?v=synthetic01', duration: '0:02:11' }] });
    const show = await pending;
    expect(show.trailers?.map(trailer => trailer.id)).toEqual(['t1']);
  });

  it('POSTs /podcast/{id}/kind body { targetKind } with curate interceptor', async () => {
    const podcastId = 'Show A';
    const pending = firstValueFrom(service.postPodcastKind(podcastId, CatalogueParentKind.TvShow));
    const expected = new URL('/podcast/' + encodeURIComponent(podcastId) + '/kind', environment.api).toString();
    const req = httpMock.expectOne(expected);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ targetKind: CatalogueParentKind.TvShow });
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    req.flush({ parentId: 'parent-1', targetKind: CatalogueParentKind.TvShow }, { status: 202, statusText: 'Accepted' });
    const resp = await pending;
    expect(resp.status).toBe(202);
    expect(resp.body?.parentId).toBe('parent-1');
  });

  it('GETs /podcast/{id} with curate interceptor', async () => {
    const podcastId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const pending = firstValueFrom(service.getPodcast(podcastId));
    const expected = new URL('/podcast/' + encodeURIComponent(podcastId), environment.api).toString();
    const req = httpMock.expectOne(expected);
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    req.flush({ id: podcastId, name: 'Synthetic Show' });
    expect((await pending).name).toBe('Synthetic Show');
  });

  it('POSTs /episode/{podcastId}/{episodeId}/film with the title, or {} without one', async () => {
    const pending = firstValueFrom(service.postEpisodeToFilm('podcast-1', 'episode-1', { title: 'Synthetic Film' }));
    const expected = new URL('/episode/podcast-1/episode-1/film', environment.api).toString();
    const req = httpMock.expectOne(expected);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'Synthetic Film' });
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    req.flush({ filmId: 'episode-1', name: 'Synthetic Film' }, { status: 202, statusText: 'Accepted' });
    expect((await pending).body?.name).toBe('Synthetic Film');

    const untitled = firstValueFrom(service.postEpisodeToFilm('podcast-1', 'episode-1', {}));
    const untitledReq = httpMock.expectOne(expected);
    expect(untitledReq.request.body).toEqual({});
    untitledReq.flush({ filmId: 'episode-1' }, { status: 202, statusText: 'Accepted' });
    await untitled;
  });

  it('POSTs /episode/{podcastId}/{episodeId}/trailer with the film id and an optional title', async () => {
    const pending = firstValueFrom(service.postEpisodeAsTrailer('podcast-1', 'episode-1', 'film-1', 'Synthetic Teaser'));
    const expected = new URL('/episode/podcast-1/episode-1/trailer', environment.api).toString();
    const req = httpMock.expectOne(expected);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ filmId: 'film-1', title: 'Synthetic Teaser' });
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    req.flush({ filmId: 'film-1', name: 'Synthetic Film' }, { status: 202, statusText: 'Accepted' });
    expect((await pending).body?.name).toBe('Synthetic Film');

    const untitled = firstValueFrom(service.postEpisodeAsTrailer('podcast-1', 'episode-1', 'film-1', null));
    const untitledReq = httpMock.expectOne(expected);
    expect(untitledReq.request.body).toEqual({ filmId: 'film-1' });
    untitledReq.flush({ filmId: 'film-1' }, { status: 202, statusText: 'Accepted' });
    await untitled;
  });

  it('POSTs /episode/{podcastId}/{episodeId}/tvshow with the target as a curate command', async () => {
    const body = { tvShowName: 'Synthetic Show', createShow: true, publisher: 'Synthetic Publisher', title: 'Synthetic Episode' };
    const pending = firstValueFrom(service.postEpisodeToTvShow('podcast-1', 'episode-1', body));
    const req = httpMock.expectOne(new URL('/episode/podcast-1/episode-1/tvshow', environment.api).toString());
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    req.flush({ tvShowId: 'show-1', tvShowName: 'Synthetic Show', episodeId: 'episode-1', createdShow: true },
      { status: 202, statusText: 'Accepted' });
    expect((await pending).body?.tvShowName).toBe('Synthetic Show');
  });

  it('GETs /subject/{name} and /person/{name} as one encoded path segment', async () => {
    const name = 'Alpha Beta/Gamma';
    const subjectPending = firstValueFrom(service.getSubject(name));
    const subjectUrl = new URL(`/subject/${encodeURIComponent(name)}`, environment.api).toString();
    const subjectReq = httpMock.expectOne(subjectUrl);
    expect(subjectReq.request.method).toBe('GET');
    expect(subjectReq.request.context.get(AUTH_SCOPE)).toBe('curate');
    subjectReq.flush({ id: 'subject-1', name });
    await subjectPending;

    const personPending = firstValueFrom(service.getPerson(name));
    const personUrl = new URL(`/person/${encodeURIComponent(name)}`, environment.api).toString();
    const personReq = httpMock.expectOne(personUrl);
    expect(personReq.request.method).toBe('GET');
    expect(personReq.request.context.get(AUTH_SCOPE)).toBe('curate');
    personReq.flush({ id: 'person-1', name });
    await personPending;
  });

  it('POSTs /subject and /person as commands with an empty 202 body', async () => {
    const subjectPending = firstValueFrom(service.createSubject({ name: 'Alpha Beta' }));
    const subjectReq = httpMock.expectOne(new URL('/subject', environment.api).toString());
    expect(subjectReq.request.method).toBe('POST');
    expect(subjectReq.request.context.get(AUTH_SCOPE)).toBe('curate');
    subjectReq.flush(null, { status: 202, statusText: 'Accepted' });
    const subjectResp = await subjectPending;
    expect(subjectResp.status).toBe(202);
    expect(subjectResp.body).toBeNull();

    const personPending = firstValueFrom(service.createPerson({ name: 'Alpha Beta' }));
    const personReq = httpMock.expectOne(new URL('/person', environment.api).toString());
    expect(personReq.request.method).toBe('POST');
    personReq.flush(null, { status: 202, statusText: 'Accepted' });
    const personResp = await personPending;
    expect(personResp.status).toBe(202);
    expect(personResp.body).toBeNull();
  });

  it('GETs and PATCHes /tvshowepisode/{id} with AUTH_SCOPE curate', async () => {
    const episodeId = '11111111-1111-1111-1111-111111111111';
    const getPending = firstValueFrom(service.getTvShowEpisode(episodeId));
    const getUrl = new URL('/tvshowepisode/' + episodeId, environment.api).toString();
    const getReq = httpMock.expectOne(getUrl);
    expect(getReq.request.method).toBe('GET');
    expect(getReq.request.context.get(AUTH_SCOPE)).toBe('curate');
    getReq.flush({ id: episodeId, tvShowId: episodeId, title: 'Item', imdbId: null, tvdbId: null });
    const dto = await getPending;
    expect(dto.id).toBe(episodeId);

    const body = { imdbId: 'tt0000001' };
    const postPending = firstValueFrom(service.patchTvShowEpisode(episodeId, body));
    const postReq = httpMock.expectOne(getUrl);
    expect(postReq.request.method).toBe('PATCH');
    expect(postReq.request.body).toEqual(body);
    expect(postReq.request.context.get(AUTH_SCOPE)).toBe('curate');
    postReq.flush(null, { status: 202, statusText: 'Accepted' });
    const resp = await postPending;
    expect(resp.status).toBe(202);
  });

  it('PATCHes /episode/{podcastId}/{episodeId} and /podcast/{id}', async () => {
    const podcastId = '11111111-1111-1111-1111-111111111111';
    const episodeId = '22222222-2222-2222-2222-222222222222';
    const episodeChanges = { guests: ['Guest Name'] };
    const episodePending = firstValueFrom(service.patchEpisode(podcastId, episodeId, episodeChanges));
    const episodeUrl = new URL(`/episode/${podcastId}/${episodeId}`, environment.api).toString();
    const episodeReq = httpMock.expectOne(episodeUrl);
    expect(episodeReq.request.method).toBe('PATCH');
    expect(episodeReq.request.body).toEqual(episodeChanges);
    expect(episodeReq.request.context.get(AUTH_SCOPE)).toBe('curate');
    episodeReq.flush(null, { status: 202, statusText: 'Accepted' });
    expect((await episodePending).status).toBe(202);

    const podcastChanges = { name: 'Renamed Show' };
    const podcastPending = firstValueFrom(service.patchPodcast(podcastId, podcastChanges));
    const podcastUrl = new URL(`/podcast/${encodeURIComponent(podcastId)}`, environment.api).toString();
    const podcastReq = httpMock.expectOne(podcastUrl);
    expect(podcastReq.request.method).toBe('PATCH');
    expect(podcastReq.request.body).toEqual(podcastChanges);
    expect(podcastReq.request.context.get(AUTH_SCOPE)).toBe('curate');
    podcastReq.flush(null, { status: 202, statusText: 'Accepted' });
    expect((await podcastPending).status).toBe(202);
  });
});
