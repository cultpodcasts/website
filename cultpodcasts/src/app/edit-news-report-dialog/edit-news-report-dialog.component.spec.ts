import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { newPlayableLinkGroup } from '../playable-edit-form.util';
import { MoveEpisodeToFilmDialogComponent } from '../move-episode-to-film-dialog/move-episode-to-film-dialog.component';
import { MoveEpisodeToTvShowDialogComponent } from '../move-episode-to-tv-show-dialog/move-episode-to-tv-show-dialog.component';
import { announceNewsReportMove, EditNewsReportDialogComponent } from './edit-news-report-dialog.component';

const reportId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const outletId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const api = (path: string) => new URL(path, environment.api).toString();
const archiveUrl = 'https://archive.org/details/synthetic-playable';
const iplayerUrl = 'https://www.bbc.co.uk/iplayer/episode/p0synth1/synthetic-playable';
const youtubeUrl = 'https://www.youtube.com/watch?v=synthetic01';

const synthetic = {
  id: reportId,
  title: 'Bulletin',
  description: 'Synthetic report',
  release: '2026-01-02',
  duration: '0:06:30',
  explicit: false,
  ignored: false,
  removed: false,
  posted: false,
  tweeted: false,
  blueskyPosted: false,
  subjects: ['Politics'],
  searchTerms: null,
  hashTag: null,
  language: null,
  guests: null,
  newsOrganisationId: outletId,
  newsOrganisationName: 'Desk',
  services: null as Record<string, { url?: string }> | null
};

describe('EditNewsReportDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  let openDialog: ReturnType<typeof vi.fn>;
  let openSnackBar: ReturnType<typeof vi.fn>;
  let snackAction: Subject<void>;
  let navigate: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<EditNewsReportDialogComponent>;

  beforeEach(async () => {
    close = vi.fn();
    openDialog = vi.fn();
    snackAction = new Subject<void>();
    openSnackBar = vi.fn(() => ({ onAction: () => snackAction }));
    navigate = vi.fn(async () => true);
    await TestBed.configureTestingModule({
      imports: [EditNewsReportDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { reportId } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MatSnackBar, useValue: { open: openSnackBar } },
        { provide: Router, useValue: { navigate } },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
      ]
    })
      .overrideProvider(MatDialog, {
        useValue: { open: (...args: unknown[]) => (openDialog as unknown as (...a: unknown[]) => unknown)(...args) }
      })
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
    fixture = TestBed.createComponent(EditNewsReportDialogComponent);
    fixture.detectChanges();
    (await expectSoon(api(`/newsreport/${reportId}`))).flush(dto);
    (await expectSoon(api('/subjects'))).flush([{ name: 'Politics' }, { name: 'Sport' }]);
    (await expectSoon(api('/people'))).flush([{ id: 'p1', name: 'Ann Example' }]);
    (await expectSoon(api('/languages'))).flush({ en: 'English', fr: 'French' });
    (await expectSoon(api(`/newsorganisation/${outletId}`))).flush({ id: outletId, name: 'Desk', defaultSubject: 'Politics' });
    await settle();
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('loads the report, the outlet name and the episode-editor lookups into the tabbed form', async () => {
    const dialog = await load();
    expect(dialog.isLoading()).toBe(false);
    expect(dialog.parentName()).toBe('Desk');
    expect(dialog.defaultSubject()).toBe('Politics');
    expect(dialog.languages()).toEqual({ unset: 'English', fr: 'French' });
    expect(dialog.subjectNames()).toEqual(['Politics', 'Sport']);
    const tabs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')).map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['Details', 'Flags', 'Urls', 'Meta', 'Images', 'Guests']);
    expect((fixture.nativeElement as HTMLElement).querySelector('#parent-name')?.textContent).toBe('Desk');
  });

  it('PATCHes only the changed fields and closes with the response and outlet name', async () => {
    const dialog = await load();
    dialog.form()!.patchValue({ title: 'Bulletin two', subjects: ['Politics', 'Sport'], guests: ['Ann Example'], lang: 'fr', removed: true });
    const saving = dialog.onSubmit();
    const patch = await expectSoon(api(`/newsreport/${reportId}`), 'PATCH');
    expect(patch.request.body).toEqual({
      title: 'Bulletin two',
      removed: true,
      subjects: ['Politics', 'Sport'],
      guests: ['Ann Example'],
      language: 'fr'
    });
    patch.flush({ searchIndexerState: 'Executed' }, { status: 202, statusText: 'Accepted' });
    await saving;
    expect(close).toHaveBeenCalledWith({ updated: true, response: { searchIndexerState: 'Executed' }, parentName: 'Desk' });
  });

  it('PATCHes Urls edits as services on newsreport/{id}', async () => {
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
    links.push(newPlayableLinkGroup(youtubeUrl));
    const saving = dialog.onSubmit();
    const patch = await expectSoon(api(`/newsreport/${reportId}`), 'PATCH');
    expect(patch.request.body).toEqual({
      services: {
        youtube: { url: youtubeUrl },
        bbcIplayer: { url: '', image: '' }
      }
    });
    patch.flush({ searchIndexerState: 'Executed' }, { status: 202, statusText: 'Accepted' });
    await saving;
    expect(close).toHaveBeenCalledWith({ updated: true, response: { searchIndexerState: 'Executed' }, parentName: 'Desk' });
  });

  it('PATCHes Images edits as services.*.image on newsreport/{id} while preserving url', async () => {
    const imageUrl = 'https://cdn.example.test/archive.jpg';
    const dialog = await load({
      ...synthetic,
      services: { internetArchive: { url: archiveUrl } }
    });
    dialog.form()!.controls.links!.at(0).controls.image.setValue(imageUrl);
    const saving = dialog.onSubmit();
    const patch = await expectSoon(api(`/newsreport/${reportId}`), 'PATCH');
    expect(patch.request.body).toEqual({
      services: {
        internetArchive: { image: imageUrl }
      }
    });
    patch.flush({ searchIndexerState: 'Executed' }, { status: 202, statusText: 'Accepted' });
    await saving;
  });

  it('closes with noChange and sends nothing when the form is untouched', async () => {
    const dialog = await load();
    await dialog.onSubmit();
    expect(close).toHaveBeenCalledWith({ noChange: true, parentName: 'Desk' });
  });

  it('shows the API message on a 400 and keeps the dialog open', async () => {
    const dialog = await load();
    dialog.form()!.patchValue({ duration: 'nonsense' });
    const saving = dialog.onSubmit();
    (await expectSoon(api(`/newsreport/${reportId}`), 'PATCH'))
      .flush({ message: 'Invalid duration' }, { status: 400, statusText: 'Bad Request' });
    await saving;
    expect(dialog.submitError()).toBe('Invalid duration');
    expect(close).not.toHaveBeenCalled();
  });

  it('shows an error when the report cannot be loaded', async () => {
    fixture = TestBed.createComponent(EditNewsReportDialogComponent);
    fixture.detectChanges();
    (await expectSoon(api(`/newsreport/${reportId}`))).flush({ id: reportId }, { status: 404, statusText: 'Not Found' });
    // forkJoin cancels the other lookups on the first error.
    TestBed.inject(HttpTestingController).match(() => true);
    await settle();
    expect(fixture.componentInstance.isInError()).toBe(true);
  });

  function button(selector: string): HTMLButtonElement {
    const el = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(selector);
    expect(el).not.toBeNull();
    return el!;
  }

  it('Move to TV show opens the move dialog for this news report and sends nothing itself', async () => {
    await load();
    openDialog.mockReturnValue({ afterClosed: () => of({ moved: false }) });

    button('button.move-to-tv-show').click();

    expect(openDialog).toHaveBeenCalledTimes(1);
    const [component, config] = openDialog.mock.calls[0];
    expect(component).toBe(MoveEpisodeToTvShowDialogComponent);
    expect(config.data).toMatchObject({
      newsReportId: reportId,
      episodeId: reportId,
      podcastId: outletId,
      podcastName: 'Desk',
      episodeTitle: 'Bulletin',
      release: '2026-01-02',
      hasUnsavedChanges: false
    });
    expect(close).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('after a TV show move closes as moved, announces it and opens the TV episode page', async () => {
    await load();
    openDialog.mockReturnValue({
      afterClosed: () => of({ moved: true, tvShowId: 'show-1', tvShowName: 'Synthetic Show', episodeId: reportId, createdShow: true })
    });

    button('button.move-to-tv-show').click();

    expect(close).toHaveBeenCalledWith({ moved: true, parentName: 'Desk' });
    expect(openSnackBar).toHaveBeenCalledWith('Moved to new TV show', 'Ok', { duration: 10000 });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('after a film move that empties the outlet offers Retire, which PATCHes the outlet removed', async () => {
    await load();
    openDialog.mockReturnValue({
      afterClosed: () => of({ moved: true, filmId: reportId, name: 'Bulletin', emptiedNewsOrganisationId: outletId })
    });

    button('button.move-to-film').click();

    expect(openDialog.mock.calls[0][0]).toBe(MoveEpisodeToFilmDialogComponent);
    expect(openDialog.mock.calls[0][1].data).toMatchObject({ newsReportId: reportId, episodeTitle: 'Bulletin' });
    expect(close).toHaveBeenCalledWith({ moved: true, parentName: 'Desk' });
    expect(openSnackBar).toHaveBeenCalledWith('Moved to film. Desk has no reports left.', 'Retire', { duration: 20000 });
    expect(navigate).toHaveBeenCalledTimes(1);
    TestBed.inject(HttpTestingController).expectNone(api(`/newsorganisation/${outletId}`));

    snackAction.next();
    const patch = await expectSoon(api(`/newsorganisation/${outletId}`), 'PATCH');
    expect(patch.request.body).toEqual({ removed: true });
    patch.flush(null, { status: 202, statusText: 'Accepted' });
    await settle();
    expect(openSnackBar).toHaveBeenLastCalledWith('Desk retired', 'Ok', { duration: 5000 });
  });

  it('when Retire hits a 404 (stale id or already removed) says there is nothing left to do', async () => {
    await load();
    openDialog.mockReturnValue({
      afterClosed: () => of({ moved: true, filmId: reportId, name: 'Bulletin', emptiedNewsOrganisationId: outletId })
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    button('button.move-to-film').click();
    snackAction.next();
    const patch = await expectSoon(api(`/newsorganisation/${outletId}`), 'PATCH');
    expect(patch.request.body).toEqual({ removed: true });
    patch.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(openSnackBar).toHaveBeenLastCalledWith('Desk was already removed or no longer exists', 'Ok', { duration: 10000 });
  });

  it('does nothing when the move dialog is cancelled', async () => {
    await load();
    openDialog.mockReturnValue({ afterClosed: () => of({ moved: false }) });

    button('button.move-to-film').click();

    expect(close).not.toHaveBeenCalled();
    expect(openSnackBar).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('announceNewsReportMove', () => {
  it('just announces the move when the outlet still has reports', () => {
    const open = vi.fn();
    const patchCatalogueParent = vi.fn();

    announceNewsReportMove({ open } as never, { patchCatalogueParent } as never, 'Moved to TV show', null, 'Desk');

    expect(open).toHaveBeenCalledWith('Moved to TV show', 'Ok', { duration: 10000 });
    expect(patchCatalogueParent).not.toHaveBeenCalled();
  });

  it('reports a failed retire (non-404) and leaves the outlet alone otherwise', () => {
    const action = new Subject<void>();
    const open = vi.fn(() => ({ onAction: () => action }));
    const patchCatalogueParent = vi.fn(() => throwError(() => new Error('synthetic')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    announceNewsReportMove({ open } as never, { patchCatalogueParent } as never, 'Moved to film', 'outlet-1', '');

    expect(open).toHaveBeenCalledWith('Moved to film. The news organisation has no reports left.', 'Retire', { duration: 20000 });
    expect(patchCatalogueParent).not.toHaveBeenCalled();
    action.next();
    expect(patchCatalogueParent).toHaveBeenCalledWith('news', 'outlet-1', { removed: true });
    expect(open).toHaveBeenLastCalledWith('Could not retire the news organisation', 'Ok', { duration: 10000 });
  });

  it('tells the curator a stale or already-removed outlet (404) needs nothing more', () => {
    const action = new Subject<void>();
    const open = vi.fn(() => ({ onAction: () => action }));
    const patchCatalogueParent = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found' })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    announceNewsReportMove({ open } as never, { patchCatalogueParent } as never, 'Moved to film', 'outlet-1', 'Desk');

    action.next();
    expect(patchCatalogueParent).toHaveBeenCalledWith('news', 'outlet-1', { removed: true });
    expect(open).toHaveBeenLastCalledWith('Desk was already removed or no longer exists', 'Ok', { duration: 10000 });
    expect(open).not.toHaveBeenCalledWith('Could not retire Desk', 'Ok', { duration: 10000 });
  });
});
