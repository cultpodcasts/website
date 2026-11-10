import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  catalogueParentEditLabel,
  catalogueParentEditTarget,
  openCatalogueParentEditDialog,
} from './catalogue-parent-edit-dialog';
import { EditCatalogueParentDialogComponent } from './edit-catalogue-parent-dialog/edit-catalogue-parent-dialog.component';

describe('catalogueParentEditTarget', () => {
  it('targets the news hub with the parent name for a news report', () => {
    expect(catalogueParentEditTarget({ contentKind: 'NewsReport', parentName: 'Synthetic Desk', podcastName: 'Old' }))
      .toEqual({ hub: 'news', name: 'Synthetic Desk' });
  });

  it('targets the tv hub, falling back to the legacy podcastName, for a TV episode', () => {
    expect(catalogueParentEditTarget({ contentKind: 'TvShowEpisode', parentName: null, podcastName: 'Synthetic Show' }))
      .toEqual({ hub: 'tv', name: 'Synthetic Show' });
  });

  it('has no target for a podcast episode, a film, or a playable with no parent name', () => {
    expect(catalogueParentEditTarget({ contentKind: 'Episode', podcastName: 'Synthetic Podcast' })).toBeNull();
    expect(catalogueParentEditTarget({ contentKind: 'Film', podcastName: 'Synthetic Film' })).toBeNull();
    expect(catalogueParentEditTarget({ contentKind: 'NewsReport', parentName: '  ', podcastName: undefined })).toBeNull();
  });
});

describe('catalogueParentEditLabel', () => {
  it('uses the hub parent labels', () => {
    expect(catalogueParentEditLabel('news')).toBe('Edit News Outlet');
    expect(catalogueParentEditLabel('tv')).toBe('Edit TV Show');
  });
});

describe('openCatalogueParentEditDialog', () => {
  function setup(result: unknown) {
    const open = vi.fn(() => ({ afterClosed: () => of(result) }));
    const snack = vi.fn();
    const dialog = { open } as unknown as MatDialog;
    const snackBar = { open: snack } as unknown as MatSnackBar;
    return { open, snack, dialog, snackBar };
  }

  it('opens the parent editor with the target and reports an update with the hub label', () => {
    const { open, snack, dialog, snackBar } = setup({ updated: true });
    openCatalogueParentEditDialog(dialog, snackBar, { hub: 'news', name: 'Synthetic Desk' }).subscribe();
    expect(open).toHaveBeenCalledWith(EditCatalogueParentDialogComponent, expect.objectContaining({
      data: { hub: 'news', name: 'Synthetic Desk' },
    }));
    expect(snack).toHaveBeenCalledWith('News Outlet updated', 'Ok', { duration: 3000 });
  });

  it('reports no change, and stays quiet when the dialog is closed', () => {
    const noChange = setup({ noChange: true });
    openCatalogueParentEditDialog(noChange.dialog, noChange.snackBar, { hub: 'tv', name: 'Synthetic Show' }).subscribe();
    expect(noChange.snack).toHaveBeenCalledWith('No change', 'Ok', { duration: 3000 });

    const closed = setup({ closed: true });
    openCatalogueParentEditDialog(closed.dialog, closed.snackBar, { hub: 'tv', name: 'Synthetic Show' }).subscribe();
    expect(closed.snack).not.toHaveBeenCalled();
  });
});
