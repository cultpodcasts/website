import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { CatalogueParentEditModel } from '../catalogue-parent-edit';
import { EditCatalogueParentDialogComponent } from './edit-catalogue-parent-dialog.component';

const showId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
type Internals = {
  model(): CatalogueParentEditModel | null;
  defaultSubjects(): string[];
  filteredIgnoredSubjects(): string[];
  languages(): Record<string, string>;
  save(): Promise<void>; notFound(): boolean; saveError(): boolean; appleIdInvalid(): boolean };

describe('EditCatalogueParentDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  let confirmOpen: ReturnType<typeof vi.fn>;
  let confirmAnswer: { result: boolean } | undefined;
  const getUrl = new URL('/tvshow/Nightly', environment.api).toString();
  const patchUrl = new URL(`/tvshow/${showId}`, environment.api).toString();
  const subjectsUrl = new URL('/subjects', environment.api).toString();
  const languagesUrl = new URL('/languages', environment.api).toString();

  beforeEach(async () => {
    close = vi.fn();
    confirmAnswer = { result: true };
    confirmOpen = vi.fn(() => ({ afterClosed: () => of(confirmAnswer) }));
    await TestBed.configureTestingModule({
      imports: [EditCatalogueParentDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { hub: 'tv', name: 'Nightly' } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
      ]
    })
      // MatDialogModule (imported by the component) provides its own MatDialog, so override it everywhere.
      .overrideProvider(MatDialog, { useValue: { open: (...args: unknown[]) => (confirmOpen as unknown as (...a: unknown[]) => unknown)(...args) } })
      .compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function expectSoon(url: string) {
    const http = TestBed.inject(HttpTestingController);
    // match() removes what it returns, so keep the first hit.
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
    await loadWith({ id: showId, name: 'Nightly', publisher: 'Net', tvdb: 'https://thetvdb.com/series/x' });
    await settle();
    const model = dialog.model()!;
    model.publisher = 'Network Two';
    model.tvdb = '';
    const done = dialog.save();
    const req = await expectSoon(patchUrl);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ publisher: 'Network Two', tvdb: '' });
    req.flush(null, { status: 202, statusText: 'Accepted' });
    await done;
    expect(close).toHaveBeenCalledWith({ updated: true });
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

  it('blocks Save on a non-numeric Apple id', async () => {
    const dialog = create();
    await loadWith({ id: showId, name: 'Nightly' });
    await settle();
    dialog.model()!.appleId = 'abc';
    await dialog.save();
    expect(dialog.appleIdInvalid()).toBe(true);
    expect(close).not.toHaveBeenCalled();
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
});
