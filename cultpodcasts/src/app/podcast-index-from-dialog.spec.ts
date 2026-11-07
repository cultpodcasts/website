import { describe, expect, it, vi } from 'vitest';
import { IndexDialogComponent } from './index-dialog/index-dialog.component';
import { notifyPodcastIndexDialogResult, openPodcastIndexDialog } from './podcast-index-from-dialog';

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
});
