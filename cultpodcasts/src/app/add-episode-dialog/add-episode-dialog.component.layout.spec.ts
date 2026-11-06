import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { AddEpisodeDialogComponent } from './add-episode-dialog.component';

const podcastId = '4d3c2b1a-0f9e-4d8c-8b7a-6f5e4d3c2b1a';
const episodeId = '8f7e6d5c-4b3a-4291-8e7d-6c5b4a392817';
const api = (path: string) => new URL(path, environment.api).toString();

/** Synthetic `episode/{podcast}/{id}` GET. podcastId is required so the dialog loads the parent. */
const episode = {
  id: episodeId,
  podcastId,
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

describe('AddEpisodeDialogComponent layout', () => {
  const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  let fixture: ComponentFixture<AddEpisodeDialogComponent>;

  beforeEach(async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (q: string) => ({
        matches: false, media: q,
        addListener: () => { }, removeListener: () => { }, addEventListener: () => { }, removeEventListener: () => { }
      })
    });
    await TestBed.configureTestingModule({
      imports: [AddEpisodeDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        // Tab bodies switch on animation end, which jsdom never fires.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { podcastId, episodeId, isNewPodcast: false } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
      ]
    })
      .overrideProvider(MatDialog, { useValue: { open: vi.fn() } })
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
    fixture = TestBed.createComponent(AddEpisodeDialogComponent);
    fixture.detectChanges();
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

  /** Clicks a tab header and waits for its lazy body to render. */
  async function openTab(label: string) {
    fixture.detectChanges();
    const tab = Array.from(el().querySelectorAll<HTMLElement>('[role="tab"]'))
      .find((t) => (t.textContent ?? '').trim() === label);
    expect(tab).toBeTruthy();
    tab!.click();
    for (let i = 0; i < 5; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    fixture.detectChanges();
  }

  it('clears an extra-row image to empty text when Remove image is clicked', async () => {
    await loadAndFlush();
    fixture.componentInstance.addAdditionalUrl();
    const image = fixture.componentInstance.form()!.controls.additionalUrls.at(0)!.controls.image;
    image.setValue('https://cdn.example.test/art.jpg');
    await openTab('Images');
    const button = el().querySelector<HTMLButtonElement>('button[aria-label="Remove image"]');
    expect(button).toBeTruthy();
    expect(button!.disabled).toBe(false);
    button!.click();
    fixture.detectChanges();
    expect(image.value).toBe('');
    expect(image.dirty).toBe(true);
  });
});
