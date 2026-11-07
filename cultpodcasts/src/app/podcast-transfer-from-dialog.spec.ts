import { of } from 'rxjs';
import { CatalogueParentKind } from './catalogue-parent-kind.enum';
import { ConfirmComponent } from './confirm/confirm.component';
import { confirmAndTransferPodcastKind } from './podcast-transfer-from-dialog';
import { TransferPodcastKindSendComponent } from './transfer-podcast-kind-send/transfer-podcast-kind-send.component';

describe('confirmAndTransferPodcastKind', () => {
  const podcastId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  it('returns undefined when the curator cancels confirm', async () => {
    const open = vi.fn(() => ({ afterClosed: () => of({ result: false }) }));

    const result = await confirmAndTransferPodcastKind(
      { open } as never,
      podcastId,
      CatalogueParentKind.TvShow
    );

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(ConfirmComponent, expect.any(Object));
    expect(result).toBeUndefined();
  });

  it('opens send after confirm and returns transferred close payload', async () => {
    const submit = vi.fn();
    const open = vi.fn()
      .mockReturnValueOnce({ afterClosed: () => of({ result: true }) })
      .mockReturnValueOnce({
        componentInstance: { submit },
        afterClosed: () =>
          of({
            transferred: true,
            targetKind: CatalogueParentKind.NewsOrganisation,
            response: { failureIndexingPlayables: false }
          })
      });

    const result = await confirmAndTransferPodcastKind(
      { open } as never,
      podcastId,
      CatalogueParentKind.NewsOrganisation
    );

    expect(open).toHaveBeenNthCalledWith(2, TransferPodcastKindSendComponent, expect.any(Object));
    expect(submit).toHaveBeenCalledWith(podcastId, CatalogueParentKind.NewsOrganisation);
    expect(result).toEqual({
      transferred: true,
      targetKind: CatalogueParentKind.NewsOrganisation,
      response: { failureIndexingPlayables: false }
    });
  });
});
