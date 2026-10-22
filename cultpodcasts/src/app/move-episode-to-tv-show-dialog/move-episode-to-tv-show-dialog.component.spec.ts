import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { CurationSubmitService } from '../curation-submit.service';
import { MoveEpisodeToTvShowDialogData } from '../episode-tv-show-move.interface';
import { Suggestion } from '../search-suggestions.interface';
import { SearchSuggestionsService } from '../search-suggestions.service';
import {
  MoveEpisodeToTvShowDialogComponent,
  defaultPublisher,
  moveToTvShowErrorMessage
} from './move-episode-to-tv-show-dialog.component';

const showId = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d';
const show: Suggestion = { type: 'tvShow', value: 'Synthetic Show', label: 'Synthetic Show' };

describe('MoveEpisodeToTvShowDialogComponent', () => {
  let fixture: ComponentFixture<MoveEpisodeToTvShowDialogComponent>;
  let component: MoveEpisodeToTvShowDialogComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let postEpisodeToTvShow: ReturnType<typeof vi.fn>;
  let suggest: ReturnType<typeof vi.fn>;

  async function create(data: Partial<MoveEpisodeToTvShowDialogData> = {}) {
    dialogRef = { close: vi.fn() };
    postEpisodeToTvShow = vi.fn();
    suggest = vi.fn(async () => [show, { ...show, label: 'Synthetic Show (alias)' }]);
    await TestBed.configureTestingModule({
      imports: [MoveEpisodeToTvShowDialogComponent],
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
        { provide: CurationSubmitService, useValue: { postEpisodeToTvShow } },
        { provide: SearchSuggestionsService, useValue: { preload: vi.fn(), suggest } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MoveEpisodeToTvShowDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('suggests TV shows only, by name once, and needs a show before moving', async () => {
    await create();

    await component.onShowQuery('Synth');

    expect(suggest).toHaveBeenCalledWith('Synth', 10, 'tvShow');
    expect(component.shows()).toEqual(['Synthetic Show']);
    expect(component.request()).toBeNull();
    component.move();
    expect(postEpisodeToTvShow).not.toHaveBeenCalled();
  });

  it('sends a picked show by name with no title when the title is unchanged, then closes with the TV episode', async () => {
    await create();
    postEpisodeToTvShow.mockReturnValue(of({
      status: 202, body: { tvShowId: showId, tvShowName: 'Synthetic Show', episodeId: 'episode-1', createdShow: false }
    }));
    component.showQuery.setValue('Synthetic Show');

    component.move();

    expect(postEpisodeToTvShow).toHaveBeenCalledWith('podcast-1', 'episode-1', { tvShowName: 'Synthetic Show' });
    expect(dialogRef.close).toHaveBeenCalledWith({
      moved: true, tvShowId: showId, tvShowName: 'Synthetic Show', episodeId: 'episode-1', createdShow: false
    });
  });

  it('sends a pasted show id (lowercased, without createShow or publisher) and a trimmed override title', async () => {
    await create();
    postEpisodeToTvShow.mockReturnValue(of({ status: 202, body: { tvShowId: showId, tvShowName: 'Synthetic Show' } }));
    component.createShow.setValue(true);
    await component.onShowQuery(` ${showId.toUpperCase()} `);
    component.showQuery.setValue(` ${showId.toUpperCase()} `);
    component.title.setValue('  Synthetic Override  ');

    component.move();

    expect(suggest).not.toHaveBeenCalled();
    expect(postEpisodeToTvShow).toHaveBeenCalledWith('podcast-1', 'episode-1', { tvShowId: showId, title: 'Synthetic Override' });
  });

  it('creates a new show with createShow and the trimmed publisher only when ticked', async () => {
    await create();
    postEpisodeToTvShow.mockReturnValue(of({
      status: 202, body: { tvShowId: showId, tvShowName: 'New Synthetic Show', episodeId: 'episode-1', createdShow: true }
    }));
    component.showQuery.setValue('  New Synthetic Show ');
    component.publisher.setValue(' Synthetic Publisher ');
    expect(component.request()).toEqual({ tvShowName: 'New Synthetic Show' });

    component.createShow.setValue(true);
    component.move();

    expect(postEpisodeToTvShow).toHaveBeenCalledWith('podcast-1', 'episode-1', {
      tvShowName: 'New Synthetic Show', createShow: true, publisher: 'Synthetic Publisher'
    });
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ moved: true, createdShow: true }));
  });

  it.each(['BBC', 'bbc three'])('defaults a new show publisher to BBC for the %s podcast', async podcastName => {
    await create({ podcastName });

    expect(component.publisher.value).toBe('BBC');
  });

  it('rejects a show name with "/" without sending', async () => {
    await create();
    component.showQuery.setValue('Synthetic/Show');

    component.move();

    expect(component.hasInvalidName()).toBe(true);
    expect(component.request()).toBeNull();
    expect(postEpisodeToTvShow).not.toHaveBeenCalled();
  });

  it('warns about a recent release and unsaved changes', async () => {
    await create({ release: new Date().toISOString(), hasUnsavedChanges: true });

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.recent')).not.toBeNull();
    expect(element.querySelector('.unsaved')).not.toBeNull();
  });

  it('shows the server error and stays open when the move fails', async () => {
    await create();
    postEpisodeToTvShow.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { error: 'Several TV shows have this name' }
    })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    component.showQuery.setValue('Synthetic Show');

    component.move();

    expect(component.error()).toBe('Several TV shows have this name');
    expect(component.isSending()).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('Cancel closes moved:false without sending', async () => {
    await create();

    component.cancel();

    expect(postEpisodeToTvShow).not.toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith({ moved: false });
  });
});

describe('defaultPublisher', () => {
  it('is blank for other podcasts', () => {
    expect(defaultPublisher('Synthetic Podcast')).toBe('');
    expect(defaultPublisher(null)).toBe('');
  });
});

describe('moveToTvShowErrorMessage', () => {
  it('explains a 500 as resumable and a 404 without a body as create-able', () => {
    expect(moveToTvShowErrorMessage(new HttpErrorResponse({ status: 500 }))).toContain('resumes');
    expect(moveToTvShowErrorMessage(new HttpErrorResponse({ status: 404 }))).toContain('Create a new TV show');
  });
});
