import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../environments/environment';
import { ApiEpisode } from './api-episode.interface';
import { EpisodeUpdateService, isCardOfPodcast, toPlayableChanges } from './episode-update.service';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const podcastId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const api = (path: string) => new URL(path, environment.api).toString();

function row(contentKind?: string): ApiEpisode {
  return {
    id, title: 'Synthetic', description: '', posted: false, tweeted: false, ignored: false, removed: false,
    explicit: false, release: new Date('2026-01-02T00:00:00Z'), duration: '0:06:30', podcastId, contentKind
  } as ApiEpisode;
}

describe('EpisodeUpdateService review-page routing', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function patchFor(contentKind: string | undefined, expectedPath: string, expectedBody: unknown) {
    const service = TestBed.inject(EpisodeUpdateService);
    const http = TestBed.inject(HttpTestingController);
    const done = service.toggleRemoved(row(contentKind), true);
    await Promise.resolve();
    const patch = http.expectOne((r) => r.method === 'PATCH');
    expect(patch.request.url).toBe(api(expectedPath));
    expect(patch.request.body).toEqual(expectedBody);
    patch.flush(null, { status: 202, statusText: 'Accepted' });
    let refresh = http.match(api(`/episode/${id}`));
    for (let i = 0; i < 10 && refresh.length === 0; i++) {
      await Promise.resolve();
      refresh = http.match(api(`/episode/${id}`));
    }
    expect(refresh).toHaveLength(1);
    refresh[0].flush(row(contentKind));
    expect((await done).id).toBe(id);
  }

  it('PATCHes news reports, TV episodes and films on their own routes', async () => {
    await patchFor('NewsReport', `/newsreport/${id}`, { removed: true, ignored: false });
    await patchFor('TvShowEpisode', `/tvshowepisode/${id}`, { removed: true, ignored: false });
    await patchFor('Film', `/film/${id}`, { removed: true, ignored: false });
  });

  it('keeps PATCH /episode/{podcastId}/{id} for podcast episodes and rows without a contentKind', async () => {
    await patchFor(undefined, `/episode/${podcastId}/${id}`, { removed: true, ignored: false });
    await patchFor('Episode', `/episode/${podcastId}/${id}`, { removed: true, ignored: false });
  });

  it('maps episode lang to playable language and drops service links', () => {
    expect(toPlayableChanges({ lang: 'fr', subjects: ['A'], urls: {}, images: {}, unBluesky: true }))
      .toEqual({ language: 'fr', subjects: ['A'], unBluesky: true });
  });
});

describe('EpisodeUpdateService podcast-save card refresh', () => {
  const pod = '66666666-6666-4666-8666-666666666666';
  const card = (cid: string, extra: Partial<ApiEpisode> = {}): ApiEpisode => ({
    id: cid, title: 'Synthetic', description: '', posted: false, tweeted: false, ignored: false, removed: false,
    explicit: false, release: new Date('2026-01-02T00:00:00Z'), duration: '0:09:18', subjects: [],
    podcastId: pod, podcastName: 'Synthetic Pod', ...extra
  } as ApiEpisode);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()]
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('isCardOfPodcast matches by id, falls back to name, and never matches news / TV / film rows', () => {
    expect(isCardOfPodcast(card('a'), { podcastId: pod })).toBe(true);
    expect(isCardOfPodcast(card('a', { podcastId: 'other' }), { podcastId: pod, podcastName: 'Synthetic Pod' })).toBe(false);
    expect(isCardOfPodcast(card('a', { podcastId: undefined }), { podcastName: 'Synthetic Pod' })).toBe(true);
    expect(isCardOfPodcast(card('a'), { podcastName: 'Other' })).toBe(false);
    expect(isCardOfPodcast(card('a'), {})).toBe(false);
    expect(isCardOfPodcast(card('a', { contentKind: 'NewsReport' }), { podcastId: pod })).toBe(false);
    expect(isCardOfPodcast(card('a', { contentKind: 'Episode' }), { podcastId: pod })).toBe(true);
  });

  it('fetchPodcastEpisodes GETs each matching card once and returns the re-read bodies', async () => {
    const service = TestBed.inject(EpisodeUpdateService);
    const http = TestBed.inject(HttpTestingController);
    const cards = [card('a'), card('b', { podcastId: 'other' }), card('a'), card('c', { contentKind: 'Film' })];
    const done = service.fetchPodcastEpisodes(cards, { podcastId: pod });
    await Promise.resolve();
    const reqs = http.match(() => true);
    expect(reqs.map(r => r.request.url)).toEqual([api('/episode/a')]);
    expect(reqs[0].request.method).toBe('GET');
    reqs[0].flush({ ...card('a'), lang: 'hi', release: '2026-01-02T00:00:00Z' });
    const updated = await done;
    expect(updated.map(x => x.lang)).toEqual(['hi']);
    expect(updated[0].release).toBeInstanceOf(Date);
  });

  it('replaceEpisodes swaps re-read bodies in place and ignores ids no longer listed', () => {
    const service = TestBed.inject(EpisodeUpdateService);
    const current = [card('a'), card('b')];
    const next = service.replaceEpisodes(current, [card('b', { lang: 'hi' }), card('gone', { lang: 'fr' })]);
    expect(next?.map(x => [x.id, x.lang])).toEqual([['a', undefined], ['b', 'hi']]);
  });
});
