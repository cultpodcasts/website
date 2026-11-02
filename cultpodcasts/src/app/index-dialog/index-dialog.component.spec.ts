import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { IndexDialogComponent, IndexDialogData } from './index-dialog.component';

describe('IndexDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;

  async function configure(data: IndexDialogData) {
    close = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [IndexDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
      ]
    }).compileComponents();
  }

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
    await configure({ kind: 'podcast', name: 'Show & Co' });
    const sut = TestBed.createComponent(IndexDialogComponent).componentInstance;
    await settle();
    expectPost('/podcast/index/Show%20%26%20Co').flush({
      indexedEpisodes: [{ podcastId: 'p', episodeId: 'e', spotify: true, apple: false, youtube: false, subjects: [] }],
      indexStatus: 'Performed'
    });
    await settle();
    expect(sut.subject()).toBe('Podcast');
    expect(close).toHaveBeenCalledWith({ updated: true, episodeIds: ['p/e'] });
  });

  it('maps a podcast 400 and 404 as before', async () => {
    await configure({ kind: 'podcast', name: 'Show' });
    TestBed.createComponent(IndexDialogComponent);
    await settle();
    expectPost('/podcast/index/Show').flush(null, { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(close).toHaveBeenCalledWith({ podcastNotAutoIndex: true });

    await configure({ kind: 'podcast', name: 'Show' });
    TestBed.createComponent(IndexDialogComponent);
    await settle();
    expectPost('/podcast/index/Show').flush(null, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(close).toHaveBeenCalledWith({ podcastNotFound: true });
  });

  it('indexes a news outlet by name on the newsorganisation route and closes with the item ids', async () => {
    await configure({ kind: 'catalogueParent', hub: 'news', name: 'Desk 24/7' });
    const sut = TestBed.createComponent(IndexDialogComponent).componentInstance;
    await settle();
    expectPost('/newsorganisation/index/Desk%2024%2F7').flush({ indexedItemIds: ['a'], searchIndexerState: 'Executed' });
    await settle();
    expect(sut.subject()).toBe('News Outlet');
    expect(close).toHaveBeenCalledWith({ updated: true, itemIds: ['a'], searchIndexerState: 'Executed' });
  });

  it('maps a TV show 400 (with reason), 404, 409 and 504 (timed out), and stays open with an error otherwise', async () => {
    for (const [status, body, expected] of [
      [400, { reason: 'SourcePodcastStillExists' }, { notIndexable: true, reason: 'SourcePodcastStillExists' }],
      [404, null, { notFound: true }],
      [409, ['x', 'y'], { ambiguous: true }],
      [504, { reason: 'TimedOut', message: 'Indexing ran out of time.' }, { timedOut: true }]
    ] as const) {
      await configure({ kind: 'catalogueParent', hub: 'tv', name: 'Nightly' });
      TestBed.createComponent(IndexDialogComponent);
      await settle();
      expectPost('/tvshow/index/Nightly').flush(body, { status, statusText: 'Error' });
      await settle();
      expect(close).toHaveBeenCalledWith(expected);
    }

    await configure({ kind: 'catalogueParent', hub: 'tv', name: 'Nightly' });
    const sut = TestBed.createComponent(IndexDialogComponent).componentInstance;
    await settle();
    expectPost('/tvshow/index/Nightly').flush({ error: 'Unable to index TV show' }, { status: 500, statusText: 'Error' });
    await settle();
    expect(sut.sendError()).toBe(true);
    expect(sut.isSending()).toBe(false);
    expect(sut.subject()).toBe('TV Show');
  });
});
