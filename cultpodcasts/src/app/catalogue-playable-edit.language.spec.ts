import { of } from 'rxjs';
import { CataloguePlayableKind } from './catalogue-playable-kind.enum';
import { openCataloguePlayableEditDialog } from './catalogue-playable-edit';

describe('openCataloguePlayableEditDialog default language highlight', () => {
  it('passes the highlight into the film dialog only when a default language was set', () => {
    const open = vi.fn().mockReturnValue({ afterClosed: () => of(undefined) });
    const dialog = { open } as never;

    openCataloguePlayableEditDialog(dialog, CataloguePlayableKind.Film, 'film-1', true);
    openCataloguePlayableEditDialog(dialog, CataloguePlayableKind.TvShowEpisode, 'ep-1', false);
    openCataloguePlayableEditDialog(dialog, CataloguePlayableKind.NewsReport, 'report-1');

    expect(open.mock.calls[0][1].data.highlightDefaultLanguage).toBe(true);
    expect(open.mock.calls[1][1].data.highlightDefaultLanguage).toBe(false);
    expect(open.mock.calls[2][1].data.highlightDefaultLanguage).toBe(false);
  });
});
