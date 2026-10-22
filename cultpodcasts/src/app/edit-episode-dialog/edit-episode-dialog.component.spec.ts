import { ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { ApiEpisode } from '../api-episode.interface';
import { FeatureSwitchService } from '../feature-switch-service';
import { filmPageCommands, tvShowEpisodePageCommands } from '../catalogue-links';
import { MoveEpisodeToFilmDialogComponent } from '../move-episode-to-film-dialog/move-episode-to-film-dialog.component';
import { AttachTrailerDialogComponent } from '../attach-trailer-dialog/attach-trailer-dialog.component';
import { MoveEpisodeToTvShowDialogComponent } from '../move-episode-to-tv-show-dialog/move-episode-to-tv-show-dialog.component';
import { EditEpisodeDialogComponent } from './edit-episode-dialog.component';

const podcastId = '3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const episodeId = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3921';
const showId = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d';
const filmId = '1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b';

/**
 * The editor side of the curator moves: what the editor does with each dialog's close result (close itself with
 * a marker the caller refreshes on, show a snackbar, open the new page by its short id). The dialogs' own request
 * and error handling is covered by their specs.
 */
describe('EditEpisodeDialogComponent curator moves', () => {
  const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  let component: EditEpisodeDialogComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let open: ReturnType<typeof vi.fn>;
  let snackBarOpen: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let closed: Subject<unknown>;

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (q: string) => ({ matches: false, media: q })
    });
    closed = new Subject<unknown>();
    dialogRef = { close: vi.fn() };
    open = vi.fn(() => ({ afterClosed: () => closed.asObservable() }));
    snackBarOpen = vi.fn();
    navigate = vi.fn();
    component = new EditEpisodeDialogComponent(
      {} as AuthServiceWrapper,
      {} as HttpClient,
      dialogRef as unknown as MatDialogRef<EditEpisodeDialogComponent, any>,
      { podcastIdentifier: 'Synthetic Podcast', episodeId },
      { open } as unknown as MatDialog,
      {} as FeatureSwitchService,
      {} as ChangeDetectorRef,
      { navigate } as unknown as Router,
      { open: snackBarOpen } as unknown as MatSnackBar);
    component.podcastId = podcastId;
    component.podcastName.set('Synthetic Podcast');
    component.originalEpisode = {
      title: 'Synthetic Episode Title',
      release: '2026-01-02T03:04:05Z'
    } as unknown as ApiEpisode;
  });

  afterEach(() => {
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    } else {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  function finish(result: unknown) {
    closed.next(result);
    closed.complete();
  }

  describe('moveToTvShow', () => {
    it('opens the move dialog with the episode and podcast, flagging unsaved changes as none', () => {
      component.moveToTvShow();

      expect(open).toHaveBeenCalledWith(MoveEpisodeToTvShowDialogComponent, expect.objectContaining({
        disableClose: true,
        data: {
          podcastId,
          podcastName: 'Synthetic Podcast',
          episodeId,
          episodeTitle: 'Synthetic Episode Title',
          release: '2026-01-02T03:04:05Z',
          hasUnsavedChanges: false
        }
      }));
    });

    it('on a move into an existing show closes with movedToTvShow, says so and opens the TV episode by the server name and short id', () => {
      component.moveToTvShow();
      finish({ moved: true, tvShowId: showId, tvShowName: 'Synthetic Show', episodeId, createdShow: false });

      expect(dialogRef.close).toHaveBeenCalledWith({ movedToTvShow: true, podcastId });
      expect(snackBarOpen).toHaveBeenCalledWith('Moved to TV show', 'Ok', { duration: 10000 });
      expect(navigate).toHaveBeenCalledWith(tvShowEpisodePageCommands('Synthetic Show', episodeId));
      expect(navigate.mock.calls[0][0][0]).toBe('/tv');
      // The kind-prefixed (t) short id, 23 url-safe chars, never the raw GUID.
      expect(navigate.mock.calls[0][0][2]).toMatch(/^[A-Za-z0-9_-]{23}$/);
    });

    it('on a move that created the show says "Moved to new TV show"', () => {
      component.moveToTvShow();
      finish({ moved: true, tvShowId: showId, tvShowName: 'Synthetic Show', episodeId, createdShow: true });

      expect(snackBarOpen).toHaveBeenCalledWith('Moved to new TV show', 'Ok', { duration: 10000 });
    });

    it('closes and says so but does not navigate when the response has no show name', () => {
      component.moveToTvShow();
      finish({ moved: true, tvShowId: showId, episodeId });

      expect(dialogRef.close).toHaveBeenCalledWith({ movedToTvShow: true, podcastId });
      expect(snackBarOpen).toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it.each([undefined, { moved: false }])('does nothing when the dialog is cancelled (%o)', result => {
      component.moveToTvShow();
      finish(result);

      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(snackBarOpen).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('does not open the dialog before the episode has loaded', () => {
      component.originalEpisode = undefined;

      component.moveToTvShow();

      expect(open).not.toHaveBeenCalled();
    });
  });

  describe('moveToFilm', () => {
    it('on a move closes with movedToFilm, says so and opens the film page by its short id', () => {
      component.moveToFilm();
      finish({ moved: true, filmId, name: 'Synthetic Film' });

      expect(open).toHaveBeenCalledWith(MoveEpisodeToFilmDialogComponent, expect.anything());
      expect(dialogRef.close).toHaveBeenCalledWith({ movedToFilm: true, podcastId });
      expect(snackBarOpen).toHaveBeenCalledWith('Moved to film', 'Ok', { duration: 10000 });
      expect(navigate).toHaveBeenCalledWith(filmPageCommands('Synthetic Film', filmId));
    });

    it.each([undefined, { moved: false }, { moved: true, filmId }])('does nothing without a moved film id and name (%o)', result => {
      component.moveToFilm();
      finish(result);

      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('attachAsTrailer', () => {
    it('on attach closes with attachedAsTrailer, says so and opens the film page', () => {
      component.attachAsTrailer();
      finish({ attached: true, filmId, name: 'Synthetic Film' });

      expect(open).toHaveBeenCalledWith(AttachTrailerDialogComponent, expect.anything());
      expect(dialogRef.close).toHaveBeenCalledWith({ attachedAsTrailer: true, podcastId });
      expect(snackBarOpen).toHaveBeenCalledWith('Attached as trailer', 'Ok', { duration: 10000 });
      expect(navigate).toHaveBeenCalledWith(filmPageCommands('Synthetic Film', filmId));
    });

    it('closes without navigating when the response has no film name', () => {
      component.attachAsTrailer();
      finish({ attached: true, filmId });

      expect(dialogRef.close).toHaveBeenCalledWith({ attachedAsTrailer: true, podcastId });
      expect(navigate).not.toHaveBeenCalled();
    });

    it('does nothing when the dialog is cancelled', () => {
      component.attachAsTrailer();
      finish({ attached: false });

      expect(dialogRef.close).not.toHaveBeenCalled();
      expect(snackBarOpen).not.toHaveBeenCalled();
    });
  });
});
