import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { newFilmLinkControl } from '../playable-edit-form.util';
import { EditTvShowEpisodeDialogComponent } from './edit-tv-show-episode-dialog.component';

const episodeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const showId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const api = (path: string) => new URL(path, environment.api).toString();
const archiveUrl = 'https://archive.org/details/synthetic-playable';
const iplayerUrl = 'https://www.bbc.co.uk/iplayer/episode/p0synth1/synthetic-playable';
const youtubeUrl = 'https://www.youtube.com/watch?v=synthetic01';

const synthetic = {
  id: episodeId,
  title: 'Part',
  description: 'Synthetic episode',
  release: '2026-01-02',
  duration: '0:44:00',
  explicit: false,
  ignored: false,
  removed: false,
  posted: false,
  tweeted: false,
  blueskyPosted: true,
  subjects: [],
  searchTerms: 'night',
  hashTag: '#nightly',
  language: 'fr',
  guests: ['Ann Example'],
  tvShowId: showId,
  tvShowName: 'Nightly',
  imdbId: 'tt0000001',
  tvdbId: null,
  tmdbId: null,
  services: null as Record<string, { url?: string }> | null
};

describe('EditTvShowEpisodeDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<EditTvShowEpisodeDialogComponent>;

  beforeEach(async () => {
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EditTvShowEpisodeDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { episodeId } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
      ]
    })
      .overrideProvider(MatDialog, { useValue: { open: vi.fn() } })
      .compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function expectSoon(url: string, method = 'GET') {
    const http = TestBed.inject(HttpTestingController);
    for (let i = 0; i < 30; i++) {
      const hits = http.match((r) => r.urlWithParams === url && r.method === method);
      if (hits.length === 1) {
        return hits[0];
      }
      await Promise.resolve();
    }
    return http.expectOne((r) => r.urlWithParams === url && r.method === method);
  }

  async function load(dto: object = synthetic) {
    fixture = TestBed.createComponent(EditTvShowEpisodeDialogComponent);
    fixture.detectChanges();
    (await expectSoon(api(`/tvshowepisode/${episodeId}`))).flush(dto);
    (await expectSoon(api('/subjects'))).flush([{ name: 'Arts' }]);
    // No people published yet: the guest select still shows the stored name.
    (await expectSoon(api('/people'))).flush('', { status: 404, statusText: 'Not Found' });
    (await expectSoon(api('/languages'))).flush({ en: 'English', fr: 'French' });
    // Parent default subject is best-effort.
    (await expectSoon(api(`/tvshow/${showId}`))).flush('', { status: 500, statusText: 'Server Error' });
    for (let i = 0; i < 15; i++) {
      await Promise.resolve();
    }
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('has the Identity tab after the episode-editor tabs and loads IMDb / TheTVDB / TMDB ids', async () => {
    const dialog = await load();
    expect(dialog.isInError()).toBe(false);
    expect(dialog.parentName()).toBe('Nightly');
    expect(dialog.defaultSubject()).toBeNull();
    const tabs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['Details', 'Flags', 'Urls', 'Meta', 'Images', 'Guests', 'Identity']);
    expect(dialog.form()!.getRawValue()).toEqual(expect.objectContaining({
      imdbId: 'tt0000001',
      tvdbId: '',
      tmdbId: '',
      lang: 'fr',
      guests: ['Ann Example'],
      hashTag: '#nightly'
    }));
  });

  it('PATCHes playable fields, unBluesky and identity changes together', async () => {
    const dialog = await load();
    dialog.pendingUnBluesky.set(true);
    dialog.form()!.patchValue({
      description: 'Edited',
      lang: 'unset',
      imdbId: '',
      tvdbId: '4242',
      tmdbId: '77'
    });
    const saving = dialog.onSubmit();
    const patch = await expectSoon(api(`/tvshowepisode/${episodeId}`), 'PATCH');
    expect(patch.request.body).toEqual({
      description: 'Edited',
      unBluesky: true,
      language: '',
      imdbId: '',
      tvdbId: 4242,
      tmdbId: 77
    });
    patch.flush({ blueskyPostDeleted: true }, { status: 202, statusText: 'Accepted' });
    await saving;
    expect(close).toHaveBeenCalledWith({ updated: true, response: { blueskyPostDeleted: true }, parentName: 'Nightly' });
  });

  it('PATCHes Urls edits as film-shaped services on tvshowepisode/{id}', async () => {
    const dialog = await load({
      ...synthetic,
      services: { internetArchive: { url: archiveUrl }, bbcIplayer: { url: iplayerUrl } }
    });
    const links = dialog.form()!.controls.links!;
    expect(links.getRawValue()).toEqual([
      { url: archiveUrl, image: '' },
      { url: iplayerUrl, image: '' }
    ]);
    links.removeAt(1);
    links.push(newFilmLinkControl(youtubeUrl));
    const saving = dialog.onSubmit();
    const patch = await expectSoon(api(`/tvshowepisode/${episodeId}`), 'PATCH');
    expect(patch.request.body).toEqual({
      services: {
        youtube: { url: youtubeUrl },
        bbcIplayer: { url: '', image: '' }
      }
    });
    patch.flush({ blueskyPostDeleted: false }, { status: 202, statusText: 'Accepted' });
    await saving;
    expect(close).toHaveBeenCalledWith({ updated: true, response: { blueskyPostDeleted: false }, parentName: 'Nightly' });
  });

  it('PATCHes Images edits as services.*.image on tvshowepisode/{id} while preserving url', async () => {
    const imageUrl = 'https://cdn.example.test/archive.jpg';
    const dialog = await load({
      ...synthetic,
      services: { internetArchive: { url: archiveUrl } }
    });
    dialog.form()!.controls.links!.at(0).controls.image.setValue(imageUrl);
    const saving = dialog.onSubmit();
    const patch = await expectSoon(api(`/tvshowepisode/${episodeId}`), 'PATCH');
    expect(patch.request.body).toEqual({
      services: {
        internetArchive: { image: imageUrl }
      }
    });
    patch.flush({ blueskyPostDeleted: false }, { status: 202, statusText: 'Accepted' });
    await saving;
  });
});
