import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MAT_SNACK_BAR_DATA, MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AddEpisodeDialogComponent } from '../add-episode-dialog/add-episode-dialog.component';
import { AddPodcastDialogComponent } from '../add-podcast-dialog/add-podcast-dialog.component';
import { CatalogueParentKind } from '../catalogue-parent-kind.enum';
import { cataloguePlayableReviewListCommands } from '../catalogue-playable-edit';
import { EditFilmDialogComponent } from '../edit-film-dialog/edit-film-dialog.component';
import { EditNewsReportDialogComponent } from '../edit-news-report-dialog/edit-news-report-dialog.component';
import { EditTvShowEpisodeDialogComponent } from '../edit-tv-show-episode-dialog/edit-tv-show-episode-dialog.component';
import { SubmitUrlOriginSuccessResponse } from '../submit-url-origin-success-response.interface';
import { SubmitUrlOriginResponseSnackbarComponent, SubmitUrlOriginResponseSnackbarData } from './submit-url-origin-response-snackbar.component';

const playableId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('SubmitUrlOriginResponseSnackbarComponent', () => {
  let action: Subject<void>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.fn>;
  let dialogResult: unknown;
  let snackAction: Subject<void>;

  async function create(data: SubmitUrlOriginResponseSnackbarData) {
    action = new Subject<void>();
    snackAction = new Subject<void>();
    dialogResult = { updated: true, parentName: 'Desk' };
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(dialogResult) }));
    snackOpen = vi.fn(() => ({ onAction: () => snackAction }));
    await TestBed.configureTestingModule({
      imports: [SubmitUrlOriginResponseSnackbarComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: MAT_SNACK_BAR_DATA, useValue: data },
        { provide: MatSnackBarRef, useValue: { onAction: () => action, dismiss: vi.fn(), dismissWithAction: () => action.next() } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
      ]
    }).compileComponents();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SubmitUrlOriginResponseSnackbarComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, navigate, element: fixture.nativeElement as HTMLElement };
  }

  function response(contentKind: string, episode = 'Created'): SubmitUrlOriginSuccessResponse {
    return { episode, podcast: 'NotCreated', contentKind: contentKind as SubmitUrlOriginSuccessResponse['contentKind'], playableId };
  }

  function buttons(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('button')).map((b) => b.textContent?.trim() ?? '');
  }

  it('shows Review + Edit for a Curator news submit from the hub, and Review goes to /episodes for the playable id', async () => {
    const { component, navigate, element } = await create({
      existingPodcast: true, response: response('NewsReport'), roles: ['Curator'], parentName: 'Desk'
    });
    expect(element.textContent).toContain('News created.');
    expect(buttons(element)).toEqual(['Review', 'Edit']);
    await component.review();
    expect(navigate).toHaveBeenCalledWith(cataloguePlayableReviewListCommands(playableId));
  });

  it('Review for a toolbar TV submit goes to /episodes without a parent-name lookup', async () => {
    const { component, navigate } = await create({
      existingPodcast: false, response: response('TvShowEpisode', 'EpisodeAlreadyExists'), roles: ['Curator']
    });
    await component.review();
    expect(navigate).toHaveBeenCalledWith(cataloguePlayableReviewListCommands(playableId));
  });

  it('Edit opens the news report dialog, then offers Review on /episodes', async () => {
    const { component, navigate } = await create({
      existingPodcast: false, response: response('NewsReport', 'Enriched'), roles: ['Curator']
    });
    component.action();
    expect(dialogOpen).toHaveBeenCalledWith(EditNewsReportDialogComponent, expect.objectContaining({ data: { reportId: playableId } }));
    expect(snackOpen).toHaveBeenCalledWith('News report updated', 'Review', expect.anything());
    snackAction.next();
    await Promise.resolve();
    await Promise.resolve();
    expect(navigate).toHaveBeenCalledWith(cataloguePlayableReviewListCommands(playableId));
  });

  it('Edit opens the TV episode dialog for a TV submit', async () => {
    const { component } = await create({
      existingPodcast: true, response: response('TvShowEpisode'), roles: ['Curator'], parentName: 'Nightly'
    });
    component.action();
    expect(dialogOpen).toHaveBeenCalledWith(EditTvShowEpisodeDialogComponent, expect.objectContaining({ data: { episodeId: playableId } }));
  });

  it('shows Review + Edit for a Curator film submit; Review goes to /episodes for the film guid', async () => {
    const { component, navigate, element } = await create({
      existingPodcast: false, response: response('Film'), roles: ['Curator']
    });
    expect(buttons(element)).toEqual(['Review', 'Edit']);
    await component.review();
    expect(navigate).toHaveBeenCalledWith(cataloguePlayableReviewListCommands(playableId));
  });

  it('Edit opens the film dialog, then offers Review on /episodes', async () => {
    const { component, navigate } = await create({
      existingPodcast: false, response: response('Film', 'EpisodeAlreadyExists'), roles: ['Curator']
    });
    dialogResult = { updated: true, parentName: 'One Off' };
    component.action();
    expect(dialogOpen).toHaveBeenCalledWith(EditFilmDialogComponent, expect.objectContaining({ data: { filmId: playableId } }));
    expect(snackOpen).toHaveBeenCalledWith('Film updated', 'Review', expect.anything());
    snackAction.next();
    await Promise.resolve();
    await Promise.resolve();
    expect(navigate).toHaveBeenCalledWith(cataloguePlayableReviewListCommands(playableId));
  });

  it('keeps only Ok for Submitters and ignored outcomes', async () => {
    for (const data of [
      { existingPodcast: true, response: response('NewsReport'), roles: ['Submitter'] },
      { existingPodcast: true, response: response('Film'), roles: ['Submitter'] },
      { existingPodcast: true, response: response('TvShowEpisode', 'Ignored'), roles: ['Curator'] }
    ]) {
      TestBed.resetTestingModule();
      const { element, component } = await create(data);
      expect(buttons(element)).toEqual(['Ok']);
      component.action();
      expect(dialogOpen).not.toHaveBeenCalled();
    }
  });

  it('after Add Podcast transfer, navigates to the news hub instead of the episode Review snack', async () => {
    const podcastId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const episodeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const { component, navigate } = await create({
      existingPodcast: false,
      response: {
        episode: 'Created',
        podcast: 'Created',
        podcastId,
        episodeId
      },
      roles: ['Curator']
    });
    dialogOpen
      .mockReturnValueOnce({
        afterClosed: () =>
          of({
            isNewPodcast: true,
            podcastName: 'AP Archive Desk',
            podcastId,
            updated: true
          })
      })
      .mockReturnValueOnce({
        afterClosed: () =>
          of({
            transferred: true,
            targetKind: CatalogueParentKind.NewsOrganisation
          })
      });
    component.action();
    await Promise.resolve();
    await Promise.resolve();

    expect(dialogOpen.mock.calls[0][0]).toBe(AddEpisodeDialogComponent);
    expect(dialogOpen.mock.calls[1][0]).toBe(AddPodcastDialogComponent);
    expect(snackOpen).toHaveBeenCalledWith('Podcast transferred', 'Ok', { duration: 10000 });
    expect(navigate).toHaveBeenCalledWith(['/news', 'AP Archive Desk']);
  });
});
