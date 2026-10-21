import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { CurationSubmitService } from '../curation-submit.service';
import { MoveEpisodeToFilmDialogData } from '../episode-film-move.interface';
import { MoveEpisodeToFilmDialogComponent, moveErrorMessage } from './move-episode-to-film-dialog.component';

describe('MoveEpisodeToFilmDialogComponent', () => {
  let fixture: ComponentFixture<MoveEpisodeToFilmDialogComponent>;
  let component: MoveEpisodeToFilmDialogComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let postEpisodeToFilm: ReturnType<typeof vi.fn>;
  const data: MoveEpisodeToFilmDialogData = {
    podcastId: 'podcast-1',
    episodeId: 'episode-1',
    episodeTitle: 'Synthetic Episode Title'
  };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    postEpisodeToFilm = vi.fn();
    await TestBed.configureTestingModule({
      imports: [MoveEpisodeToFilmDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: CurationSubmitService, useValue: { postEpisodeToFilm: postEpisodeToFilm } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MoveEpisodeToFilmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('does not send anything until Move to film is pressed, and Cancel closes moved:false', () => {
    component.cancel();

    expect(postEpisodeToFilm).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith({ moved: false });
  });

  it('sends a null title when the title is unchanged, so the server keeps the episode title', () => {
    postEpisodeToFilm.mockReturnValue(of({ status: 202, body: { filmId: 'episode-1', name: data.episodeTitle } }));

    component.move();

    expect(postEpisodeToFilm).toHaveBeenCalledWith('podcast-1', 'episode-1', null);
    expect(dialogRef.close).toHaveBeenCalledWith({ moved: true, filmId: 'episode-1', name: data.episodeTitle });
  });

  it('sends a trimmed override title and closes with the film name from the response', () => {
    postEpisodeToFilm.mockReturnValue(of({ status: 202, body: { filmId: 'episode-1', name: 'Synthetic Film' } }));
    component.title.setValue('  Synthetic Film  ');

    component.move();

    expect(postEpisodeToFilm).toHaveBeenCalledWith('podcast-1', 'episode-1', 'Synthetic Film');
    expect(dialogRef.close).toHaveBeenCalledWith({ moved: true, filmId: 'episode-1', name: 'Synthetic Film' });
  });

  it("blocks a title containing '/' without calling the API", () => {
    component.title.setValue('Synthetic/Film');

    component.move();

    expect(component.hasInvalidTitle()).toBe(true);
    expect(postEpisodeToFilm).not.toHaveBeenCalled();
  });

  it('shows the name-conflict message on 409 and stays open', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postEpisodeToFilm.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));

    component.move();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(false);
    expect(component.error()).toContain('already exists');
    errorSpy.mockRestore();
  });

  it('maps 400 to the server error text and other failures to a retry hint', () => {
    expect(moveErrorMessage(new HttpErrorResponse({ status: 400, error: { error: 'A removed episode cannot be moved to a film' } })))
      .toBe('A removed episode cannot be moved to a film');
    expect(moveErrorMessage(new HttpErrorResponse({ status: 500 }))).toContain('resumes');
  });
});
