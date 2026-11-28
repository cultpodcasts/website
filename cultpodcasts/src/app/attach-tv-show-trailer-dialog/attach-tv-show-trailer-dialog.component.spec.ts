import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { CurationSubmitService } from '../curation-submit.service';
import { AttachTvShowTrailerDialogData } from '../episode-tv-show-trailer-attach.interface';
import { Suggestion } from '../search-suggestions.interface';
import { SearchSuggestionsService } from '../search-suggestions.service';
import {
  AttachTvShowTrailerDialogComponent,
  attachTvShowTrailerErrorMessage,
  attachedAsTvShowTrailerMessage,
  resolveTvShowErrorMessage
} from './attach-tv-show-trailer-dialog.component';

const showId = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d';
const show: Suggestion = { type: 'tvShow', value: 'Synthetic Show', label: 'Synthetic Show' };

function accepted(body: object) {
  return of({ status: 202, body });
}

describe('AttachTvShowTrailerDialogComponent', () => {
  let fixture: ComponentFixture<AttachTvShowTrailerDialogComponent>;
  let component: AttachTvShowTrailerDialogComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let postEpisodeAsTvShowTrailer: ReturnType<typeof vi.fn>;
  let getCatalogueParent: ReturnType<typeof vi.fn>;
  let suggest: ReturnType<typeof vi.fn>;

  async function create(data: Partial<AttachTvShowTrailerDialogData> = {}) {
    dialogRef = { close: vi.fn() };
    postEpisodeAsTvShowTrailer = vi.fn();
    getCatalogueParent = vi.fn();
    suggest = vi.fn(async () => [show, { ...show, label: 'Synthetic Show (alias)' }]);
    await TestBed.configureTestingModule({
      imports: [AttachTvShowTrailerDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRef },
        {
          provide: MAT_DIALOG_DATA, useValue: {
            podcastId: 'podcast-1',
            podcastName: 'Synthetic Podcast',
            episodeId: 'episode-1',
            episodeTitle: 'Synthetic Episode Title',
            ...data
          }
        },
        { provide: CurationSubmitService, useValue: { postEpisodeAsTvShowTrailer, getCatalogueParent } },
        { provide: SearchSuggestionsService, useValue: { preload: vi.fn(), suggest } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AttachTvShowTrailerDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('suggests TV shows only, by name once, and needs a show before attaching', async () => {
    await create();

    await component.onShowQuery('Synth');

    expect(suggest).toHaveBeenCalledWith('Synth', 10, 'tvShow');
    expect(component.shows()).toEqual(['Synthetic Show']);
    expect(component.target()).toBeNull();
    await component.attach();
    expect(postEpisodeAsTvShowTrailer).not.toHaveBeenCalled();
    expect(getCatalogueParent).not.toHaveBeenCalled();
  });

  it('does not ask for suggestions for a pasted id or a one-character query, and keeps typing after a failed suggest', async () => {
    await create();

    await component.onShowQuery(showId);
    await component.onShowQuery('S');
    expect(suggest).not.toHaveBeenCalled();

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    suggest.mockRejectedValue(new Error('offline'));
    await component.onShowQuery('Synth');
    expect(component.shows()).toEqual([]);
  });

  it('sends a pasted show id as tvShowId, with no title when the title is unchanged, then closes with the show', async () => {
    await create();
    postEpisodeAsTvShowTrailer.mockReturnValue(accepted({ tvShowId: showId, tvShowName: 'Synthetic Show' }));
    component.showQuery.setValue(`  ${showId.toUpperCase()}  `);

    await component.attach();

    expect(getCatalogueParent).not.toHaveBeenCalled();
    expect(postEpisodeAsTvShowTrailer).toHaveBeenCalledWith('podcast-1', 'episode-1', { tvShowId: showId });
    expect(dialogRef.close).toHaveBeenCalledWith({ attached: true, tvShowId: showId, tvShowName: 'Synthetic Show' });
  });

  it('resolves a picked name to the show id first, then sends a trimmed override title', async () => {
    await create();
    getCatalogueParent.mockReturnValue(of({ id: showId, name: 'Synthetic Show' }));
    postEpisodeAsTvShowTrailer.mockReturnValue(accepted({ tvShowId: showId, tvShowName: 'Synthetic Show' }));
    component.showQuery.setValue('Synthetic Show');
    component.title.setValue('  Synthetic Teaser  ');

    await component.attach();

    expect(getCatalogueParent).toHaveBeenCalledWith('tv', 'Synthetic Show');
    expect(postEpisodeAsTvShowTrailer).toHaveBeenCalledWith('podcast-1', 'episode-1', { tvShowId: showId, title: 'Synthetic Teaser' });
    expect(dialogRef.close).toHaveBeenCalledWith({ attached: true, tvShowId: showId, tvShowName: 'Synthetic Show' });
  });

  it('attaches nothing and says to tick Create when the picked name matches no show', async () => {
    await create();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getCatalogueParent.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    component.showQuery.setValue('Unknown Show');

    await component.attach();

    expect(postEpisodeAsTvShowTrailer).not.toHaveBeenCalled();
    expect(component.error()).toBe(resolveTvShowErrorMessage(new HttpErrorResponse({ status: 404 })));
    expect(component.error()).toContain('Create a new TV show');
    expect(component.isSending()).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('attaches nothing and asks for the id when two shows share the picked name', async () => {
    await create();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getCatalogueParent.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    component.showQuery.setValue('Synthetic Show');

    await component.attach();

    expect(postEpisodeAsTvShowTrailer).not.toHaveBeenCalled();
    expect(component.error()).toBe('More than one TV show has this name. Paste the id of the TV show to attach to.');
  });

  it('create sends createShow with the name and the BBC publisher default, and closes with the created show', async () => {
    await create({ podcastName: 'BBC' });
    postEpisodeAsTvShowTrailer.mockReturnValue(accepted({ tvShowId: showId, tvShowName: 'New Show', showCreated: true }));
    component.showQuery.setValue('  New Show ');
    component.createShow.setValue(true);

    expect(component.isCreatingShow()).toBe(true);
    await component.attach();

    expect(getCatalogueParent).not.toHaveBeenCalled();
    expect(postEpisodeAsTvShowTrailer).toHaveBeenCalledWith('podcast-1', 'episode-1', {
      createShow: true,
      tvShowName: 'New Show',
      publisher: 'BBC'
    });
    expect(dialogRef.close).toHaveBeenCalledWith({ attached: true, tvShowId: showId, tvShowName: 'New Show', showCreated: true });
  });

  it('create leaves out a blank publisher and sends an override title', async () => {
    await create();
    postEpisodeAsTvShowTrailer.mockReturnValue(accepted({ tvShowId: showId, tvShowName: 'New Show' }));
    component.showQuery.setValue('New Show');
    component.createShow.setValue(true);
    component.title.setValue('Synthetic Clip');

    await component.attach();

    expect(postEpisodeAsTvShowTrailer).toHaveBeenCalledWith('podcast-1', 'episode-1', {
      createShow: true,
      tvShowName: 'New Show',
      title: 'Synthetic Clip'
    });
  });

  it('a pasted id wins over the create box, and a name with a slash is never sent', async () => {
    await create();
    component.createShow.setValue(true);

    component.showQuery.setValue(showId);
    expect(component.target()).toEqual({ kind: 'id', tvShowId: showId });
    expect(component.isCreatingShow()).toBe(false);

    component.showQuery.setValue('Bad/Name');
    expect(component.hasInvalidName()).toBe(true);
    expect(component.target()).toBeNull();
    await component.attach();
    expect(postEpisodeAsTvShowTrailer).not.toHaveBeenCalled();
  });

  it('shows the server error and stays open when the attach fails', async () => {
    await create();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postEpisodeAsTvShowTrailer.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { error: 'Already a trailer of "Other Show"' }
    })));
    component.showQuery.setValue(showId);

    await component.attach();

    expect(component.error()).toBe('Already a trailer of "Other Show"');
    expect(component.isSending()).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('cancel closes with attached false', async () => {
    await create();

    component.cancel();

    expect(dialogRef.close).toHaveBeenCalledWith({ attached: false });
  });

  it('attach button is disabled until there is a target, and labelled as a TV trailer/clip', async () => {
    await create();
    const button = () => Array.from(fixture.nativeElement.querySelectorAll('mat-dialog-actions button') as NodeListOf<HTMLButtonElement>)
      .find(b => b.textContent?.includes('Attach'))!;

    expect(button().textContent?.trim()).toBe('Attach as TV trailer/clip');
    expect(button().disabled).toBe(true);

    component.showQuery.setValue('Synthetic Show');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(button().disabled).toBe(false);
  });

  it('warns that unsaved editor changes are discarded when there are some', async () => {
    await create({ hasUnsavedChanges: true });

    expect(fixture.nativeElement.querySelector('.unsaved')?.textContent).toContain('unsaved changes');
  });

  it('warns the curator that TV show trailers are only visible to curators for now', async () => {
    await create();

    expect(fixture.nativeElement.querySelector('.curator-only')?.textContent).toContain('only shown to curators');
  });

  describe('messages', () => {
    it.each([
      [400, undefined, 'The episode cannot be attached as a TV trailer/clip.'],
      [404, undefined, 'The episode or TV show was not found. The episode may already be a trailer of a TV show.'],
      [409, undefined, 'This episode is already a trailer of another TV show, or is being attached right now. Try again shortly.'],
      [500, undefined, 'An error occurred attaching the TV trailer/clip. Sending again resumes an interrupted attach.'],
      [400, 'A removed TV show cannot take trailers', 'A removed TV show cannot take trailers']
    ])('attach error %s %s → %s', (status, error, expected) => {
      expect(attachTvShowTrailerErrorMessage(new HttpErrorResponse({ status, error: error ? { error } : null }))).toBe(expected);
    });

    it('snackbar says when the show was created', () => {
      expect(attachedAsTvShowTrailerMessage({ attached: true })).toBe('Attached as TV trailer/clip');
      expect(attachedAsTvShowTrailerMessage({ attached: true, showCreated: true }))
        .toBe('TV show created and episode attached as its trailer/clip.');
    });

    it('a failed show lookup that is not 404 or 409 says nothing was attached', () => {
      expect(resolveTvShowErrorMessage(new HttpErrorResponse({ status: 500 }))).toBe('The TV show could not be looked up. Nothing was attached.');
    });
  });
});
