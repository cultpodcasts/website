import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
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
  let suggest: ReturnType<typeof vi.fn>;
  const data: AttachTrailerDialogData = {
    podcastId: 'podcast-1',
    episodeId: 'episode-1',
    episodeTitle: 'Synthetic Episode Title'
  };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    postEpisodeAsTrailer = vi.fn();
    suggest = vi.fn(async () => [film, { type: 'film', value: 'No Id Film', label: 'No Id Film' }]);
    await TestBed.configureTestingModule({
      imports: [AttachTrailerDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: CurationSubmitService, useValue: { postEpisodeAsTrailer } },
        { provide: SearchSuggestionsService, useValue: { preload: vi.fn(), suggest } }
      ]
    }).compileComponents();

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
});
