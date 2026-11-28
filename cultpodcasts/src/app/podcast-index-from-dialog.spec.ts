import { Subject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { IndexBacklogConfirmDialogComponent } from './index-backlog-confirm-dialog/index-backlog-confirm-dialog.component';
import { IndexDialogComponent } from './index-dialog/index-dialog.component';
import {
  confirmAndIndexPodcastBacklog,
  notifyPodcastIndexDialogResult,
  openPodcastIndexDialog
} from './podcast-index-from-dialog';

describe('podcast-index-from-dialog', () => {
  it('openPodcastIndexDialog opens IndexDialog with podcast kind and name', () => {
    const open = vi.fn();
    openPodcastIndexDialog({ open } as never, 'Clothesline Desk');
    expect(open).toHaveBeenCalledWith(
      IndexDialogComponent,
      expect.objectContaining({
        disableClose: true,
        data: { kind: 'podcast', name: 'Clothesline Desk' }
      })
    );
  });

  it('openPodcastIndexDialog with backlog: true passes backlog on IndexDialogData', () => {
    const open = vi.fn();
    openPodcastIndexDialog({ open } as never, 'Clothesline Desk', { backlog: true });
    expect(open).toHaveBeenCalledWith(
      IndexDialogComponent,
      expect.objectContaining({
        data: { kind: 'podcast', name: 'Clothesline Desk', backlog: true }
      })
    );
  });

  it('notifyPodcastIndexDialogResult reports updated episode count', () => {
    const open = vi.fn();
    notifyPodcastIndexDialogResult(
      { open } as never,
      { updated: true, episodeIds: ['a/1', 'a/2'] }
    );
    expect(open).toHaveBeenCalledWith('Podcast Indexed. 2 episodes updated', 'Ok', { duration: 10000 });
  });

  it('notifyPodcastIndexDialogResult reports not indexable', () => {
    const open = vi.fn();
    notifyPodcastIndexDialogResult({ open } as never, { podcastNotAutoIndex: true });
    expect(open).toHaveBeenCalledWith('Podcast not indexable', 'Ok', { duration: 10000 });
  });

  it('notifyPodcastIndexDialogResult reports already running and timed out', () => {
    const open = vi.fn();
    notifyPodcastIndexDialogResult({ open } as never, { alreadyRunning: true });
    expect(open).toHaveBeenCalledWith(
      'Podcast indexing already running. Try again shortly.',
      'Ok',
      { duration: 10000 }
    );
    open.mockClear();
    notifyPodcastIndexDialogResult({ open } as never, { timedOut: true });
    expect(open).toHaveBeenCalledWith(
      'Podcast indexing ran out of time. Anything it saved will appear shortly; try again later.',
      'Ok',
      { duration: 10000 }
    );
  });

  it('notifyPodcastIndexDialogResult offers Review when updated episodes can be reviewed, and reviews those ids on action', () => {
    const action = new Subject<void>();
    const open = vi.fn(() => ({ onAction: () => action.asObservable() }));
    const onReview = vi.fn();
    notifyPodcastIndexDialogResult(
      { open } as never,
      { updated: true, episodeIds: ['a/1', 'a/2'] },
      onReview
    );
    expect(open).toHaveBeenCalledWith('Podcast Indexed. 2 episodes updated', 'Review', { duration: 10000 });
    expect(onReview).not.toHaveBeenCalled();
    action.next();
    expect(onReview).toHaveBeenCalledWith(['a/1', 'a/2']);
  });

  it('notifyPodcastIndexDialogResult keeps Ok when nothing was updated, even with a Review handler', () => {
    const open = vi.fn();
    const onReview = vi.fn();
    notifyPodcastIndexDialogResult({ open } as never, { updated: true, episodeIds: [] }, onReview);
    expect(open).toHaveBeenCalledWith('Podcast Indexed', 'Ok', { duration: 10000 });
  });
});

describe('confirmAndIndexPodcastBacklog', () => {
  function setup(confirm: boolean | undefined, indexResult?: unknown) {
    const action = new Subject<void>();
    const snackOpen = vi.fn(() => ({ onAction: () => action.asObservable() }));
    const dialogOpen = vi
      .fn()
      .mockReturnValueOnce({ afterClosed: () => of(confirm) })
      .mockReturnValueOnce({ afterClosed: () => of(indexResult) });
    const navigate = vi.fn();
    confirmAndIndexPodcastBacklog(
      { open: dialogOpen } as never,
      { open: snackOpen } as never,
      { navigate } as never,
      'Clothesline Desk'
    );
    return { action, snackOpen, dialogOpen, navigate };
  }

  it('shows the confirmation for the podcast first, and runs the backlog index only after Confirm', () => {
    const { dialogOpen } = setup(true, { updated: true, episodeIds: [] });

    expect(dialogOpen.mock.calls[0][0]).toBe(IndexBacklogConfirmDialogComponent);
    expect(dialogOpen.mock.calls[0][1].data).toEqual({ podcastName: 'Clothesline Desk' });
    expect(dialogOpen.mock.calls[1][0]).toBe(IndexDialogComponent);
    expect(dialogOpen.mock.calls[1][1].data).toEqual({ kind: 'podcast', name: 'Clothesline Desk', backlog: true });
  });

  it('does nothing when the confirmation is cancelled or dismissed', () => {
    for (const confirm of [false, undefined]) {
      const { dialogOpen, snackOpen, navigate } = setup(confirm);

      expect(dialogOpen).toHaveBeenCalledTimes(1);
      expect(snackOpen).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    }
  });

  it('offers Review after the index and opens the updated episodes in the review route', () => {
    const { action, snackOpen, navigate } = setup(true, { updated: true, episodeIds: ['p/e1', 'p/e2'] });

    expect(snackOpen).toHaveBeenCalledWith('Podcast Indexed. 2 episodes updated', 'Review', { duration: 10000 });
    action.next();
    expect(navigate).toHaveBeenCalledWith(['/episodes', JSON.stringify(['p/e1', 'p/e2'])]);
  });

  it('reports a timed-out index with Ok and does not open a review', () => {
    const { snackOpen, navigate } = setup(true, { timedOut: true });

    expect(snackOpen).toHaveBeenCalledWith(
      'Podcast indexing ran out of time. Anything it saved will appear shortly; try again later.',
      'Ok',
      { duration: 10000 }
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});