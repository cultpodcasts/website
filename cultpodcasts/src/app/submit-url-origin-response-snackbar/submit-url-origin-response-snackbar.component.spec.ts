import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MAT_SNACK_BAR_DATA, MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { CataloguePlayableParentService } from '../catalogue-playable-parent.service';
import { GuidService } from '../guid.service';
import { EditFilmDialogComponent } from '../edit-film-dialog/edit-film-dialog.component';
import { EditNewsReportDialogComponent } from '../edit-news-report-dialog/edit-news-report-dialog.component';
import { EditTvShowEpisodeDialogComponent } from '../edit-tv-show-episode-dialog/edit-tv-show-episode-dialog.component';
import { SubmitUrlOriginSuccessResponse } from '../submit-url-origin-success-response.interface';
import { SubmitUrlOriginResponseSnackbarComponent, SubmitUrlOriginResponseSnackbarData } from './submit-url-origin-response-snackbar.component';

const playableId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const guids = new GuidService();
const newsShort = guids.toCatalogueShortId(playableId, 'NewsReport');
const tvShort = guids.toCatalogueShortId(playableId, 'TvShowEpisode');
const filmShort = guids.toCatalogueShortId(playableId, 'Film');

describe('SubmitUrlOriginResponseSnackbarComponent', () => {
  let action: Subject<void>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.fn>;
  let parentName: ReturnType<typeof vi.fn>;
  let dialogResult: unknown;
  let snackAction: Subject<void>;

  async function create(data: SubmitUrlOriginResponseSnackbarData) {
    action = new Subject<void>();
    snackAction = new Subject<void>();
    dialogResult = { updated: true, parentName: 'Desk' };
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(dialogResult) }));
    snackOpen = vi.fn(() => ({ onAction: () => snackAction }));
    parentName = vi.fn(async () => 'Looked Up');
    await TestBed.configureTestingModule({
      imports: [SubmitUrlOriginResponseSnackbarComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: MAT_SNACK_BAR_DATA, useValue: data },
        { provide: MatSnackBarRef, useValue: { onAction: () => action, dismiss: vi.fn(), dismissWithAction: () => action.next() } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
        { provide: CataloguePlayableParentService, useValue: { parentName } }
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

  it('shows Review + Edit for a Curator news submit from the hub, and Review goes to /news/{outlet}/{short id} without a lookup', async () => {
    const { component, navigate, element } = await create({
      existingPodcast: true, response: response('NewsReport'), roles: ['Curator'], parentName: 'Desk'
    });
    expect(element.textContent).toContain('News created.');
    expect(buttons(element)).toEqual(['Review', 'Edit']);
    await component.review();
    expect(parentName).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/news', 'Desk', newsShort]);
  });

  it('resolves the parent name for a toolbar TV submit before navigating', async () => {
    const { component, navigate } = await create({
      existingPodcast: false, response: response('TvShowEpisode', 'EpisodeAlreadyExists'), roles: ['Curator']
    });
    await component.review();
    expect(parentName).toHaveBeenCalledWith('TvShowEpisode', playableId);
    expect(navigate).toHaveBeenCalledWith(['/tv', 'Looked Up', tvShort]);
  });

  it('says so instead of navigating when the parent cannot be found', async () => {
    const { component, navigate } = await create({
      existingPodcast: false, response: response('NewsReport'), roles: ['Curator']
    });
    parentName.mockResolvedValue(null);
    await component.review();
    expect(navigate).not.toHaveBeenCalled();
    expect(snackOpen).toHaveBeenCalledWith('Could not find the page for this item', 'Ok', expect.anything());
  });

  it('Edit opens the news report dialog, then offers Review on the report page', async () => {
    const { component, navigate } = await create({
      existingPodcast: false, response: response('NewsReport', 'Enriched'), roles: ['Curator']
    });
    component.action();
    expect(dialogOpen).toHaveBeenCalledWith(EditNewsReportDialogComponent, expect.objectContaining({ data: { reportId: playableId } }));
    expect(snackOpen).toHaveBeenCalledWith('News report updated', 'Review', expect.anything());
    snackAction.next();
    await Promise.resolve();
    await Promise.resolve();
    expect(parentName).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/news', 'Desk', newsShort]);
  });

  it('Edit opens the TV episode dialog for a TV submit', async () => {
    const { component } = await create({
      existingPodcast: true, response: response('TvShowEpisode'), roles: ['Curator'], parentName: 'Nightly'
    });
    component.action();
    expect(dialogOpen).toHaveBeenCalledWith(EditTvShowEpisodeDialogComponent, expect.objectContaining({ data: { episodeId: playableId } }));
  });

  it('shows Review + Edit for a Curator film submit; Review goes to /film/{name}/{Film short id}, never the GUID', async () => {
    const { component, navigate, element } = await create({
      existingPodcast: false, response: response('Film'), roles: ['Curator']
    });
    parentName.mockResolvedValue('One Off');
    expect(buttons(element)).toEqual(['Review', 'Edit']);
    await component.review();
    expect(parentName).toHaveBeenCalledWith('Film', playableId);
    expect(navigate).toHaveBeenCalledWith(['/film', 'One Off', filmShort]);
    expect(navigate.mock.calls[0][0]).not.toContain(playableId);
  });

  it('a film Review ignores a hub parent name (the slug is the film name)', async () => {
    const { component, navigate } = await create({
      existingPodcast: true, response: response('Film'), roles: ['Curator'], parentName: 'Desk'
    });
    parentName.mockResolvedValue('One Off');
    await component.review();
    expect(navigate).toHaveBeenCalledWith(['/film', 'One Off', filmShort]);
  });

  it('Edit opens the film dialog, then offers Review on the film page using the dialog film name', async () => {
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
    expect(parentName).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/film', 'One Off', filmShort]);
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
});
