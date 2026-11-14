import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { CurationSubmitService } from '../curation-submit.service';
import { AttachTrailerDialogData } from '../episode-trailer-attach.interface';
import { Suggestion } from '../search-suggestions.interface';
import { SearchSuggestionsService } from '../search-suggestions.service';
import { AttachTrailerDialogComponent, attachErrorMessage } from './attach-trailer-dialog.component';

const filmId = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d';
const film: Suggestion = { type: 'film', value: 'Synthetic Film', label: 'Synthetic Film', itemId: filmId };

function selectedEvent(value: Suggestion): MatAutocompleteSelectedEvent {
  return { option: { value } } as unknown as MatAutocompleteSelectedEvent;
}

describe('AttachTrailerDialogComponent', () => {
  let fixture: ComponentFixture<AttachTrailerDialogComponent>;
  let component: AttachTrailerDialogComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let postEpisodeAsTrailer: ReturnType<typeof vi.fn>;
  let postEpisodeAsTrailerCreatingFilm: ReturnType<typeof vi.fn>;
  let openDialog: ReturnType<typeof vi.fn>;
  let suggest: ReturnType<typeof vi.fn>;
  const data: AttachTrailerDialogData = {
    podcastId: 'podcast-1',
    episodeId: 'episode-1',
    episodeTitle: 'Synthetic Episode Title'
  };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    postEpisodeAsTrailer = vi.fn();
    postEpisodeAsTrailerCreatingFilm = vi.fn();
    openDialog = vi.fn();
    suggest = vi.fn(async () => [film, { type: 'film', value: 'No Id Film', label: 'No Id Film' }]);
    await TestBed.configureTestingModule({
      imports: [AttachTrailerDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: CurationSubmitService, useValue: { postEpisodeAsTrailer, postEpisodeAsTrailerCreatingFilm } },
        { provide: SearchSuggestionsService, useValue: { preload: vi.fn(), suggest } }
      ]
    })
      // MatDialogModule (imported by the component) provides its own MatDialog, so override it everywhere.
      .overrideProvider(MatDialog, {
        useValue: { open: (...args: unknown[]) => (openDialog as unknown as (...a: unknown[]) => unknown)(...args) }
      })
      .compileComponents();

    fixture = TestBed.createComponent(AttachTrailerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('suggests films only, keeps those with an id, and needs a pick before attaching', async () => {
    await component.onFilmQuery('Synth');

    expect(suggest).toHaveBeenCalledWith('Synth', 10, 'film');
    expect(component.films()).toEqual([film]);
    expect(component.selected()).toBeNull();
    component.attach();
    expect(postEpisodeAsTrailer).not.toHaveBeenCalled();
  });

  it('sends the picked film id with a null title when the title is unchanged', () => {
    postEpisodeAsTrailer.mockReturnValue(of({ status: 202, body: { filmId, name: 'Synthetic Film' } }));
    component.onFilmSelected(selectedEvent(film));

    component.attach();

    expect(postEpisodeAsTrailer).toHaveBeenCalledWith('podcast-1', 'episode-1', filmId, null);
    expect(dialogRef.close).toHaveBeenCalledWith({ attached: true, filmId, name: 'Synthetic Film' });
  });

  it('accepts a pasted film id and sends a trimmed override title', async () => {
    postEpisodeAsTrailer.mockReturnValue(of({ status: 202, body: { filmId, name: 'Synthetic Film' } }));
    await component.onFilmQuery(`  ${filmId.toUpperCase()}  `);
    component.title.setValue('  Synthetic Teaser  ');

    component.attach();

    expect(suggest).not.toHaveBeenCalled();
    expect(postEpisodeAsTrailer).toHaveBeenCalledWith('podcast-1', 'episode-1', filmId, 'Synthetic Teaser');
  });

  it('typing after a pick clears it, so a stale film is never sent', async () => {
    component.onFilmSelected(selectedEvent(film));

    await component.onFilmQuery('Other');

    expect(component.selected()).toBeNull();
  });

  it('shows the server error and stays open when the attach fails', () => {
    postEpisodeAsTrailer.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 400, error: { error: 'A removed film cannot take trailers' }
    })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    component.onFilmSelected(selectedEvent(film));

    component.attach();

    expect(component.error()).toBe('A removed film cannot take trailers');
    expect(component.isSending()).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('#1418: offers Create film for a typed name no suggested film has, and not for an exact match', async () => {
    await component.onFilmQuery('  Faderhuset  ');
    expect(component.createName()).toBe('Faderhuset');

    await component.onFilmQuery('synthetic film');
    expect(component.createName()).toBeNull();

    await component.onFilmQuery('Bad/Name');
    expect(component.createName()).toBeNull();
  });

  it('#1418: Create film sends createFilm with the name and closes with the new film', async () => {
    postEpisodeAsTrailerCreatingFilm.mockReturnValue(of({
      status: 202, body: { filmId, name: 'Faderhuset', filmCreated: true }
    }));
    await component.onFilmQuery('Faderhuset');
    component.chooseCreate();

    component.attach();
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expect(component.selected()).toEqual({ id: null, name: 'Faderhuset', create: true });
    expect(postEpisodeAsTrailerCreatingFilm).toHaveBeenCalledWith('podcast-1', 'episode-1',
      { createFilm: true, filmName: 'Faderhuset' });
    expect(postEpisodeAsTrailer).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith({ attached: true, filmId, name: 'Faderhuset' });
  });

  it('#1418: an ambiguous identity opens the picker and re-sends the chosen key', async () => {
    const prompt = {
      target: 'Film', query: 'Faderhuset',
      candidates: [{ key: 'tmdb:123', title: 'Faderhuset', year: 2026, kind: 'Film', source: 'tmdb', tmdbId: 123 }]
    };
    postEpisodeAsTrailerCreatingFilm
      .mockReturnValueOnce(of({ status: 200, body: { identityDecision: prompt } }))
      .mockReturnValueOnce(of({ status: 202, body: { filmId, name: 'Faderhuset', filmCreated: true } }));
    openDialog.mockReturnValue({ afterClosed: () => of({ decision: 'select', key: 'tmdb:123' }) });
    component.title.setValue('Father\'s House | Official Trailer');

    await component.createAndAttach('Faderhuset');

    expect(openDialog).toHaveBeenCalledOnce();
    expect(postEpisodeAsTrailerCreatingFilm).toHaveBeenLastCalledWith('podcast-1', 'episode-1', {
      createFilm: true,
      filmName: 'Faderhuset',
      title: 'Father\'s House | Official Trailer',
      identityDecision: 'select',
      selectedIdentityKey: 'tmdb:123'
    });
    expect(dialogRef.close).toHaveBeenCalledWith({ attached: true, filmId, name: 'Faderhuset' });
  });

  it('#1418: dismissing the identity picker stops without attaching and keeps the dialog open', async () => {
    postEpisodeAsTrailerCreatingFilm.mockReturnValue(of({
      status: 200,
      body: { identityDecision: { target: 'Film', query: 'Faderhuset', candidates: [{ key: 'tmdb:1', title: 'Faderhuset', kind: 'Film', source: 'tmdb' }] } }
    }));
    openDialog.mockReturnValue({ afterClosed: () => of(undefined) });

    await component.createAndAttach('Faderhuset');

    expect(postEpisodeAsTrailerCreatingFilm).toHaveBeenCalledOnce();
    expect(component.isSending()).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('#1418: a create failure shows the server message', async () => {
    postEpisodeAsTrailerCreatingFilm.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { error: 'More than one film has this name; attach to one of them by id' }
    })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await component.createAndAttach('Faderhuset');

    expect(component.error()).toBe('More than one film has this name; attach to one of them by id');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('Cancel closes attached:false without sending', () => {
    component.cancel();

    expect(postEpisodeAsTrailer).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith({ attached: false });
  });
});

describe('attachErrorMessage', () => {
  it('explains a 500 as resumable', () => {
    expect(attachErrorMessage(new HttpErrorResponse({ status: 500 }))).toContain('resumes');
  });

  it('surfaces the server message when another film already holds the trailer (409)', () => {
    expect(attachErrorMessage(new HttpErrorResponse({
      status: 409,
      error: { error: 'This episode is already a trailer of another film', filmId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }
    }))).toBe('This episode is already a trailer of another film');
  });
});
