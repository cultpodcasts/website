import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { CatalogueIdentityLookupResponse } from '../catalogue-identity-lookup.interface';
import { CurationSubmitService } from '../curation-submit.service';
import { buildPlayableEditForm } from '../playable-edit-form.util';
import { FilmDto, NewsReportDto, TvShowEpisodeDto } from '../playable-edit.interface';
import { ParentIdentityFilled, PlayableEditFieldsComponent } from './playable-edit-fields.component';

type Internals = {
  lookUpIdentity(): Promise<void>;
  identityLookupMessage(): string;
  tmdbUrl(id: string | null | undefined): string;
};

describe('PlayableEditFieldsComponent lookUpIdentity', () => {
  let fixture: ComponentFixture<PlayableEditFieldsComponent>;
  let lookup: ReturnType<typeof vi.fn>;
  let patchParent: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.fn>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let confirmAnswer: { result: boolean } | undefined;

  beforeEach(async () => {
    lookup = vi.fn();
    patchParent = vi.fn();
    snackOpen = vi.fn();
    confirmAnswer = { result: true };
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(confirmAnswer) }));
    await TestBed.configureTestingModule({
      imports: [PlayableEditFieldsComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: CurationSubmitService,
          useValue: {
            lookupCatalogueIdentity: lookup,
            patchCatalogueParent: patchParent,
            getPeople: () => of([])
          }
        },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
        { provide: MatDialog, useValue: { open: dialogOpen } }
      ]
    }).compileComponents();
  });
  function createFilm(overrides: Partial<FilmDto> = {}) {
    const form = buildPlayableEditForm({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      name: 'Synthetic Film',
      title: 'Synthetic Film',
      description: '',
      release: '2021',
      duration: '1:30:00',
      publisher: 'Studio',
      imdbId: null,
      tmdbId: null,
      ...overrides
    } as FilmDto, 'film');
    fixture = TestBed.createComponent(PlayableEditFieldsComponent);
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('parentLabel', 'Film');
    fixture.componentRef.setInput('variant', 'film');
    fixture.componentRef.setInput('subjectNames', []);
    fixture.componentRef.setInput('people', []);
    fixture.componentRef.setInput('languages', {});
    fixture.detectChanges();
    return { form, component: fixture.componentInstance as unknown as Internals };
  }

  function createTvEpisode(opts: {
    episode?: Partial<TvShowEpisodeDto>;
    parentImdbId?: string | null;
    parentTmdbId?: number | null;
    parentTvdbId?: number | null;
  } = {}) {
    const form = buildPlayableEditForm({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      title: 'Synthetic Episode',
      description: '',
      release: '2026-01-02',
      duration: '0:44:00',
      tvShowId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      tvShowName: 'Synthetic Show',
      imdbId: null,
      tmdbId: null,
      tvdbId: null,
      ...opts.episode
    } as TvShowEpisodeDto, 'tv');
    fixture = TestBed.createComponent(PlayableEditFieldsComponent);
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('parentLabel', 'TV Show');
    fixture.componentRef.setInput('parentName', 'Synthetic Show');
    fixture.componentRef.setInput('parentId', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    fixture.componentRef.setInput('parentImdbId', opts.parentImdbId ?? null);
    fixture.componentRef.setInput('parentTmdbId', opts.parentTmdbId ?? null);
    fixture.componentRef.setInput('parentTvdbId', opts.parentTvdbId ?? null);
    fixture.componentRef.setInput('variant', 'tv');
    fixture.componentRef.setInput('subjectNames', []);
    fixture.componentRef.setInput('people', []);
    fixture.componentRef.setInput('languages', {});
    fixture.detectChanges();
    return { form, component: fixture.componentInstance as unknown as Internals };
  }

  it('builds a TMDB movie URL for film and returns empty for TV episode', () => {
    const { component: film } = createFilm({ tmdbId: 42 });
    expect(film.tmdbUrl('42')).toBe('https://www.themoviedb.org/movie/42');
    expect(film.tmdbUrl('')).toBe('');
    const { component: tv } = createTvEpisode({ episode: { tmdbId: 42 } });
    expect(tv.tmdbUrl('42')).toBe('');
  });

  it('fills blank film identity controls and does not PATCH a parent', async () => {
    lookup.mockReturnValue(of<CatalogueIdentityLookupResponse>({
      status: 'Matched',
      ids: { imdbId: 'tt0000001', tmdbId: 42 }
    }));
    const { form, component } = createFilm();
    await component.lookUpIdentity();
    expect(form.controls.imdbId!.value).toBe('tt0000001');
    expect(form.controls.tmdbId!.value).toBe('42');
    expect(form.controls.imdbId!.dirty).toBe(true);
    expect(patchParent).not.toHaveBeenCalled();
    expect(dialogOpen).not.toHaveBeenCalled();
    expect(component.identityLookupMessage()).toBe('Filled blank film identity. Save to keep.');
    expect(snackOpen).toHaveBeenCalledWith('Filled blank film identity. Save to keep.', 'Ok', { duration: 8000 });
  });

  it('does not overwrite an existing film imdb id', async () => {
    lookup.mockReturnValue(of<CatalogueIdentityLookupResponse>({
      status: 'Matched',
      ids: { imdbId: 'tt9999999', tmdbId: 7 }
    }));
    const { form, component } = createFilm({ imdbId: 'tt1111111', tmdbId: null });
    await component.lookUpIdentity();
    expect(form.controls.imdbId!.value).toBe('tt1111111');
    expect(form.controls.tmdbId!.value).toBe('7');
    expect(patchParent).not.toHaveBeenCalled();
  });

  it('after confirm, PATCHes blank show identity and uses distinct snackbar copy', async () => {
    lookup.mockReturnValue(of<CatalogueIdentityLookupResponse>({
      status: 'Matched',
      ids: { imdbId: 'tt0000010', tmdbId: 10 },
      parentIds: { imdbId: 'tt0000099', tmdbId: 99, tvdbId: 88 }
    }));
    patchParent.mockReturnValue(of(new HttpResponse({ status: 202 })));
    const filled: ParentIdentityFilled[] = [];
    const { form, component } = createTvEpisode();
    fixture.componentInstance.parentIdentityFilled.subscribe((v) => filled.push(v));
    await component.lookUpIdentity();
    expect(form.controls.imdbId!.value).toBe('tt0000010');
    expect(dialogOpen).toHaveBeenCalledOnce();
    expect(dialogOpen.mock.calls[0][1].data.question).toContain('Also fill blank show identity');
    expect(patchParent).toHaveBeenCalledWith('tv', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', {
      imdbId: 'tt0000099',
      tmdbId: 99,
      tvdbId: 88
    });
    expect(filled).toEqual([{ imdbId: 'tt0000099', tmdbId: 99, tvdbId: 88 }]);
    const msg = component.identityLookupMessage();
    expect(msg).toContain('Filled blank episode identity. Save to keep.');
    expect(msg).toContain('Blank show identity was already saved on the TV show.');
    expect(msg).not.toMatch(/show identity\. Save to keep/);
  });

  it('skips the show PATCH when the curator declines the confirm', async () => {
    confirmAnswer = { result: false };
    lookup.mockReturnValue(of<CatalogueIdentityLookupResponse>({
      status: 'Matched',
      ids: { imdbId: 'tt0000010' },
      parentIds: { imdbId: 'tt0000099' }
    }));
    const { form, component } = createTvEpisode();
    await component.lookUpIdentity();
    expect(form.controls.imdbId!.value).toBe('tt0000010');
    expect(patchParent).not.toHaveBeenCalled();
    expect(component.identityLookupMessage()).toBe('Filled blank episode identity. Save to keep.');
  });

  it('does not re-PATCH show identity after local parent ids were filled', async () => {
    lookup.mockReturnValue(of<CatalogueIdentityLookupResponse>({
      status: 'Matched',
      ids: {},
      parentIds: { imdbId: 'tt0000099', tmdbId: 99 }
    }));
    patchParent.mockReturnValue(of(new HttpResponse({ status: 202 })));
    const { component } = createTvEpisode();
    await component.lookUpIdentity();
    expect(patchParent).toHaveBeenCalledOnce();
    await component.lookUpIdentity();
    expect(patchParent).toHaveBeenCalledOnce();
    expect(dialogOpen).toHaveBeenCalledOnce();
  });

  it('reports when show PATCH fails after confirm', async () => {
    lookup.mockReturnValue(of<CatalogueIdentityLookupResponse>({
      status: 'Matched',
      ids: { imdbId: 'tt0000010' },
      parentIds: { imdbId: 'tt0000099' }
    }));
    patchParent.mockReturnValue(throwError(() => new Error('down')));
    const { component } = createTvEpisode();
    await component.lookUpIdentity();
    expect(snackOpen).toHaveBeenCalledWith('Matched show identity but saving the TV show failed.', 'Ok', { duration: 8000 });
    expect(component.identityLookupMessage()).toBe('Filled blank episode identity. Save to keep.');
  });
});

describe('PlayableEditFieldsComponent Bluesky posted checkbox', () => {
  let fixture: ComponentFixture<PlayableEditFieldsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayableEditFieldsComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: CurationSubmitService,
          useValue: {
            lookupCatalogueIdentity: vi.fn(),
            patchCatalogueParent: vi.fn(),
            getPeople: () => of([])
          }
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } }
      ]
    }).compileComponents();
  });

  function createFilmWithBluesky(blueskyPosted: boolean) {
    const form = buildPlayableEditForm({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      name: 'Synthetic Film',
      title: 'Synthetic Film',
      description: '',
      release: '2021',
      duration: '1:30:00',
      publisher: 'Studio',
      imdbId: null,
      tmdbId: null,
      blueskyPosted
    } as FilmDto, 'film');
    fixture = TestBed.createComponent(PlayableEditFieldsComponent);
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('parentLabel', 'Film');
    fixture.componentRef.setInput('variant', 'film');
    fixture.componentRef.setInput('subjectNames', []);
    fixture.componentRef.setInput('people', []);
    fixture.componentRef.setInput('languages', {});
    fixture.detectChanges();
    return form;
  }

  it('exposes an enabled blueskyPosted FormControl like tweeted when never posted', () => {
    const form = createFilmWithBluesky(false);
    expect(form.controls.blueskyPosted.enabled).toBe(true);
    expect(form.controls.blueskyPosted.value).toBe(false);
    form.controls.blueskyPosted.setValue(true);
    expect(form.controls.blueskyPosted.value).toBe(true);
  });

  it('allows unticking blueskyPosted when originally posted', () => {
    const form = createFilmWithBluesky(true);
    expect(form.controls.blueskyPosted.value).toBe(true);
    form.controls.blueskyPosted.setValue(false);
    expect(form.controls.blueskyPosted.value).toBe(false);
  });
});

type GuestSuggestionInternals = {
  addSuggestedGuest(person: { id: string; name: string }): void;
  remainingGuestSuggestions(): { person: { id: string; name: string } }[];
  otherPeople(): { id: string; name: string }[];
};

describe('PlayableEditFieldsComponent guest suggestion chips', () => {
  let fixture: ComponentFixture<PlayableEditFieldsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayableEditFieldsComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: CurationSubmitService,
          useValue: {
            lookupCatalogueIdentity: vi.fn(),
            patchCatalogueParent: vi.fn(),
            getPeople: () => of([])
          }
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } }
      ]
    }).compileComponents();
  });

  it('Add suggestion chip appends guests, marks dirty, and clears that remaining suggestion', () => {
    const form = buildPlayableEditForm({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      name: 'Synthetic Film',
      title: 'Synthetic Film',
      description: '',
      release: '2021',
      duration: '1:30:00',
      publisher: 'Studio',
      imdbId: null,
      tmdbId: null,
      guests: ['Ann Example']
    } as FilmDto, 'film');
    const suggested = { id: 'person-suggested', name: 'Chris Suggested' };
    fixture = TestBed.createComponent(PlayableEditFieldsComponent);
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('parentLabel', 'Film');
    fixture.componentRef.setInput('variant', 'film');
    fixture.componentRef.setInput('subjectNames', []);
    fixture.componentRef.setInput('people', [{ id: 'person-ann', name: 'Ann Example' }]);
    fixture.componentRef.setInput('guestPeople', [{ id: 'person-ann', name: 'Ann Example' }]);
    fixture.componentRef.setInput('guestSuggestions', [
      { person: suggested, matchResults: [{ term: 'Chris', matches: 1 }] }
    ]);
    fixture.componentRef.setInput('languages', {});
    fixture.detectChanges();

    const component = fixture.componentInstance as unknown as GuestSuggestionInternals;
    expect(component.remainingGuestSuggestions()).toHaveLength(1);
    expect(component.otherPeople().some((p) => p.name === 'Chris Suggested')).toBe(true);

    component.addSuggestedGuest(suggested);

    expect(form.controls.guests.value).toEqual(['Ann Example', 'Chris Suggested']);
    expect(form.controls.guests.dirty).toBe(true);
    expect(component.remainingGuestSuggestions()).toEqual([]);
  });
});

@Component({
  selector: 'app-catalogue-tab-host',
  imports: [PlayableEditFieldsComponent],
  template: `
    <ng-template #catalogue><p class="synthetic-catalogue-content">Synthetic moves</p></ng-template>
    <app-playable-edit-fields [form]="form" parentLabel="News Outlet" parentName="Desk"
      [catalogueTab]="withCatalogue() ? catalogue : null"></app-playable-edit-fields>
  `
})
class CatalogueTabHostComponent {
  readonly withCatalogue = signal(true);
  readonly form = buildPlayableEditForm({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'Bulletin',
    description: '',
    release: '2026-01-02',
    duration: '0:06:30',
    newsOrganisationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    newsOrganisationName: 'Desk'
  } as NewsReportDto, 'news');
}

describe('PlayableEditFieldsComponent catalogueTab', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CatalogueTabHostComponent, PlayableEditFieldsComponent],
      providers: [
        provideZonelessChangeDetection(),
        // Tab bodies switch on animation end, which jsdom never fires.
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        {
          provide: CurationSubmitService,
          useValue: { lookupCatalogueIdentity: vi.fn(), patchCatalogueParent: vi.fn(), getPeople: () => of([]) }
        },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } }
      ]
    }).compileComponents();
  });

  const tabLabels = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('[role="tab"]')).map((t) => (t.textContent ?? '').trim());

  it('adds a last Catalogue tab that renders the passed template', async () => {
    const fixture = TestBed.createComponent(CatalogueTabHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(tabLabels(root)).toEqual(['Details', 'Flags', 'Urls', 'Meta', 'Images', 'Guests', 'Catalogue']);
    expect(root.querySelector('.synthetic-catalogue-content')).toBeNull();
    Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]')).find((t) => (t.textContent ?? '').trim() === 'Catalogue')!.click();
    for (let i = 0; i < 5; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(root.querySelector('.synthetic-catalogue-content')?.textContent).toBe('Synthetic moves');
  });

  it('shows no Catalogue tab when catalogueTab is null', () => {
    const fixture = TestBed.createComponent(CatalogueTabHostComponent);
    fixture.componentInstance.withCatalogue.set(false);
    fixture.detectChanges();
    expect(tabLabels(fixture.nativeElement as HTMLElement)).not.toContain('Catalogue');
  });

  it('leaves the film and TV episode tabs unchanged when no catalogueTab is passed', () => {
    const film = TestBed.createComponent(PlayableEditFieldsComponent);
    film.componentRef.setInput('form', buildPlayableEditForm({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', name: 'Synthetic Film', title: 'Synthetic Film', description: '',
      release: '2021', duration: '1:30:00', publisher: 'Studio', imdbId: null, tmdbId: null
    } as FilmDto, 'film'));
    film.componentRef.setInput('parentLabel', 'Film');
    film.componentRef.setInput('variant', 'film');
    film.detectChanges();
    expect(tabLabels(film.nativeElement as HTMLElement)).toEqual(
      ['Details', 'Flags', 'Urls', 'Meta', 'Images', 'Trailers', 'Guests', 'Identity']);

    const tv = TestBed.createComponent(PlayableEditFieldsComponent);
    tv.componentRef.setInput('form', buildPlayableEditForm({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', title: 'Synthetic Episode', description: '', release: '2026-01-02',
      duration: '0:44:00', tvShowId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', tvShowName: 'Synthetic Show',
      imdbId: null, tmdbId: null, tvdbId: null
    } as TvShowEpisodeDto, 'tv'));
    tv.componentRef.setInput('parentLabel', 'TV Show');
    tv.componentRef.setInput('variant', 'tv');
    tv.detectChanges();
    expect(tabLabels(tv.nativeElement as HTMLElement)).toEqual(
      ['Details', 'Flags', 'Urls', 'Meta', 'Images', 'Guests', 'Identity']);
  });
});