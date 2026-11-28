import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { AmbiguousIdentityAnswer } from '../ambiguous-identity-dialog/ambiguous-identity-dialog.component';
import { CurationSubmitService } from '../curation-submit.service';
import {
  CreateFilmDialogComponent,
  buildFilmCreateRequest,
  createFilmErrorMessage,
  createFilmMessage
} from './create-film-dialog.component';

describe('buildFilmCreateRequest', () => {
  it('sends a tt id as imdbId, lower-cased and trimmed', () => {
    expect(buildFilmCreateRequest('  TT0111161 ', '')).toEqual({ imdbId: 'tt0111161' });
  });

  it('sends digits as a numeric tmdbId', () => {
    expect(buildFilmCreateRequest('278', '')).toEqual({ tmdbId: 278 });
  });

  it('adds the title as an override next to an id', () => {
    expect(buildFilmCreateRequest('278', '  Synthetic Name ')).toEqual({ tmdbId: 278, title: 'Synthetic Name' });
  });

  it('sends a title alone for an identity lookup', () => {
    expect(buildFilmCreateRequest('', 'Synthetic Film')).toEqual({ title: 'Synthetic Film' });
  });

  it('sends nothing for blank input or an id that is neither IMDb nor TMDB', () => {
    expect(buildFilmCreateRequest('  ', '  ')).toBeNull();
    expect(buildFilmCreateRequest('not-an-id', 'Synthetic Film')).toBeNull();
    expect(buildFilmCreateRequest('99999999999', '')).toBeNull();
  });
});

describe('CreateFilmDialogComponent', () => {
  let fixture: ComponentFixture<CreateFilmDialogComponent>;
  let component: CreateFilmDialogComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let openIdentityDialog: ReturnType<typeof vi.fn>;
  let postFilm: ReturnType<typeof vi.fn>;

  const filmId = '11111111-2222-4333-8444-555555555555';
  const identityDecision = {
    target: 'Film',
    query: 'Synthetic Film',
    candidates: [{ key: 'tmdb:42', title: 'Synthetic Film', year: 2020, kind: 'Film', source: 'tmdb' }]
  };

  function mockIdentityAnswer(answer: AmbiguousIdentityAnswer | undefined) {
    openIdentityDialog.mockReturnValue({ afterClosed: () => of(answer) });
  }

  function httpError(status: number, error: unknown) {
    return throwError(() => new HttpErrorResponse({ status, error }));
  }

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    openIdentityDialog = vi.fn();
    postFilm = vi.fn();
    await TestBed.configureTestingModule({
      imports: [CreateFilmDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: CurationSubmitService, useValue: { postFilm: postFilm } }
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

    fixture = TestBed.createComponent(CreateFilmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('cannot send with no id and no title, so Create film posts nothing', async () => {
    expect(component.canSend()).toBe(false);

    await component.create();

    expect(postFilm).not.toHaveBeenCalled();
  });

  it('cannot send a malformed id or a title with a slash', () => {
    component.externalId.setValue('tt12');
    expect(component.hasInvalidId()).toBe(true);
    expect(component.canSend()).toBe(false);

    component.externalId.setValue('278');
    component.title.setValue('Synthetic/Film');
    expect(component.hasInvalidTitle()).toBe(true);
    expect(component.canSend()).toBe(false);
  });

  it('posts a TMDB id and closes created with the 202 acknowledgement (filmId + name)', async () => {
    postFilm.mockReturnValueOnce(of({ status: 202, body: { filmId, name: 'Synthetic Film' } }));
    component.externalId.setValue('278');

    await component.create();

    expect(postFilm).toHaveBeenCalledTimes(1);
    expect(postFilm).toHaveBeenCalledWith({ tmdbId: 278 });
    expect(dialogRef.close).toHaveBeenCalledWith({ created: true, filmId, name: 'Synthetic Film' });
  });

  it('posts an IMDb id with a title override', async () => {
    postFilm.mockReturnValueOnce(of({ status: 202, body: { filmId, name: 'Synthetic Override' } }));
    component.externalId.setValue('tt0111161');
    component.title.setValue('Synthetic Override');

    await component.create();

    expect(postFilm).toHaveBeenCalledWith({ imdbId: 'tt0111161', title: 'Synthetic Override' });
    expect(dialogRef.close).toHaveBeenCalledWith({ created: true, filmId, name: 'Synthetic Override' });
  });

  it('prompts on an ambiguous title, re-POSTs select with the picked key, then closes created', async () => {
    postFilm
      .mockReturnValueOnce(of({ status: 200, body: { identityDecision } }))
      .mockReturnValueOnce(of({ status: 202, body: { filmId, name: 'Synthetic Film' } }));
    mockIdentityAnswer({ decision: 'select', key: 'tmdb:42' });
    component.title.setValue('Synthetic Film');

    await component.create();

    expect(openIdentityDialog).toHaveBeenCalledTimes(1);
    expect(openIdentityDialog.mock.calls[0][1].data).toEqual(identityDecision);
    expect(postFilm).toHaveBeenNthCalledWith(1, { title: 'Synthetic Film' });
    expect(postFilm).toHaveBeenNthCalledWith(2, {
      title: 'Synthetic Film',
      identityDecision: 'select',
      selectedIdentityKey: 'tmdb:42'
    });
    expect(dialogRef.close).toHaveBeenCalledWith({ created: true, filmId, name: 'Synthetic Film' });
  });

  it('re-POSTs continue after the picker so a film with no identity can be created', async () => {
    postFilm
      .mockReturnValueOnce(of({ status: 200, body: { identityDecision } }))
      .mockReturnValueOnce(of({ status: 202, body: { filmId, name: 'Synthetic Film' } }));
    mockIdentityAnswer({ decision: 'continue' });
    component.title.setValue('Synthetic Film');

    await component.create();

    expect(postFilm).toHaveBeenNthCalledWith(2, { title: 'Synthetic Film', identityDecision: 'continue' });
    expect(dialogRef.close).toHaveBeenCalledWith({ created: true, filmId, name: 'Synthetic Film' });
  });

  it('tells the server to cancel when the picker is cancelled, and stays open', async () => {
    postFilm
      .mockReturnValueOnce(of({ status: 200, body: { identityDecision } }))
      .mockReturnValueOnce(of({ status: 200, body: { cancelled: true } }));
    mockIdentityAnswer({ decision: 'cancel' });
    component.title.setValue('Synthetic Film');

    await component.create();

    expect(postFilm).toHaveBeenNthCalledWith(2, { title: 'Synthetic Film', identityDecision: 'cancel' });
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(false);
  });

  it('tells the server to cancel when the picker is dismissed without an answer', async () => {
    postFilm
      .mockReturnValueOnce(of({ status: 200, body: { identityDecision } }))
      .mockReturnValueOnce(of({ status: 200, body: { cancelled: true } }));
    mockIdentityAnswer(undefined);
    component.title.setValue('Synthetic Film');

    await component.create();

    expect(postFilm).toHaveBeenNthCalledWith(2, { title: 'Synthetic Film', identityDecision: 'cancel' });
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('shows an error and does not open the picker when the identity prompt has no candidates', async () => {
    postFilm.mockReturnValueOnce(of({ status: 200, body: { identityDecision: { ...identityDecision, candidates: [] } } }));
    component.title.setValue('Synthetic Film');

    await component.create();

    expect(openIdentityDialog).not.toHaveBeenCalled();
    expect(component.error()).toContain('No confident identity match');
    expect(component.isSending()).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('stops after too many identity prompts', async () => {
    postFilm.mockReturnValue(of({ status: 200, body: { identityDecision } }));
    mockIdentityAnswer({ decision: 'select', key: 'tmdb:42' });
    component.title.setValue('Synthetic Film');

    await component.create();

    expect(postFilm).toHaveBeenCalledTimes(4);
    expect(component.error()).toBe('Identity lookup stopped after too many prompts.');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('selects the existing film on a 409 and Open existing film closes on it without creating', async () => {
    postFilm.mockReturnValueOnce(httpError(409, { filmId, name: 'Synthetic Film', error: 'Film exists.' }));
    component.externalId.setValue('278');

    await component.create();

    expect(component.existingFilm()).toEqual({ id: filmId, name: 'Synthetic Film' });
    expect(component.error()).toBe('Film exists.');
    expect(component.isSending()).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();

    component.openExisting();

    expect(dialogRef.close).toHaveBeenCalledWith({ created: false, existing: true, filmId, name: 'Synthetic Film' });
  });

  it('withdraws the 409 pick when either field is edited', async () => {
    postFilm.mockReturnValueOnce(httpError(409, { filmId, name: 'Synthetic Film' }));
    component.externalId.setValue('278');
    await component.create();

    component.onInput();

    expect(component.existingFilm()).toBeNull();
    expect(component.error()).toBeNull();
  });

  it('offers no existing film for a 409 whose winner was deleted (send again)', async () => {
    postFilm.mockReturnValueOnce(httpError(409, { error: 'The film was removed while it was being created. Send again.' }));
    component.externalId.setValue('278');

    await component.create();

    expect(component.existingFilm()).toBeNull();
    expect(component.error()).toBe('The film was removed while it was being created. Send again.');
  });

  it('closes created with failureIndexing when the film was kept but the search push failed', async () => {
    postFilm.mockReturnValueOnce(httpError(500, { failureIndexing: true, filmId, name: 'Synthetic Film' }));
    component.externalId.setValue('278');

    await component.create();

    expect(dialogRef.close).toHaveBeenCalledWith({
      created: true,
      failureIndexing: true,
      filmId,
      name: 'Synthetic Film'
    });
  });

  it('shows the server text for 404 and 400 and keeps the dialog open', async () => {
    postFilm.mockReturnValueOnce(httpError(404, { error: 'No TMDB movie 278.' }));
    component.externalId.setValue('278');
    await component.create();
    expect(component.error()).toBe('No TMDB movie 278.');

    postFilm.mockReturnValueOnce(httpError(400, { error: 'tmdbId and imdbId identify different films' }));
    await component.create();
    expect(component.error()).toBe('tmdbId and imdbId identify different films');
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(false);
  });

  it('Cancel closes created:false without posting', () => {
    component.cancel();

    expect(postFilm).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith({ created: false });
  });
});

describe('createFilmMessage', () => {
  it('offers attach-as-trailer after a created film', () => {
    expect(createFilmMessage({ created: true, filmId: 'f' })).toBe(
      'Film created. To attach a trailer, open the episode, choose Attach as trailer and pick this film.');
  });

  it('warns that a created film is not in search yet', () => {
    expect(createFilmMessage({ created: true, failureIndexing: true, filmId: 'f' })).toContain('not in search yet');
  });

  it('says an existing film was opened', () => {
    expect(createFilmMessage({ created: false, existing: true, filmId: 'f' })).toBe(
      'This film already exists. Opened it.');
  });
});

describe('createFilmErrorMessage', () => {
  it('falls back to a safe-to-resend message for other statuses', () => {
    expect(createFilmErrorMessage(new HttpErrorResponse({ status: 503 }))).toContain('Sending again is safe');
  });

  it('has a default for a 409 naming a film and for 400 / 404', () => {
    expect(createFilmErrorMessage(new HttpErrorResponse({ status: 409, error: { filmId: 'f' } })))
      .toBe('A film with this identity or name already exists.');
    expect(createFilmErrorMessage(new HttpErrorResponse({ status: 400 })))
      .toBe('The film cannot be created from this id or title.');
    expect(createFilmErrorMessage(new HttpErrorResponse({ status: 404 })))
      .toBe('No film was found for this id or title.');
  });
});
