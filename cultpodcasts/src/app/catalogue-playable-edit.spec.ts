import { of, Subject } from 'rxjs';
import { CataloguePlayableKind } from './catalogue-playable-kind.enum';
import {
  cataloguePlayableReviewListCommands,
  editCataloguePlayableFromPage,
  navigateToCataloguePlayableReviewList,
} from './catalogue-playable-edit';

describe('catalogue playable review list navigation', () => {
  const playableId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  it('builds the same /episodes route shape as a podcast Review snack', () => {
    expect(cataloguePlayableReviewListCommands(playableId)).toEqual([
      '/episodes',
      JSON.stringify([playableId]),
    ]);
  });

  it('navigates the router to that review list', async () => {
    const navigate = vi.fn().mockResolvedValue(true);
    await navigateToCataloguePlayableReviewList({ navigate }, playableId);
    expect(navigate).toHaveBeenCalledWith(cataloguePlayableReviewListCommands(playableId));
  });

  it('editCataloguePlayableFromPage offers Review and opens the review list', () => {
    const snackAction = new Subject<void>();
    const open = vi.fn().mockReturnValue({ afterClosed: () => of({ updated: true }) });
    const snackOpen = vi.fn().mockReturnValue({ onAction: () => snackAction });
    const navigate = vi.fn().mockResolvedValue(true);

    editCataloguePlayableFromPage(
      { open } as never,
      { open: snackOpen },
      { navigate },
      CataloguePlayableKind.Film,
      playableId
    );

    expect(snackOpen).toHaveBeenCalledWith('Film updated', 'Review', { duration: 10000 });
    snackAction.next();
    expect(navigate).toHaveBeenCalledWith(cataloguePlayableReviewListCommands(playableId));
  });
});
