import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
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
import { NewsOrganisationEditModel } from '../catalogue-parent-edit';
import { JsonDateInterceptor } from '../json-date.interceptor';
import {
  PODCAST_DETAILS_TAB_INDEX,
  PODCAST_META_TAB_INDEX
} from '../podcast-form.util';
import {
  YOU_TUBE_PLAYLIST_CHANNEL_MISMATCH,
  YOU_TUBE_PLAYLIST_ID_INVALID,
  YOU_TUBE_PLAYLIST_LOOKUP_FAILED,
  YOU_TUBE_PLAYLIST_NOT_FOUND,
  YOU_TUBE_PLAYLIST_NOT_FOUND_MESSAGE,
  YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED_MESSAGE
} from '../youtube-playlist-edit-error';
import { EditNewsOrganisationDialogComponent } from './edit-news-organisation-dialog.component';

const showId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
type Internals = {
  model(): NewsOrganisationEditModel | null;
  defaultSubjects(): string[];
  filteredIgnoredSubjects(): string[];
  languages(): Record<string, string>;
  includeTitleRegexPresets(): { name: string; pattern: string }[];
  applyIncludeTitleRegexPreset(pattern: string): void;
  applyTitleRegexPreset(pattern: string): void;
  selectedTabIndex: { (): number; set(index: number): void };
  save(): Promise<void>; notFound(): boolean; saveError(): boolean; saveErrorMessage(): string; appleIdInvalid(): boolean; minimumDurationInvalid(): boolean; publicationDelayInvalid(): boolean };

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
async function showTab(fixture: ComponentFixture<EditNewsOrganisationDialogComponent>, label: string) {
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
async function flagsTabText(fixture: ComponentFixture<EditNewsOrganisationDialogComponent>): Promise<string> {
  await showTab(fixture, 'Flags');
  const body = fixture.debugElement.queryAll(By.css('.flags'));
  expect(body.length).toBe(1);
  return (body[0].nativeElement as HTMLElement).textContent ?? '';
}

function tabLabels(fixture: ComponentFixture<EditNewsOrganisationDialogComponent>): (string | undefined)[] {
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

describe('EditNewsOrganisationDialogComponent (news outlet Flags tab)', () => {
  const getUrl = new URL('/newsorganisation/Desk', environment.api).toString();
  const subjectsUrl = new URL('/subjects', environment.api).toString();
  const languagesUrl = new URL('/languages', environment.api).toString();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditNewsOrganisationDialogComponent],
      providers: dialogProviders({ hub: 'news', name: 'Desk' }, vi.fn(), vi.fn())
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('keeps the podcast tab order and shows no new-outlet defaults note or Skip Enriching From YouTube', async () => {
    const fixture = TestBed.createComponent(EditNewsOrganisationDialogComponent);
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

describe('EditNewsOrganisationDialogComponent (news outlet additional YouTube channels, RPP #1370)', () => {
  const outletId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const main = 'UCsyntheticChannel000001';
  const extraA = 'UCsyntheticChannel000002';
  const extraB = 'UCsyntheticChannel000003';
  const playlistB = 'PLsyntheticPlaylist00000001';
  const getUrl = new URL('/newsorganisation/Desk', environment.api).toString();
  const patchUrl = new URL(`/newsorganisation/${outletId}`, environment.api).toString();
  const subjectsUrl = new URL('/subjects', environment.api).toString();
  const languagesUrl = new URL('/languages', environment.api).toString();
  let close: ReturnType<typeof vi.fn>;

  type ChannelInternals = Omit<Internals, 'model'> & {
    model(): NewsOrganisationEditModel | null;
    addAdditionalYouTubeChannel(): void;
    setAdditionalYouTubeChannel(index: number, value: string): void;
    setAdditionalYouTubePlaylist(index: number, value: string): void;
    removeAdditionalYouTubeChannel(index: number): void;
    additionalChannelsError(): string | null;
  };

  beforeEach(async () => {
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EditNewsOrganisationDialogComponent],
      providers: dialogProviders({ hub: 'news', name: 'Desk' }, close, vi.fn())
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function open(outlet: object): Promise<{ fixture: ComponentFixture<EditNewsOrganisationDialogComponent>; dialog: ChannelInternals }> {
    const fixture = TestBed.createComponent(EditNewsOrganisationDialogComponent);
    fixture.detectChanges();
    (await expectSoon(getUrl)).flush({ id: outletId, name: 'Desk', youTubeChannelId: main, ...outlet });
    (await expectSoon(subjectsUrl)).flush([{ name: 'Arts' }]);
    (await expectSoon(languagesUrl)).flush({ en: 'English' });
    await settle();
    return { fixture, dialog: fixture.componentInstance as unknown as ChannelInternals };
  }

  function channelInputs(fixture: ComponentFixture<EditNewsOrganisationDialogComponent>): HTMLInputElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[name^="additionalYouTubeChannelId"]'));
  }

  function playlistInputs(fixture: ComponentFixture<EditNewsOrganisationDialogComponent>): HTMLInputElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[name^="additionalYouTubePlaylistId"]'));
  }

  it('lists the stored channels on Details with their optional playlists, a remove button each and an Add button', async () => {
    const { fixture } = await open({
      additionalYouTubeChannels: [{ youTubeChannelId: extraA, youTubePlaylistId: null }, { youTubeChannelId: extraB, youTubePlaylistId: playlistB }],
      additionalYouTubeChannelIds: [extraA, extraB]
    });
    await showTab(fixture, 'Details');
    await settle();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#additional-youtube-channels')?.textContent).toContain('Additional YouTube channels');
    expect(root.querySelector('#additional-youtube-channels')?.textContent).toContain('applies only to the main channel');
    expect(root.querySelector('#additional-youtube-channels')?.textContent).toContain("only that playlist's videos belong to this organisation");
    expect(channelInputs(fixture).map((input) => input.name)).toEqual(['additionalYouTubeChannelId0', 'additionalYouTubeChannelId1']);
    expect(channelInputs(fixture).map((input) => input.value)).toEqual([extraA, extraB]);
    expect(playlistInputs(fixture).map((input) => input.name)).toEqual(['additionalYouTubePlaylistId0', 'additionalYouTubePlaylistId1']);
    expect(playlistInputs(fixture).map((input) => input.value)).toEqual(['', playlistB]);
    expect(root.querySelector('#additional-youtube-channels')?.textContent).toContain('YouTube Playlist Id (optional)');
    expect(root.querySelector('[aria-label="Remove additional YouTube channel 2"]')).not.toBeNull();
    expect(root.querySelector('button.add-additional-channel')?.textContent?.trim()).toBe('Add YouTube channel');
  });

  it('Add then Save PATCHes the whole list as additionalYouTubeChannels, with the new row playlist (list replaces)', async () => {
    const { fixture, dialog } = await open({ additionalYouTubeChannelIds: [extraA] });
    await showTab(fixture, 'Details');
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.add-additional-channel')!.click();
    fixture.detectChanges();
    expect(dialog.model()!.additionalYouTubeChannels).toEqual([
      { youTubeChannelId: extraA, youTubePlaylistId: '' },
      { youTubeChannelId: '', youTubePlaylistId: '' }
    ]);
    dialog.setAdditionalYouTubeChannel(1, ` ${extraB} `);
    dialog.setAdditionalYouTubePlaylist(1, ` ${playlistB} `);
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      additionalYouTubeChannels: [{ youTubeChannelId: extraA }, { youTubeChannelId: extraB, youTubePlaylistId: playlistB }]
    });
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await done;
    expect(close).toHaveBeenCalledWith({ updated: true });
  });

  it('Add YouTube channel focuses the new row once it renders', async () => {
    const { fixture } = await open({ additionalYouTubeChannelIds: [extraA] });
    await showTab(fixture, 'Details');
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.add-additional-channel')!.click();
    await fixture.whenStable();
    await settle();
    expect(channelInputs(fixture).map((input) => input.name)).toEqual(['additionalYouTubeChannelId0', 'additionalYouTubeChannelId1']);
    expect((document.activeElement as HTMLInputElement | null)?.name).toBe('additionalYouTubeChannelId1');
  });

  it('removing every channel sends [] (clears)', async () => {
    const { fixture, dialog } = await open({ additionalYouTubeChannelIds: [extraA] });
    await showTab(fixture, 'Details');
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-label="Remove additional YouTube channel 1"]')!.click();
    fixture.detectChanges();
    expect(dialog.model()!.additionalYouTubeChannels).toEqual([]);
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.body).toEqual({ additionalYouTubeChannels: [] });
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await done;
  });

  it('leaves the list out of the PATCH when other fields change, and an added blank row is a no-op', async () => {
    const { dialog } = await open({ additionalYouTubeChannelIds: [extraA] });
    dialog.addAdditionalYouTubeChannel();
    dialog.model()!.publisher = 'Desk Media';
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.body).toEqual({ publisher: 'Desk Media' });
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await done;
  });

  it('typing a playlist on a stored channel PATCHes that channel scoped to it; clearing it makes the channel whole again', async () => {
    const { fixture, dialog } = await open({
      additionalYouTubeChannels: [{ youTubeChannelId: extraA, youTubePlaylistId: playlistB }],
      additionalYouTubeChannelIds: [extraA]
    });
    await showTab(fixture, 'Details');
    const input = playlistInputs(fixture)[0];
    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(dialog.model()!.additionalYouTubeChannels).toEqual([{ youTubeChannelId: extraA, youTubePlaylistId: '' }]);
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.body).toEqual({ additionalYouTubeChannels: [{ youTubeChannelId: extraA }] });
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await done;
  });

  it('blocks Save on a playlist without a channel or one channel with two playlists', async () => {
    const { dialog } = await open({ additionalYouTubeChannels: [] });
    dialog.addAdditionalYouTubeChannel();
    dialog.setAdditionalYouTubePlaylist(0, playlistB);
    await dialog.save();
    TestBed.inject(HttpTestingController).expectNone(patchUrl);
    expect(dialog.additionalChannelsError()).toBe(`Playlist '${playlistB}' needs the YouTube channel id it belongs to.`);

    dialog.setAdditionalYouTubeChannel(0, extraA);
    dialog.addAdditionalYouTubeChannel();
    dialog.setAdditionalYouTubeChannel(1, extraA);
    await dialog.save();
    TestBed.inject(HttpTestingController).expectNone(patchUrl);
    expect(dialog.additionalChannelsError()).toContain('listed more than once with different playlists');
  });

  it('shows the API reason for an additional playlist refusal and keeps the 503 lookup failure retryable', async () => {
    const { dialog } = await open({ additionalYouTubeChannels: [] });
    dialog.addAdditionalYouTubeChannel();
    dialog.setAdditionalYouTubeChannel(0, extraA);
    dialog.setAdditionalYouTubePlaylist(0, playlistB);
    let done = dialog.save();
    let req = await expectSoon(patchUrl);
    expect(req.request.body).toEqual({ additionalYouTubeChannels: [{ youTubeChannelId: extraA, youTubePlaylistId: playlistB }] });
    req.flush(
      { message: `Additional YouTube channel '${extraA}': playlist '${playlistB}' is on another channel.`, code: 'youTubePlaylistChannelMismatch' },
      { status: 400, statusText: 'Bad Request' }
    );
    await done;
    expect(dialog.saveError()).toBe(true);
    expect(dialog.saveErrorMessage()).toBe(`Additional YouTube channel '${extraA}': playlist '${playlistB}' is on another channel.`);
    expect(close).not.toHaveBeenCalled();

    done = dialog.save();
    req = await expectSoon(patchUrl);
    req.flush(
      { message: `Additional YouTube channel '${extraA}': the playlist could not be checked.`, code: 'youTubePlaylistLookupFailed' },
      { status: 503, statusText: 'Service Unavailable' }
    );
    await done;
    expect(dialog.saveError()).toBe(true);
    expect(dialog.saveErrorMessage()).toBe(YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED_MESSAGE);
    expect(close).not.toHaveBeenCalled();
  });

  it('appends the API message to a playlist not-found refusal so the curator sees which channel failed', async () => {
    const { dialog } = await open({ additionalYouTubeChannels: [] });
    dialog.addAdditionalYouTubeChannel();
    dialog.setAdditionalYouTubeChannel(0, extraA);
    dialog.setAdditionalYouTubePlaylist(0, playlistB);
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.body).toEqual({ additionalYouTubeChannels: [{ youTubeChannelId: extraA, youTubePlaylistId: playlistB }] });
    req.flush(
      { message: `Additional YouTube channel '${extraA}': the playlist was not found.`, code: YOU_TUBE_PLAYLIST_NOT_FOUND },
      { status: 400, statusText: 'Bad Request' }
    );
    await done;
    expect(dialog.saveError()).toBe(true);
    expect(dialog.saveErrorMessage()).toBe(
      `${YOU_TUBE_PLAYLIST_NOT_FOUND_MESSAGE}: Additional YouTube channel '${extraA}': the playlist was not found.`
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('blocks Save on a non-channel id or the main channel and shows the reason on Details', async () => {
    const { fixture, dialog } = await open({ additionalYouTubeChannelIds: [] });
    dialog.selectedTabIndex.set(PODCAST_META_TAB_INDEX);
    dialog.addAdditionalYouTubeChannel();
    dialog.setAdditionalYouTubeChannel(0, '@deskarchive');
    await dialog.save();
    TestBed.inject(HttpTestingController).expectNone(patchUrl);
    expect(dialog.additionalChannelsError()).toContain("'@deskarchive' is not a YouTube channel id");
    expect(dialog.selectedTabIndex()).toBe(PODCAST_DETAILS_TAB_INDEX);
    await showTab(fixture, 'Details');
    expect((fixture.nativeElement as HTMLElement).querySelector('#additional-youtube-channels-error')?.textContent)
      .toContain("'@deskarchive' is not a YouTube channel id");

    dialog.setAdditionalYouTubeChannel(0, main);
    expect(dialog.additionalChannelsError()).toBeNull();
    await dialog.save();
    TestBed.inject(HttpTestingController).expectNone(patchUrl);
    expect(dialog.additionalChannelsError()).toContain('is the main YouTube channel');
  });

  it('shows the API reason for a 400 channel refusal and a 409 owner conflict', async () => {
    const { dialog } = await open({ additionalYouTubeChannelIds: [] });
    dialog.addAdditionalYouTubeChannel();
    dialog.setAdditionalYouTubeChannel(0, extraA);
    let done = dialog.save();
    (await expectSoon(patchUrl)).flush(
      { message: `YouTube channel '${extraA}' is already claimed channel-wide (no playlist) by x.`, code: 'channelWideYouTubeConflict' },
      { status: 400, statusText: 'Bad Request' }
    );
    await done;
    expect(dialog.saveError()).toBe(true);
    expect(dialog.saveErrorMessage()).toBe(`YouTube channel '${extraA}' is already claimed channel-wide (no playlist) by x. Nothing was changed.`);
    expect(close).not.toHaveBeenCalled();

    done = dialog.save();
    (await expectSoon(patchUrl)).flush(
      {
        message: `additionalYouTubeChannelIds '${extraA}' is already used by eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee; URL submission could not tell them apart.`,
        ids: ['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']
      },
      { status: 409, statusText: 'Conflict' }
    );
    await done;
    expect(dialog.saveErrorMessage()).toBe(
      `Conflict: additionalYouTubeChannelIds '${extraA}' is already used by eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee; URL submission could not tell them apart. Nothing was changed.`
    );
  });
});

describe('EditNewsOrganisationDialogComponent (previous playlist ids, with the app JSON date interceptor)', () => {
  const getUrl = new URL('/newsorganisation/Desk', environment.api).toString();
  const subjectsUrl = new URL('/subjects', environment.api).toString();
  const languagesUrl = new URL('/languages', environment.api).toString();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditNewsOrganisationDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        // Same as app.config: JsonDateInterceptor turns ISO strings into Date objects before the dialog sees them.
        provideHttpClient(withInterceptors([authInterceptor]), withInterceptorsFromDi()),
        { provide: HTTP_INTERCEPTORS, useClass: JsonDateInterceptor, multi: true },
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { hub: 'news', name: 'Desk' } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
      ]
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renders the Details tab (history dates and the fields after them) when replacedAt arrives as a Date', async () => {
    const fixture = TestBed.createComponent(EditNewsOrganisationDialogComponent);
    fixture.detectChanges();
    (await expectSoon(getUrl)).flush({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      name: 'Desk',
      youTubePlaylistId: 'PLsyntheticplaylistnew000000000000',
      youTubePlaylistIdHistory: [
        { id: 'PLsyntheticplaylistold000000000000', replacedAt: '2026-10-30T23:45:12.345Z' },
        { id: 'PLsyntheticplaylistolder00000000000', replacedAt: '2026-01-02T03:04:05Z' }
      ],
      youTubePublicationDelay: '-1:00:00'
    });
    (await expectSoon(subjectsUrl)).flush([{ name: 'Arts' }]);
    (await expectSoon(languagesUrl)).flush({ en: 'English' });
    await settle();
    const history = (fixture.componentInstance as unknown as { playlistHistory(): { replacedAt: unknown }[] }).playlistHistory();
    expect(history[0].replacedAt).toBeInstanceOf(Date);
    await showTab(fixture, 'Details');
    await settle();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const items = Array.from(root.querySelectorAll('.history-item')).map((e) => e.textContent?.trim());
    expect(items).toEqual([
      'PLsyntheticplaylistold000000000000 (2026-10-30)',
      'PLsyntheticplaylistolder00000000000 (2026-01-02)'
    ]);
    // The fields after the history line still render (the bug left the rest of the dialog blank).
    expect(root.querySelector<HTMLInputElement>('input[name="youTubePublicationDelay"]')).not.toBeNull();
    expect(root.querySelector<HTMLInputElement>('input[name="youTubePlaylistId"]')!.value).toBe('PLsyntheticplaylistnew000000000000');
  });
});
