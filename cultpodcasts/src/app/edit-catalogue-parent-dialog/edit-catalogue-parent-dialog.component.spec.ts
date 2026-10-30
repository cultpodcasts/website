import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { CatalogueParentEditModel } from '../catalogue-parent-edit';
import { PODCAST_REGEXS_TAB_INDEX } from '../podcast-form.util';
import { EditCatalogueParentDialogComponent } from './edit-catalogue-parent-dialog.component';

const showId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
type Internals = {
  model(): CatalogueParentEditModel | null;
  defaultSubjects(): string[];
  filteredIgnoredSubjects(): string[];
  languages(): Record<string, string>;
  includeTitleRegexPresets(): { name: string; pattern: string }[];
  applyIncludeTitleRegexPreset(pattern: string): void;
  applyTitleRegexPreset(pattern: string): void;
  lookUpIdentity(): Promise<void>;
  identityLookupMessage(): string;
  clearIdentityField(field: 'imdbId' | 'tvdbId' | 'tmdbId'): void;
  imdbUrl(id: string): string;
  tvdbUrl(id: string): string;
  tmdbUrl(id: string): string;
  save(): Promise<void>; notFound(): boolean; saveError(): boolean; appleIdInvalid(): boolean; minimumDurationInvalid(): boolean; publicationDelayInvalid(): boolean };

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
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

/** Clicks a tab header and waits for its lazy body to render. */
async function showTab(fixture: ComponentFixture<EditCatalogueParentDialogComponent>, label: string) {
  fixture.detectChanges();
  const tab = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]'))
    .find((t) => t.textContent?.trim() === label);
  expect(tab).toBeTruthy();
  tab!.click();
  for (let i = 0; i < 5; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  fixture.detectChanges();
}

/** Renders the Flags tab (tab bodies are lazy) and returns its text. */
async function flagsTabText(fixture: ComponentFixture<EditCatalogueParentDialogComponent>): Promise<string> {
  await showTab(fixture, 'Flags');
  const body = fixture.debugElement.queryAll(By.css('.flags'));
  expect(body.length).toBe(1);
  return (body[0].nativeElement as HTMLElement).textContent ?? '';
}

function tabLabels(fixture: ComponentFixture<EditCatalogueParentDialogComponent>): (string | undefined)[] {
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim());
}

/** Providers shared by the TV show and news outlet blocks. */
function dialogProviders(data: { hub: 'tv' | 'news'; name: string }, close: unknown, snackOpen: unknown) {
  return [
    provideZonelessChangeDetection(),
    // Tab bodies switch on animation end, which jsdom never fires.
    { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
    provideHttpClient(withInterceptors([authInterceptor])),
    provideHttpClientTesting(),
    { provide: MAT_DIALOG_DATA, useValue: data },
    { provide: MatDialogRef, useValue: { close } },
    { provide: MatSnackBar, useValue: { open: snackOpen } },
    { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
  ];
}

describe('EditCatalogueParentDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  let confirmOpen: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.fn>;
  let confirmAnswer: { result: boolean } | undefined;
  const getUrl = new URL('/tvshow/Nightly', environment.api).toString();
  const patchUrl = new URL(`/tvshow/${showId}`, environment.api).toString();
  const subjectsUrl = new URL('/subjects', environment.api).toString();
  const languagesUrl = new URL('/languages', environment.api).toString();
  const lookupUrl = new URL('/catalogue/identity/lookup', environment.api).toString();

  beforeEach(async () => {
    close = vi.fn();
    snackOpen = vi.fn();
    confirmAnswer = { result: true };
    confirmOpen = vi.fn(() => ({ afterClosed: () => of(confirmAnswer) }));
    await TestBed.configureTestingModule({
      imports: [EditCatalogueParentDialogComponent],
      providers: dialogProviders({ hub: 'tv', name: 'Nightly' }, close, snackOpen)
    })
      // MatDialogModule (imported by the component) provides its own MatDialog, so override it everywhere.
      .overrideProvider(MatDialog, { useValue: { open: (...args: unknown[]) => (confirmOpen as unknown as (...a: unknown[]) => unknown)(...args) } })
      .compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  /** The dialog loads the show, `/subjects` and `/languages` together, like the podcast edit dialog. */
  async function loadWith(show: object, subjects = [{ name: 'Arts' }, { name: 'Sport' }], languages: Record<string, string> = { en: 'English', fr: 'French' }) {
    (await expectSoon(getUrl)).flush(show);
    (await expectSoon(subjectsUrl)).flush(subjects);
    (await expectSoon(languagesUrl)).flush(languages);
  }

  function create(): Internals {
    const fixture = TestBed.createComponent(EditCatalogueParentDialogComponent);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Internals;
  }

  it('loads by name, PATCHes only the changed fields by id, and closes on 202', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly', publisher: 'Net', tvdbId: 321, imdbId: 'tt0000001' });
    await settle();
    const model = dialog.model()!;
    model.publisher = 'Network Two';
    model.tvdbId = '';
    model.imdbId = 'tt0000002';
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ publisher: 'Network Two', imdbId: 'tt0000002', tvdbId: 0 });
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await done;
    expect(close).toHaveBeenCalledWith({ updated: true });
  });

  it('Flags tab has the checkboxes without helper text and without Skip Enriching From YouTube', async () => {
    const fixture = TestBed.createComponent(EditCatalogueParentDialogComponent);
    fixture.detectChanges();
    await loadWith({ id: showId, name: 'Nightly', skipEnrichingFromYouTube: true });
    await settle();
    const text = await flagsTabText(fixture);
    for (const label of ['Removed', 'Index All Episodes', 'Bypass Short Episode Checking', 'Always promote as hero', 'Ignore All Episodes']) {
      expect(text).toContain(label);
    }
    expect(text).not.toContain('Skip Enriching From YouTube');
    expect(text).not.toContain("You'll be asked to confirm");
    expect(fixture.debugElement.queryAll(By.css('.flags .hint')).length).toBe(0);
  });

  it('TV show tabs follow the podcast edit dialog order, with Identity last', async () => {
    const fixture = TestBed.createComponent(EditCatalogueParentDialogComponent);
    fixture.detectChanges();
    await loadWith({ id: showId, name: 'Nightly' });
    await settle();
    fixture.detectChanges();
    const tabs = tabLabels(fixture);
    expect(tabs).toEqual(['Details', 'Flags', 'Subjects', 'Social', 'Meta', 'Regexs', 'Identity']);
    expect(tabs.indexOf('Regexs')).toBe(PODCAST_REGEXS_TAB_INDEX);
  });

  it('keeps a stored skipEnrichingFromYouTube out of the PATCH when other flags change', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly', skipEnrichingFromYouTube: true });
    await settle();
    dialog.model()!.alwaysPromoteAsHero = true;
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.body).toEqual({ alwaysPromoteAsHero: true });
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await done;
  });

  it('closes with noChange and sends nothing when unchanged', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly' });
    await settle();
    await dialog.save();
    expect(close).toHaveBeenCalledWith({ noChange: true });
  });

  it('shows not found on 404 and offers no form', async () => {
    const dialog = create();
    // Answer the lookups sent alongside first, so none is left open or cancelled mid-flight.
    (await expectSoon(subjectsUrl)).flush([]);
    (await expectSoon(languagesUrl)).flush({});
    (await expectSoon(getUrl)).flush(null, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(dialog.notFound()).toBe(true);
    expect(dialog.model()).toBeNull();
  });

  it('PATCHes a YouTube channel id and clears the Apple id with nullAppleId', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly', appleId: 55 });
    await settle();
    const model = dialog.model()!;
    model.youTubeChannelId = 'UCcccccccccccccccccccccc';
    model.appleId = '';
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.body).toEqual({ youTubeChannelId: 'UCcccccccccccccccccccccc', nullAppleId: true });
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await done;
    expect(close).toHaveBeenCalledWith({ updated: true });
  });

  async function channelInput(playlistId: string) {
    const fixture = TestBed.createComponent(EditCatalogueParentDialogComponent);
    fixture.detectChanges();
    await loadWith({ id: showId, name: 'Nightly', youTubeChannelId: 'UCcccccccccccccccccccccc', youTubePlaylistId: playlistId });
    await settle();
    await showTab(fixture, 'Details');
    await settle();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return {
      input: root.querySelector<HTMLInputElement>('input[name="youTubeChannelId"]')!,
      hint: root.querySelector<HTMLElement>('#youtube-channel-ignored')
    };
  }

  it('greys out the YouTube channel id with a hint while a playlist id is set (RPP #1177)', async () => {
    const { input, hint } = await channelInput('PLsyntheticplaylist0000000000000000');
    expect(input.disabled).toBe(true);
    expect(hint?.textContent).toContain('Not used for indexing while a playlist id is set');
    expect(input.getAttribute('aria-describedby')).toContain('youtube-channel-ignored');
  });

  it('keeps the YouTube channel id editable without a hint when there is no playlist id', async () => {
    const { input, hint } = await channelInput('');
    expect(input.disabled).toBe(false);
    expect(hint).toBeNull();
  });

  it('blocks Save on a non-numeric Apple id', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly' });
    await settle();
    dialog.model()!.appleId = 'abc';
    await dialog.save();
    expect(dialog.appleIdInvalid()).toBe(true);
    expect(close).not.toHaveBeenCalled();
  });

  it('PATCHes the podcast flags, release authority and durations with podcast wire names', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly', releaseAuthority: 'YouTube', youTubePublicationDelay: '' });
    await settle();
    const model = dialog.model()!;
    model.bypassShortEpisodeChecking = true;
    model.alwaysPromoteAsHero = true;
    model.ignoreAllEpisodes = true;
    model.releaseAuthority = 'Unset';
    model.minimumDuration = '00:01:30';
    model.youTubePublicationDelay = '-1:00:00';
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.body).toEqual({
      minimumDuration: '00:01:30',
      youTubePublicationDelay: '-1:00:00',
      bypassShortEpisodeChecking: true,
      alwaysPromoteAsHero: true,
      ignoreAllEpisodes: true,
      unsetReleaseAuthority: true
    });
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await done;
    expect(close).toHaveBeenCalledWith({ updated: true });
  });

  it('blocks Save on an invalid minimum duration and flags only that field', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly' });
    await settle();
    dialog.model()!.minimumDuration = 'ninety';
    await dialog.save();
    expect(dialog.minimumDurationInvalid()).toBe(true);
    expect(dialog.publicationDelayInvalid()).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });

  it('blocks Save on an invalid publication delay and flags only that field', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly' });
    await settle();
    dialog.model()!.youTubePublicationDelay = 'an hour';
    await dialog.save();
    expect(dialog.publicationDelayInvalid()).toBe(true);
    expect(dialog.minimumDurationInvalid()).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });

  it('saves when the stored publication delay is a day or more in the .NET "g" form', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly', youTubePublicationDelay: '1:0:00:00' });
    await settle();
    dialog.model()!.description = 'Changed';
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.body).toEqual({ description: 'Changed' });
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await done;
    expect(dialog.publicationDelayInvalid()).toBe(false);
    expect(close).toHaveBeenCalledWith({ updated: true });
  });

  it('asks before removing, and sends nothing when the curator says No', async () => {
    confirmAnswer = { result: false };
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly', removed: false });
    await settle();
    dialog.model()!.removed = true;
    await dialog.save();
    expect(confirmOpen).toHaveBeenCalledTimes(1);
    expect(confirmOpen.mock.calls[0][1].data.question).toContain('all of its episodes will be hidden');
    expect(close).not.toHaveBeenCalled();
  });

  it('PATCHes removed after Yes, and restores without asking', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly', removed: false });
    await settle();
    dialog.model()!.removed = true;
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.body).toEqual({ removed: true });
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await done;
    expect(confirmOpen).toHaveBeenCalledTimes(1);

    const restore = create();
    await loadWith({ id: showId, name: 'Nightly', removed: true });
    await settle();
    restore.model()!.removed = false;
    const restored = restore.save();
    const restoreReq = await expectSoon(patchUrl);
    expect(restoreReq.request.body).toEqual({ removed: false });
    restoreReq.flush(null, { status: 202, statusText: 'Accepted' });
    await restored;
    expect(confirmOpen).toHaveBeenCalledTimes(1);
  });

  it('offers the podcast dialog subject and language selects and PATCHes picked values', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly', defaultSubject: 'Gone', ignoredSubjects: ['Sport'], language: null });
    await settle();
    expect(dialog.defaultSubjects()).toEqual(['Gone', 'Arts', 'Sport']);
    expect(dialog.filteredIgnoredSubjects()).toEqual(['Sport', 'Arts']);
    expect(dialog.languages()).toEqual({ unset: 'No Language', fr: 'French' });
    const model = dialog.model()!;
    expect(model.language).toBe('unset');
    model.defaultSubject = 'Arts';
    model.ignoredSubjects = ['Sport', 'Arts'];
    model.language = 'fr';
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.body).toEqual({ defaultSubject: 'Arts', ignoredSubjects: ['Sport', 'Arts'], language: 'fr' });
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await done;
  });

  it('applies include-title and title regex presets like the podcast Regexs tab', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly', indexAllEpisodes: true });
    await settle();
    const includePreset = dialog.includeTitleRegexPresets().find(
      x => x.name === 'Exclude Introducing / You Might Also Like');
    expect(includePreset).toBeTruthy();
    dialog.applyIncludeTitleRegexPreset(includePreset!.pattern);
    expect(dialog.model()!.episodeIncludeTitleRegex).toBe(includePreset!.pattern);
    expect(dialog.model()!.indexAllEpisodes).toBe(false);
    dialog.applyTitleRegexPreset("^(?'title'.*?)(?'suffix' \\| {podcastName})?$");
    expect(dialog.model()!.titleRegex).toBe("^(?'title'.*?)(?'suffix' \\| Nightly)?$");
  });

  it('builds IMDb / TheTVDB series / TMDB TV page URLs and clears identity fields', async () => {
    const dialog = create();
    await loadWith({
      id: showId,
      name: 'Nightly',
      imdbId: 'tt39398650',
      tmdbId: 255311,
      tvdbId: 321
    });
    await settle();
    expect(dialog.imdbUrl(dialog.model()!.imdbId)).toBe('https://www.imdb.com/title/tt39398650/');
    expect(dialog.tvdbUrl(dialog.model()!.tvdbId)).toBe('https://www.thetvdb.com/dereferrer/series/321');
    expect(dialog.tmdbUrl(dialog.model()!.tmdbId)).toBe('https://www.themoviedb.org/tv/255311');
    dialog.clearIdentityField('imdbId');
    expect(dialog.model()!.imdbId).toBe('');
    expect(dialog.model()!.tmdbId).toBe('255311');
  });

  it('Look up fills blank show identity on the model without PATCH until Save', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly', imdbId: null, tmdbId: null, tvdbId: null });
    await settle();
    const done = dialog.lookUpIdentity();
    const req = await expectSoon(lookupUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ kind: 'TvShow', title: 'Nightly' });
    req.flush({
      status: 'Matched',
      ids: { imdbId: 'tt0000099', tmdbId: 99, tvdbId: 88 }
    });
    await done;
    await settle();
    expect(dialog.model()!.imdbId).toBe('tt0000099');
    expect(dialog.model()!.tmdbId).toBe('99');
    expect(dialog.model()!.tvdbId).toBe('88');
    expect(dialog.identityLookupMessage()).toBe('Filled blank show identity. Save to keep.');
    expect(snackOpen).toHaveBeenCalledWith('Filled blank show identity. Save to keep.', 'Ok', { duration: 8000 });
    TestBed.inject(HttpTestingController).expectNone(patchUrl);
  });
});

describe('EditCatalogueParentDialogComponent (news outlet Flags tab)', () => {
  const getUrl = new URL('/newsorganisation/Desk', environment.api).toString();
  const subjectsUrl = new URL('/subjects', environment.api).toString();
  const languagesUrl = new URL('/languages', environment.api).toString();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditCatalogueParentDialogComponent],
      providers: dialogProviders({ hub: 'news', name: 'Desk' }, vi.fn(), vi.fn())
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('keeps the podcast tab order and shows no new-outlet defaults note or Skip Enriching From YouTube', async () => {
    const fixture = TestBed.createComponent(EditCatalogueParentDialogComponent);
    fixture.detectChanges();
    (await expectSoon(getUrl)).flush({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Desk', bypassShortEpisodeChecking: true, alwaysPromoteAsHero: true });
    (await expectSoon(subjectsUrl)).flush([{ name: 'Arts' }]);
    (await expectSoon(languagesUrl)).flush({ en: 'English' });
    await settle();
    const text = await flagsTabText(fixture);
    expect(tabLabels(fixture)).toEqual(['Details', 'Flags', 'Subjects', 'Social', 'Meta', 'Regexs']);
    expect(text).toContain('Always promote as hero');
    expect(text).not.toContain('New news organisations start with');
    expect(text).not.toContain('Skip Enriching From YouTube');
    expect(text).not.toContain("You'll be asked to confirm");
  });
});
