import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { EditFilmDialogComponent, staleTrailersMessage } from './edit-film-dialog.component';

const filmId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const api = (path: string) => new URL(path, environment.api).toString();

/** Synthetic `film/{id}` GET: publisher fields (name, publisher, defaultSubject) + playable fields, no title. */
const synthetic = {
  id: filmId,
  name: 'One Off',
  publisher: 'Example Pictures',
  description: 'A synthetic film',
  language: null,
  removed: false,
  twitterHandle: '',
  hashTag: null,
  searchTerms: null,
  defaultSubject: 'Arts',
  imdb: 'https://www.imdb.com/title/tt0000002/',
  imdbId: 'tt0000002',
  tmdbId: null,
  release: '1999',
  duration: '1:42:00',
  explicit: false,
  ignored: false,
  posted: false,
  tweeted: true,
  blueskyPosted: true,
  subjects: ['Arts'],
  guests: null,
  services: null
};

describe('EditFilmDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<EditFilmDialogComponent>;

  beforeEach(async () => {
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EditFilmDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { filmId } },
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

  async function settle() {
    for (let i = 0; i < 15; i++) {
      await Promise.resolve();
    }
  }

  async function load(dto: object = synthetic) {
    fixture = TestBed.createComponent(EditFilmDialogComponent);
    fixture.detectChanges();
    (await expectSoon(api(`/film/${filmId}`))).flush(dto);
    (await expectSoon(api('/subjects'))).flush([{ name: 'Arts' }, { name: 'Sport' }]);
    (await expectSoon(api('/people'))).flush([{ id: 'p1', name: 'Ann Example' }]);
    (await expectSoon(api('/languages'))).flush({ en: 'English', fr: 'French' });
    // A film has no parent: no /newsorganisation or /tvshow lookup (verify() fails on a stray request).
    await settle();
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('loads the film into the tabbed form: read-only name, publisher, its own default subject, Identity tab', async () => {
    const dialog = await load();
    expect(dialog.isLoading()).toBe(false);
    expect(dialog.parentName()).toBe('One Off');
    expect(dialog.defaultSubject()).toBe('Arts');
    expect(dialog.languages()).toEqual({ unset: 'English', fr: 'French' });
    const tabs = Array.from(element().querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['Details', 'Flags', 'Meta', 'Guests', 'Identity', 'Links', 'Trailers']);
    expect(element().querySelector('h2')?.textContent).toBe('Edit Film');
    expect(element().querySelector('#parent-name')).toBeNull();
    const name = element().querySelector<HTMLInputElement>('#film-name');
    expect(name?.value).toBe('One Off');
    expect(name?.disabled).toBe(true);
    const form = dialog.form()!;
    expect(form.controls.title.disabled).toBe(true);
    expect(form.controls.publisher?.value).toBe('Example Pictures');
    // json-url.interceptor would hand a URL object; the form always holds text.
    expect(form.controls.imdb?.value).toBe('https://www.imdb.com/title/tt0000002/');
    expect(form.controls.tvdb).toBeUndefined();
    expect(form.controls.release.value).toBe('1999');
    expect(form.valid).toBe(true);
  });

  it('turns a URL-object IMDb value into text before the form uses it', async () => {
    const dialog = await load({ ...synthetic, imdb: new URL('https://www.imdb.com/title/tt0000003/') });
    expect(dialog.form()!.controls.imdb?.value).toBe('https://www.imdb.com/title/tt0000003/');
  });

  it('PATCHes film/{id} with only the changed fields, never a title, and closes with the film name', async () => {
    const dialog = await load();
    const form = dialog.form()!;
    form.controls.title.setValue('Renamed attempt');
    form.patchValue({
      publisher: ' Other Pictures ',
      release: '1999-05-01',
      subjects: ['Arts', 'Sport'],
      guests: ['Ann Example'],
      tweeted: false,
      imdb: ''
    });
    dialog.pendingUnBluesky.set(true);
    const saving = dialog.onSubmit();
    const patch = await expectSoon(api(`/film/${filmId}`), 'PATCH');
    expect(patch.request.body).toEqual({
      release: '1999-05-01',
      tweeted: false,
      unBluesky: true,
      subjects: ['Arts', 'Sport'],
      guests: ['Ann Example'],
      publisher: 'Other Pictures',
      imdb: ''
    });
    expect('title' in patch.request.body).toBe(false);
    patch.flush({ searchIndexerState: 'Executed' }, { status: 202, statusText: 'Accepted' });
    await saving;
    expect(close).toHaveBeenCalledWith({ updated: true, response: { searchIndexerState: 'Executed' }, parentName: 'One Off' });
  });

  const trailered = {
    ...synthetic,
    services: { internetArchive: { url: 'https://archive.org/details/synthetic-film' } },
    trailers: [
      { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'Synthetic Teaser', url: 'https://www.youtube.com/watch?v=synthetic01', duration: '0:02:11' },
      { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', title: 'Synthetic Clip', url: 'https://www.youtube.com/watch?v=synthetic02', duration: '0:00:45' }
    ]
  };

  it('does not send a stale trailers list when a trailer was attached after the dialog opened', async () => {
    const dialog = await load(trailered);
    dialog.form()!.controls.trailers!.removeAt(1);
    const saving = dialog.onSubmit();
    (await expectSoon(api(`/film/${filmId}`))).flush({
      ...trailered,
      trailers: [
        ...trailered.trailers,
        { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Synthetic New Teaser', url: 'https://www.youtube.com/watch?v=synthetic03', duration: '0:01:00' }
      ]
    });
    await saving;
    // No PATCH (verify() in afterEach fails on one), the dialog stays open and says why.
    expect(dialog.submitError()).toBe(staleTrailersMessage(1));
    expect(close).not.toHaveBeenCalled();
  });

  it('PATCHes the IMDb / TMDB ids, links and trailers it edits', async () => {
    const dialog = await load(trailered);
    const form = dialog.form()!;
    form.controls.imdbId!.setValue('');
    form.controls.tmdbId!.setValue('99');
    form.controls.links!.at(0).setValue('https://archive.org/details/synthetic-film-restored');
    form.controls.trailers!.removeAt(1);
    form.controls.trailers!.at(0).controls.title.setValue('Synthetic Trailer');
    const saving = dialog.onSubmit();
    // A trailers change re-reads the film first; it has no trailer the dialog did not load.
    (await expectSoon(api(`/film/${filmId}`))).flush(trailered);
    const patch = await expectSoon(api(`/film/${filmId}`), 'PATCH');
    expect(patch.request.body).toEqual({
      imdbId: '',
      tmdbId: 99,
      services: { internetArchive: { url: 'https://archive.org/details/synthetic-film-restored' } },
      trailers: [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'Synthetic Trailer' }]
    });
    patch.flush({}, { status: 202, statusText: 'Accepted' });
    await saving;
  });

  it('closes with noChange and sends nothing when the form is untouched', async () => {
    const dialog = await load();
    await dialog.onSubmit();
    expect(close).toHaveBeenCalledWith({ noChange: true, parentName: 'One Off' });
  });

  it('rejects a release that is neither a year nor a date before saving', async () => {
    const dialog = await load();
    dialog.form()!.patchValue({ release: '05/1999' });
    expect(dialog.form()!.valid).toBe(false);
    await dialog.onSubmit();
    expect(close).not.toHaveBeenCalled();
  });

  it('shows the API message on a 400 and keeps the dialog open', async () => {
    const dialog = await load();
    dialog.form()!.patchValue({ duration: 'nonsense' });
    const saving = dialog.onSubmit();
    (await expectSoon(api(`/film/${filmId}`), 'PATCH'))
      .flush({ message: 'Invalid duration' }, { status: 400, statusText: 'Bad Request' });
    await saving;
    expect(dialog.submitError()).toBe('Invalid duration');
    expect(close).not.toHaveBeenCalled();
  });

  it('shows an error when the film cannot be loaded', async () => {
    fixture = TestBed.createComponent(EditFilmDialogComponent);
    fixture.detectChanges();
    (await expectSoon(api(`/film/${filmId}`))).flush({ id: filmId }, { status: 404, statusText: 'Not Found' });
    TestBed.inject(HttpTestingController).match(() => true);
    await settle();
    expect(fixture.componentInstance.isInError()).toBe(true);
  });
});
