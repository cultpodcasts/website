import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { AmbiguousIdentityAnswer } from '../ambiguous-identity-dialog/ambiguous-identity-dialog.component';
import { CurationSubmitService } from '../curation-submit.service';
import { MoveEpisodeToFilmDialogData } from '../episode-film-move.interface';
import { Suggestion } from '../search-suggestions.interface';
import { SearchSuggestionsService } from '../search-suggestions.service';
import {
  MoveEpisodeToFilmDialogComponent,
  filmsMatchingExternalId,
  filmsNamed,
  isFilmExternalIdPaste,
  mergeErrorMessage,
  moveErrorMessage,
  releasedWithinDays
} from './move-episode-to-film-dialog.component';

/** Lets a catalogue lookup finish: suggest resolves, then onName continues. */
async function settleLookup(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('MoveEpisodeToFilmDialogComponent', () => {
  let fixture: ComponentFixture<MoveEpisodeToFilmDialogComponent>;
  let component: MoveEpisodeToFilmDialogComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let openIdentityDialog: ReturnType<typeof vi.fn>;
  let postEpisodeToFilm: ReturnType<typeof vi.fn>;
  const data: MoveEpisodeToFilmDialogData = {
    podcastId: 'podcast-1',
    episodeId: 'episode-1',
    episodeTitle: 'Synthetic Episode Title'
  };

  const identityDecision = {
    target: 'Film',
    query: 'Synthetic Episode Title',
    candidates: [{ key: 'tmdb:42', title: 'Synthetic Film', year: 2020, kind: 'Film', source: 'tmdb' }]
  };

  function mockIdentityAnswer(answer: AmbiguousIdentityAnswer | undefined) {
    openIdentityDialog.mockReturnValue({ afterClosed: () => of(answer) });
  }

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    openIdentityDialog = vi.fn();
    postEpisodeToFilm = vi.fn();
    await TestBed.configureTestingModule({
      imports: [MoveEpisodeToFilmDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: CurationSubmitService, useValue: { postEpisodeToFilm: postEpisodeToFilm } },
        {
          provide: SearchSuggestionsService,
          useValue: { suggest: vi.fn(async () => []), preload: vi.fn(), corpusLoadFailed: () => false }
        }
      ]
    })
      // MatDialogModule (imported by the component) provides its own MatDialog, so override it everywhere.
      .overrideProvider(MatDialog, {
        useValue: {
          open: (...args: unknown[]) =>
            (openIdentityDialog as unknown as (...a: unknown[]) => unknown)(...args)
        }
      })
      .compileComponents();

    fixture = TestBed.createComponent(MoveEpisodeToFilmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settleLookup();
  });

  it('does not send anything until Move to film is pressed, and Cancel closes moved:false', () => {
    component.cancel();

    expect(postEpisodeToFilm).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith({ moved: false });
  });

  it('prompts on ambiguous identity then re-POSTs select and closes moved', async () => {
    postEpisodeToFilm
      .mockReturnValueOnce(of({ status: 200, body: { identityDecision } }))
      .mockReturnValueOnce(of({ status: 202, body: { filmId: 'episode-1', name: data.episodeTitle } }));
    mockIdentityAnswer({ decision: 'select', key: 'tmdb:42' });

    await component.move();

    expect(openIdentityDialog).toHaveBeenCalled();
    expect(postEpisodeToFilm).toHaveBeenNthCalledWith(1, 'podcast-1', 'episode-1', {});
    expect(postEpisodeToFilm).toHaveBeenNthCalledWith(2, 'podcast-1', 'episode-1', {
      identityDecision: 'select',
      selectedIdentityKey: 'tmdb:42'
    });
    expect(dialogRef.close).toHaveBeenCalledWith({
      moved: true,
      filmId: 'episode-1',
      name: data.episodeTitle
    });
  });

  it('re-POSTs continue after identity prompt then closes moved on 202', async () => {
    postEpisodeToFilm
      .mockReturnValueOnce(of({ status: 200, body: { identityDecision } }))
      .mockReturnValueOnce(of({ status: 202, body: { filmId: 'episode-1', name: data.episodeTitle } }));
    mockIdentityAnswer({ decision: 'continue' });

    await component.move();

    expect(postEpisodeToFilm).toHaveBeenNthCalledWith(2, 'podcast-1', 'episode-1', {
      identityDecision: 'continue'
    });
    expect(dialogRef.close).toHaveBeenCalledWith({
      moved: true,
      filmId: 'episode-1',
      name: data.episodeTitle
    });
  });

  it('re-POSTs cancel with prior title when identity prompt is cancelled and stays open', async () => {
    postEpisodeToFilm
      .mockReturnValueOnce(of({ status: 200, body: { identityDecision } }))
      .mockReturnValueOnce(of({ status: 200, body: { cancelled: true } }));
    component.title.setValue('  Synthetic Override  ');
    await settleLookup();
    mockIdentityAnswer({ decision: 'cancel' });

    await component.move();

    expect(postEpisodeToFilm).toHaveBeenNthCalledWith(1, 'podcast-1', 'episode-1', {
      title: 'Synthetic Override'
    });
    expect(postEpisodeToFilm).toHaveBeenNthCalledWith(2, 'podcast-1', 'episode-1', {
      title: 'Synthetic Override',
      identityDecision: 'cancel'
    });
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(false);
  });

  it('re-POSTs cancel when the identity prompt is dismissed without an answer', async () => {
    postEpisodeToFilm
      .mockReturnValueOnce(of({ status: 200, body: { identityDecision } }))
      .mockReturnValueOnce(of({ status: 200, body: { cancelled: true } }));
    mockIdentityAnswer(undefined);

    await component.move();

    expect(postEpisodeToFilm).toHaveBeenNthCalledWith(2, 'podcast-1', 'episode-1', {
      identityDecision: 'cancel'
    });
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(false);
  });

  it('stays open with an error when identityDecision has no candidates', async () => {
    postEpisodeToFilm.mockReturnValue(of({
      status: 200,
      body: { identityDecision: { target: 'Film', query: 'Synthetic Episode Title', candidates: [] } }
    }));

    await component.move();

    expect(openIdentityDialog).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(false);
    expect(component.error()).toBe('No confident identity match.');
  });

  it('stays open with an error on bare 200 without a gate (does not treat as moved)', async () => {
    postEpisodeToFilm.mockReturnValue(of({ status: 200, body: { filmId: 'episode-1', name: 'Synthetic Film' } }));

    await component.move();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(false);
    expect(component.error()).toContain('Unexpected response');
  });

  it('sends an empty body when the title is unchanged, so the server keeps the episode title', async () => {
    postEpisodeToFilm.mockReturnValue(of({ status: 202, body: { filmId: 'episode-1', name: data.episodeTitle } }));

    await component.move();

    expect(postEpisodeToFilm).toHaveBeenCalledWith('podcast-1', 'episode-1', {});
    expect(dialogRef.close).toHaveBeenCalledWith({ moved: true, filmId: 'episode-1', name: data.episodeTitle });
  });

  it('sends a trimmed override title and closes with the film name from the response', async () => {
    postEpisodeToFilm.mockReturnValue(of({ status: 202, body: { filmId: 'episode-1', name: 'Synthetic Film' } }));
    component.title.setValue('  Synthetic Film  ');
    await settleLookup();

    await component.move();

    expect(postEpisodeToFilm).toHaveBeenCalledWith('podcast-1', 'episode-1', { title: 'Synthetic Film' });
    expect(dialogRef.close).toHaveBeenCalledWith({ moved: true, filmId: 'episode-1', name: 'Synthetic Film' });
  });

  it("blocks a title containing '/' without calling the API", async () => {
    component.title.setValue('Synthetic/Film');

    await component.move();

    expect(component.hasInvalidTitle()).toBe(true);
    expect(postEpisodeToFilm).not.toHaveBeenCalled();
  });

  it('shows the name-conflict message on 409 and stays open', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postEpisodeToFilm.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));

    await component.move();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(false);
    expect(component.error()).toContain('already exists');
    errorSpy.mockRestore();
  });

  it('warns that unsaved editor changes are discarded only when the editor is dirty', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.unsaved')).toBeNull();

    const dirty = TestBed.createComponent(MoveEpisodeToFilmDialogComponent);
    dirty.componentInstance.data = { ...data, hasUnsavedChanges: true };
    dirty.detectChanges();

    expect((dirty.nativeElement as HTMLElement).querySelector('.unsaved')?.textContent).toContain('discarded');
  });

  it('maps 400 to the server error text and other failures to a retry hint', () => {
    expect(moveErrorMessage(new HttpErrorResponse({ status: 400, error: { error: 'A removed episode cannot be moved to a film' } })))
      .toBe('A removed episode cannot be moved to a film');
    expect(moveErrorMessage(new HttpErrorResponse({ status: 500 }))).toContain('resumes');
  });

  it('warns about an Indexer re-add only for a recently released episode', () => {
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.recent')).toBeNull();

    const recent = TestBed.createComponent(MoveEpisodeToFilmDialogComponent);
    recent.componentInstance.data = { ...data, release: new Date(Date.now() - 60 * 60 * 1000).toISOString() };
    recent.detectChanges();

    expect((recent.nativeElement as HTMLElement).querySelector('.recent')?.textContent).toContain('indexer');
  });

  it('treats a release inside the window as recent, and an older, missing or invalid release as not', () => {
    const now = new Date('2026-01-10T12:00:00Z');

    expect(releasedWithinDays('2026-01-08T13:00:00Z', 3, now)).toBe(true);
    expect(releasedWithinDays('2026-01-07T11:00:00Z', 3, now)).toBe(false);
    expect(releasedWithinDays(null, 3, now)).toBe(false);
    expect(releasedWithinDays('not a date', 3, now)).toBe(false);
  });
});

describe('MoveEpisodeToFilmDialogComponent for a news report', () => {
  let fixture: ComponentFixture<MoveEpisodeToFilmDialogComponent>;
  let component: MoveEpisodeToFilmDialogComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let postEpisodeToFilm: ReturnType<typeof vi.fn>;
  let postNewsReportToFilm: ReturnType<typeof vi.fn>;
  let openIdentityDialog: ReturnType<typeof vi.fn>;
  const data: MoveEpisodeToFilmDialogData = {
    podcastId: 'outlet-1',
    episodeId: 'report-1',
    episodeTitle: 'Synthetic Report Title',
    newsReportId: 'report-1'
  };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    postEpisodeToFilm = vi.fn();
    postNewsReportToFilm = vi.fn();
    openIdentityDialog = vi.fn();
    await TestBed.configureTestingModule({
      imports: [MoveEpisodeToFilmDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: CurationSubmitService, useValue: { postEpisodeToFilm, postNewsReportToFilm } }
      ]
    })
      .overrideProvider(MatDialog, {
        useValue: {
          open: (...args: unknown[]) =>
            (openIdentityDialog as unknown as (...a: unknown[]) => unknown)(...args)
        }
      })
      .compileComponents();

    fixture = TestBed.createComponent(MoveEpisodeToFilmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('sends POST newsreport/{id}/film and closes with the film and the emptied news organisation', async () => {
    postNewsReportToFilm.mockReturnValue(of({
      status: 202, body: { filmId: 'report-1', name: 'Synthetic Report Title', emptiedNewsOrganisationId: 'outlet-1' }
    }));

    await component.move();

    expect(postEpisodeToFilm).not.toHaveBeenCalled();
    expect(postNewsReportToFilm).toHaveBeenCalledWith('report-1', {});
    expect(dialogRef.close).toHaveBeenCalledWith({
      moved: true, filmId: 'report-1', name: 'Synthetic Report Title', emptiedNewsOrganisationId: 'outlet-1'
    });
  });

  it('re-POSTs the identity answer to the news report endpoint', async () => {
    const identityDecision = {
      target: 'Film',
      query: 'Synthetic Report Title',
      candidates: [{ key: 'tmdb:42', title: 'Synthetic Film', year: 2020, kind: 'Film', source: 'tmdb' }]
    };
    postNewsReportToFilm
      .mockReturnValueOnce(of({ status: 200, body: { identityDecision } }))
      .mockReturnValueOnce(of({ status: 202, body: { filmId: 'report-1', name: 'Synthetic Film' } }));
    openIdentityDialog.mockReturnValue({ afterClosed: () => of({ decision: 'select', key: 'tmdb:42' }) });

    await component.move();

    expect(postNewsReportToFilm).toHaveBeenCalledTimes(2);
    expect(postNewsReportToFilm.mock.calls[1][0]).toBe('report-1');
    expect(postNewsReportToFilm.mock.calls[1][1]).toMatchObject({ identityDecision: 'select', selectedIdentityKey: 'tmdb:42' });
    expect(postEpisodeToFilm).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith({ moved: true, filmId: 'report-1', name: 'Synthetic Film' });
  });

  it('does not search or merge for a news report (RPP #1522 is podcast episodes only)', () => {
    fixture.detectChanges();

    expect(component.canMergeIntoExisting).toBe(false);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('mat-button-toggle-group')).toBeNull();
    expect(el.querySelector('input.film-name')).toBeNull();
    expect(el.querySelector('mat-label')?.textContent).toContain('Film title');
  });

  it('words the warning and errors for a news report', async () => {
    postNewsReportToFilm.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    await component.move();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('This removes the news report from its news organisation');
    expect(component.error()).toBe('The news report was not found. It may already have been moved.');
  });
});

describe('MoveEpisodeToFilmDialogComponent film match (RPP #1525)', () => {
  let fixture: ComponentFixture<MoveEpisodeToFilmDialogComponent>;
  let component: MoveEpisodeToFilmDialogComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let postEpisodeToFilm: ReturnType<typeof vi.fn>;
  let suggest: ReturnType<typeof vi.fn>;
  let corpusLoadFailed: ReturnType<typeof vi.fn>;
  const manicId = '925e2a11-668f-4dfa-a78d-57dd4de0051f';
  const data: MoveEpisodeToFilmDialogData = {
    podcastId: 'podcast-1',
    episodeId: 'episode-1',
    episodeTitle: 'My Father Led A Cult And Had Secret Families Across The World | Manic'
  };
  const manicSuggestion = { value: 'Manic', label: 'Manic', itemId: manicId };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    postEpisodeToFilm = vi.fn();
    suggest = vi.fn(async () => [manicSuggestion, { value: 'No id', label: 'No id' }]);
    corpusLoadFailed = vi.fn(() => false);
    await TestBed.configureTestingModule({
      imports: [MoveEpisodeToFilmDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: CurationSubmitService, useValue: { postEpisodeToFilm } },
        { provide: SearchSuggestionsService, useValue: { suggest, preload: vi.fn(), corpusLoadFailed } }
      ]
    })
      .overrideProvider(MatDialog, { useValue: { open: vi.fn() } })
      .compileComponents();

    fixture = TestBed.createComponent(MoveEpisodeToFilmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settleLookup();
  });

  function pick(film = manicSuggestion) {
    component.onFilmSelected({ option: { value: film } } as never);
  }

  it('has no New / Existing toggle; one film name field searches the catalogue', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('mat-button-toggle-group')).toBeNull();
    expect(el.querySelector('input.film-name')).not.toBeNull();
    expect(el.textContent).not.toContain('Existing film');
    const button = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Move to film');
    expect(button).toBeDefined();
  });

  it('selects the one film whose name matches and hides the new-film warning', async () => {
    await component.onName('Manic');
    fixture.detectChanges();

    expect(suggest).toHaveBeenCalledWith('Manic', 10, 'film', { allExactNames: true });
    expect(component.existingFilm()).toEqual({ id: manicId, name: 'Manic' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.warning')).toBeNull();
    expect(el.querySelector('.merge-note')?.textContent).toContain('another copy of a film already in the catalogue');
    expect(el.querySelector('.selected')?.textContent).toContain('Manic');
  });

  it('hides the recent-release warning once a matching film is selected', async () => {
    const recent = TestBed.createComponent(MoveEpisodeToFilmDialogComponent);
    recent.componentInstance.data = { ...data, release: new Date(Date.now() - 60 * 60 * 1000).toISOString() };
    recent.detectChanges();
    expect((recent.nativeElement as HTMLElement).querySelector('.recent')?.textContent).toContain('indexer');

    await recent.componentInstance.onName('Manic');
    recent.detectChanges();

    expect((recent.nativeElement as HTMLElement).querySelector('.recent')).toBeNull();
  });

  it('does not auto-select a partial name, and Move to film creates a film', async () => {
    await component.onName('Man');
    fixture.detectChanges();

    expect(component.films()).toEqual([manicSuggestion]);
    expect(component.existingFilm()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.selected')?.textContent).toContain('creates one');
    expect(component.canSend()).toBe(true);
  });

  it('asks for a pick when several films share the exact name, and will not create another', async () => {
    const other = { value: 'Manic', label: 'Manic', itemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    suggest.mockResolvedValue([manicSuggestion, other]);

    await component.onName('Manic');
    fixture.detectChanges();

    expect(component.existingFilm()).toBeNull();
    expect(component.severalExact()).toBe(true);
    expect(component.canSend()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Several films are called');
  });

  it('a picked suggestion merges, including when the typed name was only a partial match', async () => {
    await component.onName('Man');
    pick();

    expect(component.existingFilm()).toEqual({ id: manicId, name: 'Manic' });
    expect(component.canSend()).toBe(true);
  });

  it('takes a pasted film id as the pick without querying suggestions', async () => {
    suggest.mockClear();

    await component.onName(manicId.toUpperCase());

    expect(component.existingFilm()).toEqual({ id: manicId, name: null });
    expect(component.canSend()).toBe(true);
    expect(suggest).not.toHaveBeenCalled();
  });

  it('a blank field looks up the episode title and merges when that name is an exact film', async () => {
    const film = { value: data.episodeTitle, label: data.episodeTitle, itemId: manicId };
    suggest.mockResolvedValue([film]);
    component.title.setValue('', { emitEvent: false });

    await component.onName('');

    expect(suggest).toHaveBeenLastCalledWith(data.episodeTitle, 10, 'film', { allExactNames: true });
    expect(component.existingFilm()).toEqual({ id: manicId, name: data.episodeTitle });
    postEpisodeToFilm.mockReturnValue(of({ status: 202, body: { filmId: manicId, name: data.episodeTitle } }));

    await component.move();

    expect(postEpisodeToFilm).toHaveBeenCalledWith('podcast-1', 'episode-1', { filmId: manicId });
  });

  it('will not create a film when the catalogue fails to load, and a pasted film id still merges', async () => {
    corpusLoadFailed.mockReturnValue(true);
    suggest.mockResolvedValue([]);

    await component.onName('Manic');
    fixture.detectChanges();

    expect(component.canSend()).toBe(false);
    expect(component.searched()).toBe(false);
    expect(component.error()).toBe(
      'The film catalogue could not be loaded. Paste a film, IMDb or TMDB id to add this episode to an existing film.');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('creates one');
    await component.move();
    expect(postEpisodeToFilm).not.toHaveBeenCalled();

    corpusLoadFailed.mockReturnValue(false);
    await component.onName(manicId);

    expect(component.canSend()).toBe(true);
    expect(component.error()).toBeNull();
    postEpisodeToFilm.mockReturnValue(of({ status: 202, body: { filmId: manicId, name: 'Manic' } }));

    await component.move();

    expect(postEpisodeToFilm).toHaveBeenCalledWith('podcast-1', 'episode-1', { filmId: manicId });
  });

  it('takes a pasted IMDb id as that film and POSTs { filmId } (RPP #1534)', async () => {
    const imdbId = 'tt1234567';
    suggest.mockResolvedValue([{
      type: 'film',
      value: 'Manic',
      label: 'Manic',
      itemId: manicId,
      matchedAlias: imdbId
    }]);

    await component.onName(imdbId);

    expect(suggest).toHaveBeenCalledWith(imdbId, 10, 'film', { allExactNames: true });
    expect(component.existingFilm()).toEqual({ id: manicId, name: 'Manic' });
    expect(component.canSend()).toBe(true);
    postEpisodeToFilm.mockReturnValue(of({ status: 202, body: { filmId: manicId, name: 'Manic' } }));

    await component.move();

    expect(postEpisodeToFilm).toHaveBeenCalledWith('podcast-1', 'episode-1', { filmId: manicId });
  });

  it('takes a pasted TMDB id as that film and POSTs { filmId } (RPP #1534)', async () => {
    const tmdbId = '550';
    suggest.mockResolvedValue([{
      type: 'film',
      value: 'Manic',
      label: 'Manic',
      itemId: manicId,
      matchedAlias: tmdbId
    }]);

    await component.onName(tmdbId);

    expect(suggest).toHaveBeenCalledWith(tmdbId, 10, 'film', { allExactNames: true });
    expect(component.existingFilm()).toEqual({ id: manicId, name: 'Manic' });
    postEpisodeToFilm.mockReturnValue(of({ status: 202, body: { filmId: manicId, name: 'Manic' } }));

    await component.move();

    expect(postEpisodeToFilm).toHaveBeenCalledWith('podcast-1', 'episode-1', { filmId: manicId });
  });

  it('prefers an exact film title over a TMDB id when both would match', async () => {
    const titled = { value: '550', label: '550', itemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
    const byTmdb = {
      type: 'film' as const,
      value: 'Manic',
      label: 'Manic',
      itemId: manicId,
      matchedAlias: '550'
    };
    suggest.mockResolvedValue([titled, byTmdb]);

    await component.onName('550');

    expect(component.existingFilm()).toEqual({ id: titled.itemId, name: '550' });
  });

  it('offers every exact-name film when more than ten share that name', async () => {
    const films = Array.from({ length: 11 }, (_, index) => ({
      value: 'Manic',
      label: 'Manic',
      itemId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    }));
    suggest.mockResolvedValue(films);

    await component.onName('Manic');

    expect(suggest).toHaveBeenCalledWith('Manic', 10, 'film', { allExactNames: true });
    expect(component.films().map(film => film.itemId)).toEqual(films.map(film => film.itemId));
    expect(component.severalExact()).toBe(true);
    expect(component.canSend()).toBe(false);
  });

  it('POSTs only { filmId } and closes merged with the film from the response', async () => {
    postEpisodeToFilm.mockReturnValue(of({ status: 202, body: { filmId: manicId, name: 'Manic' } }));
    await component.onName('Manic');

    await component.move();

    expect(postEpisodeToFilm).toHaveBeenCalledWith('podcast-1', 'episode-1', { filmId: manicId });
    expect(dialogRef.close).toHaveBeenCalledWith({ moved: true, merged: true, filmId: manicId, name: 'Manic' });
  });

  it("shows the server's 409 text (film already has another YouTube link, #1411) and stays open", async () => {
    const error = "Film 'Manic' already has a different youtube link (https://www.youtube.com/watch?v=VCRf_qazO9s). A film holds one link per service until multiple YouTube links are supported (#1411).";
    postEpisodeToFilm.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { filmId: manicId, name: 'Manic', error } })));
    await component.onName('Manic');

    await component.move();

    expect(component.error()).toBe(error);
    expect(component.isSending()).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('a create that clashes on the name selects that film so the next click merges', async () => {
    postEpisodeToFilm.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { filmId: manicId, name: 'Manic', error: 'A film with this name already exists' } })));
    component.title.setValue('Manic', { emitEvent: false });

    await component.move();

    expect(postEpisodeToFilm).toHaveBeenCalledWith('podcast-1', 'episode-1', { title: 'Manic' });
    expect(component.existingFilm()).toEqual({ id: manicId, name: 'Manic' });
    expect(component.error()).toContain('It is selected');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('matches a film on its label or its canonical name', () => {
    expect(filmsNamed('manic', [manicSuggestion])).toEqual([manicSuggestion]);
    expect(filmsNamed('Other', [{ ...manicSuggestion, value: 'Other', label: 'Shown' }])).toEqual([
      { ...manicSuggestion, value: 'Other', label: 'Shown' }
    ]);
    expect(filmsNamed('Ma', [manicSuggestion])).toEqual([]);
  });

  it('matches a film on a pasted IMDb or TMDB alias and recognises those paste shapes', () => {
    const byImdb = { ...manicSuggestion, matchedAlias: 'tt7654321' };
    expect(filmsMatchingExternalId('tt7654321', [byImdb])).toEqual([byImdb]);
    expect(filmsMatchingExternalId('tt0000000', [byImdb])).toEqual([]);
    expect(isFilmExternalIdPaste('tt1234567')).toBe(true);
    expect(isFilmExternalIdPaste('550')).toBe(true);
    expect(isFilmExternalIdPaste('Manic')).toBe(false);
    expect(isFilmExternalIdPaste(manicId)).toBe(false);
  });

  it('maps merge errors: 409/400 use the server text, 404 and others a fixed hint', () => {
    expect(mergeErrorMessage(new HttpErrorResponse({ status: 400, error: { error: 'A removed film cannot take an episode\'s links' } })))
      .toBe("A removed film cannot take an episode's links");
    expect(mergeErrorMessage(new HttpErrorResponse({ status: 409 }))).toContain('different link');
    expect(mergeErrorMessage(new HttpErrorResponse({ status: 404 }))).toContain('not found');
    expect(mergeErrorMessage(new HttpErrorResponse({ status: 500 }))).toContain('resumes');
  });
});

describe('MoveEpisodeToFilmDialogComponent waits for the catalogue lookup', () => {
  let fixture: ComponentFixture<MoveEpisodeToFilmDialogComponent>;
  let component: MoveEpisodeToFilmDialogComponent;
  let postEpisodeToFilm: ReturnType<typeof vi.fn>;
  let resolveSuggest: (films: Suggestion[]) => void;
  const filmId = '925e2a11-668f-4dfa-a78d-57dd4de0051f';
  const data: MoveEpisodeToFilmDialogData = {
    podcastId: 'podcast-1',
    episodeId: 'episode-1',
    episodeTitle: 'Synthetic Film'
  };
  const exact: Suggestion = { type: 'film', value: 'Synthetic Film', label: 'Synthetic Film', itemId: filmId };

  beforeEach(async () => {
    postEpisodeToFilm = vi.fn();
    await TestBed.configureTestingModule({
      imports: [MoveEpisodeToFilmDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: CurationSubmitService, useValue: { postEpisodeToFilm } },
        {
          provide: SearchSuggestionsService,
          useValue: {
            preload: vi.fn(),
            corpusLoadFailed: () => false,
            suggest: () => new Promise<Suggestion[]>(resolve => { resolveSuggest = resolve; })
          }
        }
      ]
    })
      .overrideProvider(MatDialog, { useValue: { open: vi.fn() } })
      .compileComponents();

    fixture = TestBed.createComponent(MoveEpisodeToFilmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    resolveSuggest?.([]);
  });

  it('does not POST while suggest is unresolved, then merges the exact film once it settles', async () => {
    fixture.detectChanges();

    expect(component.canSend()).toBe(false);
    expect(component.searched()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('creates one');
    await component.move();
    expect(postEpisodeToFilm).not.toHaveBeenCalled();

    resolveSuggest([exact]);
    await settleLookup();

    expect(component.existingFilm()).toEqual({ id: filmId, name: 'Synthetic Film' });
    expect(component.canSend()).toBe(true);
    postEpisodeToFilm.mockReturnValue(of({ status: 202, body: { filmId, name: 'Synthetic Film' } }));

    await component.move();

    expect(postEpisodeToFilm).toHaveBeenCalledTimes(1);
    expect(postEpisodeToFilm).toHaveBeenCalledWith('podcast-1', 'episode-1', { filmId });
  });

  it('a pasted film id can send while the name lookup is still running', async () => {
    expect(component.canSend()).toBe(false);

    await component.onName(filmId);

    expect(component.existingFilm()).toEqual({ id: filmId, name: null });
    expect(component.canSend()).toBe(true);
    expect(postEpisodeToFilm).not.toHaveBeenCalled();
  });
});
