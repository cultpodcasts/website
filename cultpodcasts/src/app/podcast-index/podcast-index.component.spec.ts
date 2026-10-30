import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { PodcastIndexComponent } from './podcast-index.component';

describe('PodcastIndexComponent', () => {
  let close: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    close = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await TestBed.configureTestingModule({
      imports: [PodcastIndexComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  }

  function expectPost(path: string) {
    const req = TestBed.inject(HttpTestingController).expectOne(new URL(path, environment.api).toString());
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    return req;
  }

  it('indexes a podcast by name and closes with the episode ids, as before', async () => {
    const sut = TestBed.createComponent(PodcastIndexComponent).componentInstance;
    sut.index('Show & Co');
    await settle();
    expectPost('/podcast/index/Show%20%26%20Co').flush({
      indexedEpisodes: [{ podcastId: 'p', episodeId: 'e', spotify: true, apple: false, youtube: false, subjects: [] }],
      indexStatus: 'Performed'
    });
    expect(sut.subject()).toBe('Podcast');
    expect(close).toHaveBeenCalledWith({ updated: true, episodeIds: ['p/e'] });
  });

  it('maps a podcast 400 and 404 as before', async () => {
    const sut = TestBed.createComponent(PodcastIndexComponent).componentInstance;
    sut.index('Show');
    await settle();
    expectPost('/podcast/index/Show').flush(null, { status: 400, statusText: 'Bad Request' });
    sut.index('Show');
    await settle();
    expectPost('/podcast/index/Show').flush(null, { status: 404, statusText: 'Not Found' });
    expect(close.mock.calls.map((c) => c[0])).toEqual([{ podcastNotAutoIndex: true }, { podcastNotFound: true }]);
  });

  it('indexes a news outlet by name on the newsorganisation route and closes with the item ids', async () => {
    const sut = TestBed.createComponent(PodcastIndexComponent).componentInstance;
    sut.indexCatalogueParent('news', 'Desk 24/7');
    await settle();
    expectPost('/newsorganisation/index/Desk%2024%2F7').flush({ indexedItemIds: ['a'], searchIndexerState: 'Executed' });
    expect(sut.subject()).toBe('News Outlet');
    expect(close).toHaveBeenCalledWith({ updated: true, itemIds: ['a'], searchIndexerState: 'Executed' });
  });

  it('maps a TV show 400 (with reason), 404, 409 and 504 (timed out), and stays open with an error otherwise', async () => {
    const sut = TestBed.createComponent(PodcastIndexComponent).componentInstance;
    for (const [status, body] of [[400, { reason: 'SourcePodcastStillExists' }], [404, null], [409, ['x', 'y']], [504, { reason: 'TimedOut', message: 'Indexing ran out of time.' }]] as const) {
      sut.indexCatalogueParent('tv', 'Nightly');
      await settle();
      expectPost('/tvshow/index/Nightly').flush(body, { status, statusText: 'Error' });
    }
    expect(close.mock.calls.map((c) => c[0])).toEqual([
      { notIndexable: true, reason: 'SourcePodcastStillExists' },
      { notFound: true },
      { ambiguous: true },
      { timedOut: true }
    ]);
    sut.indexCatalogueParent('tv', 'Nightly');
    await settle();
    expectPost('/tvshow/index/Nightly').flush({ error: 'Unable to index TV show' }, { status: 500, statusText: 'Error' });
    expect(close).toHaveBeenCalledTimes(4);
    expect(sut.sendError()).toBe(true);
    expect(sut.isSending()).toBe(false);
    expect(sut.subject()).toBe('TV Show');
  });
});
