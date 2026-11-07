import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { IndexDialogComponent } from '../index-dialog/index-dialog.component';
import { Podcast } from '../podcast.interface';
import { EditPodcastDialogComponent } from './edit-podcast-dialog.component';

type Internals = {
  form(): { value: Partial<Podcast> } | undefined;
  originalPodcast: Podcast | undefined;
  podcastId: string | undefined;
  podcastName: string;
  conflict(): boolean;
  isInError(): boolean;
  isLoading(): boolean;
  indexBacklog(): void;
};

/** Polls for one request to `url`; match() removes what it returns, so keep the first hit. */
async function expectSoon(url: string) {
  const http = TestBed.inject(HttpTestingController);
  for (let i = 0; i < 20; i++) {
    const hits = http.match(url);
    if (hits.length === 1) {
      return hits[0];
    }
    await Promise.resolve();
  }
  return http.expectOne(url);
}

async function settle() {
  for (let i = 0; i < 15; i++) {
    await Promise.resolve();
  }
}

function syntheticPodcast(overrides: Partial<Podcast> & { id: string; name: string }): Podcast {
  return {
    removed: false,
    indexAllEpisodes: false,
    bypassShortEpisodeChecking: false,
    spotifyId: '',
    youTubePublicationDelay: '',
    skipEnrichingFromYouTube: false,
    twitterHandle: '',
    blueskyHandle: '',
    titleRegex: '',
    descriptionRegex: '',
    episodeMatchRegex: '',
    episodeIncludeTitleRegex: '',
    defaultSubject: null,
    ignoreAllEpisodes: false,
    youTubeChannelId: '',
    youTubePlaylistId: '',
    ...overrides
  };
}

describe('EditPodcastDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.fn>;
  const podcastName = 'Nightly Desk';
  const getUrl = new URL(`/podcast/${encodeURIComponent(podcastName)}`, environment.api).toString();
  const subjectsUrl = new URL('/subjects', environment.api).toString();
  const languagesUrl = new URL('/languages', environment.api).toString();

  beforeEach(async () => {
    close = vi.fn();
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(undefined) }));
    snackOpen = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EditPodcastDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { podcastName } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
        {
          provide: AuthServiceWrapper,
          useValue: { authService: { getAccessTokenSilently: () => of('test-token') } }
        }
      ]
    })
      .overrideProvider(MatDialog, {
        useValue: {
          open: (...args: unknown[]) => (dialogOpen as unknown as (...a: unknown[]) => unknown)(...args)
        }
      })
      .compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function create(): Internals {
    const fixture = TestBed.createComponent(EditPodcastDialogComponent);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Internals;
  }

  it('indexBacklog opens IndexDialog for the podcast name and snacks the result', () => {
    dialogOpen.mockReturnValue({
      afterClosed: () => of({ updated: true, episodeIds: ['p/e'] })
    });
    const fixture = TestBed.createComponent(EditPodcastDialogComponent);
    const sut = fixture.componentInstance;
    sut.podcastName = 'Clothesline Desk';

    sut.indexBacklog();

    expect(dialogOpen).toHaveBeenCalledWith(
      IndexDialogComponent,
      expect.objectContaining({
        data: { kind: 'podcast', name: 'Clothesline Desk' }
      })
    );
    expect(snackOpen).toHaveBeenCalledWith(
      'Podcast Indexed. 1 episode updated',
      'Ok',
      { duration: 10000 }
    );
  });

  it('on 409 loads each id, lets the curator pick, then binds the chosen podcast', async () => {
    const firstId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const secondId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    dialogOpen.mockReturnValue({
      afterClosed: () =>
        of({
          id: secondId,
          name: podcastName,
          youTubeChannelId: 'UC-second',
          twitterHandle: '@AP'
        })
    });
    const dialog = create();
    (await expectSoon(getUrl)).flush([firstId, secondId], { status: 409, statusText: 'Conflict' });
    const firstGet = await expectSoon(new URL(`/podcast/${firstId}`, environment.api).toString());
    firstGet.flush(
      syntheticPodcast({
        id: firstId,
        name: podcastName,
        spotifyId: 'spotify-first',
        youTubeChannelId: 'UC-first',
        twitterHandle: '@AP_Archive',
        blueskyHandle: 'archive.bsky.social'
      })
    );
    const secondGet = await expectSoon(new URL(`/podcast/${secondId}`, environment.api).toString());
    secondGet.flush(
      syntheticPodcast({
        id: secondId,
        name: podcastName,
        spotifyId: 'spotify-second',
        youTubeChannelId: 'UC-second',
        twitterHandle: '@AP',
        blueskyHandle: 'ap.bsky.social'
      })
    );
    (await expectSoon(subjectsUrl)).flush([{ name: 'Arts' }]);
    (await expectSoon(languagesUrl)).flush({ en: 'English' });
    await settle();

    expect(dialogOpen).toHaveBeenCalled();
    const pickerData = dialogOpen.mock.calls[0][1].data;
    expect(pickerData.title).toBe('Choose podcast');
    expect(pickerData.itemNounPlural).toBe('podcasts');
    expect(pickerData.candidates).toEqual([
      expect.objectContaining({
        id: firstId,
        name: podcastName,
        spotifyId: 'spotify-first',
        youTubeChannelId: 'UC-first',
        twitterHandle: '@AP_Archive',
        blueskyHandle: 'archive.bsky.social'
      }),
      expect.objectContaining({
        id: secondId,
        name: podcastName,
        spotifyId: 'spotify-second',
        youTubeChannelId: 'UC-second',
        twitterHandle: '@AP',
        blueskyHandle: 'ap.bsky.social'
      })
    ]);
    expect(dialog.podcastId).toBe(secondId);
    expect(dialog.originalPodcast?.youTubeChannelId).toBe('UC-second');
    expect(dialog.originalPodcast?.twitterHandle).toBe('@AP');
    expect(dialog.form()?.value.youTubeChannelId).toBe('UC-second');
    expect(dialog.form()?.value.twitterHandle).toBe('@AP');
    expect(dialog.isLoading()).toBe(false);
    expect(dialog.conflict()).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });
});
