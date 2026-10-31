import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { environment } from '../environments/environment';
import { AUTH_SCOPE, authInterceptor } from './auth.interceptor';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { HeroCurationService, toWireUpdate } from './hero-curation.service';
import { JsonDateInterceptor } from './json-date.interceptor';
import { of } from 'rxjs';

describe('HeroCurationService', () => {
  let service: HeroCurationService;
  let httpMock: HttpTestingController;
  const url = new URL('/hero-curation', environment.api).toString();

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
              getAccessTokenSilently: () => of('test-token'),
            },
          },
        },
        HeroCurationService,
      ],
    });
    service = TestBed.inject(HeroCurationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function flushCommand(req: TestRequest): Promise<void> {
    req.flush('', { status: 202, statusText: 'Accepted' });
    await Promise.resolve();
  }

  function flushGet(body: object): void {
    const read = httpMock.expectOne(url);
    expect(read.request.method).toBe('GET');
    expect(read.request.headers.get('Cache-Control')).toBe('no-cache');
    read.flush(body);
  }

  it('normalizes missing arrays on GET success', async () => {
    const pending = service.getHeroCuration();
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('GET');
    req.flush({});

    await expect(pending).resolves.toEqual({
      episodeIds: [],
      railSubjects: [],
      updatedAt: null,
    });
  });

  it('returns empty lists when GET fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pending = service.getHeroCuration();
    httpMock.expectOne(url).error(new ProgressEvent('error'));

    await expect(pending).resolves.toEqual({
      episodeIds: [],
      railSubjects: [],
      updatedAt: null,
    });
    warn.mockRestore();
  });

  it('PUTs with curate scope and loads the document with GET', async () => {
    const pending = service.setHomepageCuration({
      episodeIds: ['a'],
      railSubjects: ['Cult'],
    });
    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ episodeIds: ['a'], railSubjects: ['Cult'] });
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    expect(req.request.responseType).toBe('text');
    await flushCommand(req);
    flushGet({ episodeIds: ['a'], railSubjects: ['Cult'], updatedAt: '2026-01-01' });

    await expect(pending).resolves.toEqual({
      episodeIds: ['a'],
      railSubjects: ['Cult'],
      updatedAt: '2026-01-01',
    });
  });

  it('setHeroCuration / setRailSubjects send partial bodies with expectedUpdatedAt', async () => {
    const hero = service.setHeroCuration(['e1'], new Date('2026-10-31T10:00:00.123Z'));
    const heroReq = httpMock.expectOne(url);
    expect(heroReq.request.body).toEqual({ episodeIds: ['e1'], expectedUpdatedAt: '2026-10-31T10:00:00.123Z' });
    await flushCommand(heroReq);
    flushGet({ episodeIds: ['e1'], railSubjects: [], updatedAt: 't1' });
    await hero;

    const rails = service.setRailSubjects(['Scientology'], new Date('2026-10-31T11:00:00Z'));
    const railsReq = httpMock.expectOne(url);
    expect(railsReq.request.body).toEqual({
      railSubjects: ['Scientology'],
      expectedUpdatedAt: '2026-10-31T11:00:00.000Z',
    });
    await flushCommand(railsReq);
    flushGet({ episodeIds: [], railSubjects: ['Scientology'], updatedAt: 't2' });
    await rails;
  });

  it('throws HeroCurationConflictError from GET after an empty 409', async () => {
    const pending = service.setHeroCuration(['e1'], new Date(0));
    httpMock.expectOne(url).flush('', { status: 409, statusText: 'Conflict' });
    await Promise.resolve();
    flushGet({
      episodeIds: ['from-get'],
      railSubjects: ['day:0'],
      updatedAt: 'from-get',
    });
    await expect(pending).rejects.toMatchObject({
      name: 'HeroCurationConflictError',
      current: {
        episodeIds: ['from-get'],
        railSubjects: ['day:0'],
        updatedAt: 'from-get',
      },
    });
  });

  it('treats 400 Conflict bodies as CAS conflicts and reloads with GET', async () => {
    const pending = service.setHeroCuration(['e1'], new Date(0));
    httpMock.expectOne(url).flush(
      JSON.stringify({
        error: 'Conflict',
        episodeIds: ['from-body'],
        updatedAt: 'from-body',
      }),
      { status: 400, statusText: 'Bad Request' }
    );
    await Promise.resolve();
    flushGet({
      episodeIds: ['from-get'],
      railSubjects: [],
      updatedAt: 'from-get',
    });
    await expect(pending).rejects.toMatchObject({
      name: 'HeroCurationConflictError',
      current: { episodeIds: ['from-get'], updatedAt: 'from-get' },
    });
  });

  it('appends episodes via POST without CAS', async () => {
    const appendUrl = new URL('/hero-curation/episodes', environment.api).toString();
    const pending = service.appendEpisodes(['e2']);
    const req = httpMock.expectOne(appendUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ episodeIds: ['e2'] });
    expect(req.request.context.get(AUTH_SCOPE)).toBe('curate');
    await flushCommand(req);
    flushGet({
      episodeIds: ['e2', 'e1'],
      railSubjects: ['day:0'],
      updatedAt: 't1',
    });
    await expect(pending).resolves.toEqual({
      episodeIds: ['e2', 'e1'],
      railSubjects: ['day:0'],
      updatedAt: 't1',
    });
  });

  it('toggleEpisode promotes via append and demotes via DELETE', async () => {
    const episodesUrl = new URL('/hero-curation/episodes', environment.api).toString();

    const promote = service.toggleEpisode('e2', ['e1'], new Date('2026-10-31T10:00:00Z'));
    const appendReq = httpMock.expectOne(episodesUrl);
    expect(appendReq.request.method).toBe('POST');
    expect(appendReq.request.body).toEqual({ episodeIds: ['e2'] });
    await flushCommand(appendReq);
    flushGet({
      episodeIds: ['e2', 'e1'],
      railSubjects: [],
      updatedAt: 't1',
    });
    await expect(promote).resolves.toEqual({
      episodeIds: ['e2', 'e1'],
      railSubjects: [],
      updatedAt: 't1',
    });

    const demote = service.toggleEpisode('e2', ['e2', 'e1'], new Date('2026-10-31T11:00:00Z'));
    const deleteReq = httpMock.expectOne(episodesUrl);
    expect(deleteReq.request.method).toBe('DELETE');
    expect(deleteReq.request.body).toEqual({ episodeIds: ['e2'] });
    await flushCommand(deleteReq);
    flushGet({
      episodeIds: ['e1'],
      railSubjects: [],
      updatedAt: 't2',
    });
    await expect(demote).resolves.toEqual({
      episodeIds: ['e1'],
      railSubjects: [],
      updatedAt: 't2',
    });
  });

  it('removeEpisodes sends DELETE without expectedUpdatedAt', async () => {
    const episodesUrl = new URL('/hero-curation/episodes', environment.api).toString();
    const pending = service.removeEpisodes(['e1', 'e2']);
    const req = httpMock.expectOne(episodesUrl);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ episodeIds: ['e1', 'e2'] });
    await flushCommand(req);
    flushGet({
      episodeIds: ['e0'],
      railSubjects: ['day:0'],
      updatedAt: 't3',
    });
    await expect(pending).resolves.toEqual({
      episodeIds: ['e0'],
      railSubjects: ['day:0'],
      updatedAt: 't3',
    });
  });

  it('rejects a 200 command body instead of binding it', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pending = service.setHeroCuration(['e1']);
    httpMock.expectOne(url).flush(
      JSON.stringify({ episodeIds: ['from-body'], railSubjects: [], updatedAt: 'from-body' }),
      { status: 200, statusText: 'OK' }
    );
    await expect(pending).rejects.toBeTruthy();
    httpMock.expectNone(url);
    err.mockRestore();
  });

  it('rethrows when PUT fails', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pending = service.setHeroCuration(['e1']);
    httpMock.expectOne(url).flush('nope', { status: 500, statusText: 'Server Error' });
    await expect(pending).rejects.toBeTruthy();
    err.mockRestore();
  });

  describe('expectedUpdatedAt on the wire (#579)', () => {
    it('sends a Date back as the exact UTC Z text the GET returned', () => {
      const body = new JsonDateInterceptor().convert({ updatedAt: '2026-10-31T10:00:00.123Z' }) as { updatedAt: Date };
      expect(body.updatedAt).toBeInstanceOf(Date);
      expect(toWireUpdate({ episodeIds: ['e1'], expectedUpdatedAt: body.updatedAt })).toEqual({
        episodeIds: ['e1'],
        expectedUpdatedAt: '2026-10-31T10:00:00.123Z',
      });
    });

    it('keeps null (write without CAS) and leaves an omitted token out', () => {
      expect(toWireUpdate({ railSubjects: [], expectedUpdatedAt: null })).toEqual({ railSubjects: [], expectedUpdatedAt: null });
      expect(toWireUpdate({ railSubjects: [] })).toEqual({ railSubjects: [] });
      expect('expectedUpdatedAt' in toWireUpdate({ railSubjects: [] })).toBe(false);
    });

    it('PUT body carries the token as text, not a Date', async () => {
      const pending = service.setHomepageCuration({ railSubjects: ['Cult'], expectedUpdatedAt: new Date('2026-07-15T20:00:00Z') });
      const req = httpMock.expectOne(url);
      expect(typeof req.request.body.expectedUpdatedAt).toBe('string');
      expect(req.request.body.expectedUpdatedAt).toBe('2026-07-15T20:00:00.000Z');
      await flushCommand(req);
      flushGet({ episodeIds: [], railSubjects: ['Cult'], updatedAt: '2026-07-15T20:00:01.000Z' });
      await pending;
    });
  });
});
