import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { CurationSubmitService } from '../curation-submit.service';
import { MoveEpisodeToFilmDialogData } from '../episode-film-move.interface';
import { MoveEpisodeToFilmDialogComponent, moveErrorMessage, releasedWithinDays } from './move-episode-to-film-dialog.component';

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
        { provide: MatDialog, useValue: { open: vi.fn() } },
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

  it('prompts on ambiguous identity then re-POSTs select and closes moved', async () => {
    const identityDecision = {
      target: 'Film',
      query: 'Synthetic Episode Title',
      candidates: [{ key: 'tmdb:42', title: 'Synthetic Film', year: 2020, kind: 'Film', source: 'tmdb' }]
    };
    postEpisodeToFilm
      .mockReturnValueOnce(of({ status: 200, body: { identityDecision } }))
      .mockReturnValueOnce(of({ status: 202, body: { filmId: 'episode-1', name: data.episodeTitle } }));
    vi.spyOn(component as unknown as { answerIdentity: () => Promise<unknown> }, 'answerIdentity')
      .mockResolvedValue({
        identityDecision: 'select',
        selectedIdentityKey: 'tmdb:42'
      });

    await component.move();

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

  it('sends an empty body when the title is unchanged, so the server keeps the episode title', async () => {
    postEpisodeToFilm.mockReturnValue(of({ status: 202, body: { filmId: 'episode-1', name: data.episodeTitle } }));

    await component.move();

    expect(postEpisodeToFilm).toHaveBeenCalledWith('podcast-1', 'episode-1', {});
    expect(dialogRef.close).toHaveBeenCalledWith({ moved: true, filmId: 'episode-1', name: data.episodeTitle });
  });

  it('sends a trimmed override title and closes with the film name from the response', async () => {
    postEpisodeToFilm.mockReturnValue(of({ status: 202, body: { filmId: 'episode-1', name: 'Synthetic Film' } }));
    component.title.setValue('  Synthetic Film  ');

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
