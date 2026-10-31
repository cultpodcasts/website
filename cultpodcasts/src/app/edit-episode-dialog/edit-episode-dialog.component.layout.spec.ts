import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { MoveEpisodeToFilmDialogComponent } from '../move-episode-to-film-dialog/move-episode-to-film-dialog.component';
import { AttachTrailerDialogComponent } from '../attach-trailer-dialog/attach-trailer-dialog.component';
import { MoveEpisodeToTvShowDialogComponent } from '../move-episode-to-tv-show-dialog/move-episode-to-tv-show-dialog.component';
import { EditEpisodeDialogComponent } from './edit-episode-dialog.component';

const podcastId = '4d3c2b1a-0f9e-4d8c-8b7a-6f5e4d3c2b1a';
const episodeId = '8f7e6d5c-4b3a-4291-8e7d-6c5b4a392817';
const api = (path: string) => new URL(path, environment.api).toString();

/** Synthetic `episode/{podcast}/{id}` GET. */
const episode = {
  id: episodeId,
  title: 'Synthetic Episode Title',
  description: 'Synthetic description',
  posted: false,
  tweeted: false,
  ignored: false,
  removed: false,
  explicit: false,
  // The app's JsonDateInterceptor turns this into a Date; there is no interceptor here.
  release: new Date('2026-01-02T03:04:05Z'),
  duration: '00:30:00',
  subjects: [],
  guests: []
};

/**
 * Where the buttons live: Close sits next to Submit in the dialog actions, and the curator moves
 * (Move to film, Attach as trailer, Move to TV show) live on a Catalogue tab, like the podcast editor's.
 */
describe('EditEpisodeDialogComponent layout', () => {
  const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  let fixture: ComponentFixture<EditEpisodeDialogComponent>;
  let open: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (q: string) => ({
        matches: false, media: q,
        addListener: () => { }, removeListener: () => { }, addEventListener: () => { }, removeEventListener: () => { }
      })
    });
    open = vi.fn(() => ({ afterClosed: () => new Subject<unknown>().asObservable() }));
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EditEpisodeDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        // Tab bodies switch on animation end, which jsdom never fires.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: { podcastIdentifier: podcastId, episodeId } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
      ]
    })
      .overrideProvider(MatDialog, { useValue: { open } })
      .compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    } else {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  async function expectSoon(url: string) {
    const http = TestBed.inject(HttpTestingController);
    for (let i = 0; i < 30; i++) {
      const hits = http.match((r) => r.urlWithParams === url && r.method === 'GET');
      if (hits.length === 1) {
        return hits[0];
      }
      await Promise.resolve();
    }
    return http.expectOne((r) => r.urlWithParams === url && r.method === 'GET');
  }

  async function settle() {
    for (let i = 0; i < 15; i++) {
      await Promise.resolve();
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function loadAndFlush() {
    fixture = TestBed.createComponent(EditEpisodeDialogComponent);
    fixture.detectChanges(); // runs ngOnInit
    (await expectSoon(api(`/episode/${podcastId}/${episodeId}`))).flush(episode);
    (await expectSoon(api('/subjects'))).flush([{ name: 'Arts' }]);
    (await expectSoon(api('/people'))).flush([]);
    (await expectSoon(api('/languages'))).flush({ en: 'English' });
    (await expectSoon(api(`/podcast/${podcastId}`))).flush({ id: podcastId, name: 'Synthetic Podcast' });
    await settle();
    expect(el().querySelector('#error')).toBeNull();
    expect(el().querySelector('form#edit')).not.toBeNull();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const texts = (selector: string) =>
    Array.from(el().querySelectorAll(selector)).map((e) => (e.textContent ?? '').trim());

  /** Clicks the Catalogue tab header and waits for its lazy body to render. */
  async function openCatalogueTab() {
    fixture.detectChanges();
    const tab = Array.from(el().querySelectorAll<HTMLElement>('[role="tab"]'))
      .find((t) => (t.textContent ?? '').trim() === 'Catalogue');
    expect(tab).toBeTruthy();
    tab!.click();
    for (let i = 0; i < 5; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    fixture.detectChanges();
  }

  it('puts Close next to Submit and nothing else in the dialog actions', async () => {
    await loadAndFlush();
    expect(texts('mat-dialog-actions button')).toEqual(['Close', 'Submit']);
  });

  it('adds a Catalogue tab after Guests holding Move to film, Attach as trailer and Move to TV show', async () => {
    await loadAndFlush();
    expect(texts('[role="tab"]')).toEqual(['Details', 'Flags', 'Urls', 'Meta', 'Images', 'Guests', 'Catalogue']);
    await openCatalogueTab();
    expect(texts('.catalogue-actions button')).toEqual(['Move to film', 'Attach as trailer', 'Move to TV show']);
  });

  it('describes each move by its hint, which says it takes the episode out of the podcast', async () => {
    await loadAndFlush();
    await openCatalogueTab();
    const buttons = Array.from(el().querySelectorAll<HTMLButtonElement>('.catalogue-actions button'));
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      const id = button.getAttribute('aria-describedby');
      expect(id).toBeTruthy();
      const hint = el().querySelector(`#${id}`);
      expect(hint?.classList.contains('catalogue-hint')).toBe(true);
      expect(hint?.textContent?.trim()).toMatch(/^Takes this episode out of the podcast and /);
    }
    expect(texts('.catalogue-confirm-note')).toEqual(['Each one asks you to confirm first.']);
  });

  it.each([
    ['.move-to-film', MoveEpisodeToFilmDialogComponent],
    ['.attach-trailer', AttachTrailerDialogComponent],
    ['.move-to-tv-show', MoveEpisodeToTvShowDialogComponent]
  ] as const)('%s on the Catalogue tab opens its confirming dialog and does not submit or close', async (selector, dialog) => {
    await loadAndFlush();
    await openCatalogueTab();
    el().querySelector<HTMLButtonElement>(`.catalogue-actions ${selector}`)!.click();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(dialog, expect.objectContaining({ disableClose: true }));
    expect(close).not.toHaveBeenCalled();
  });

  it('shows no Catalogue tab when parent-entity curation is off', async () => {
    const flags = environment.catalogueParentCuration;
    environment.catalogueParentCuration = { ...flags, edit: false };
    try {
      await loadAndFlush();
      expect(texts('[role="tab"]')).not.toContain('Catalogue');
      expect(texts('mat-dialog-actions button')).toEqual(['Close', 'Submit']);
    } finally {
      environment.catalogueParentCuration = flags;
    }
  });
});
