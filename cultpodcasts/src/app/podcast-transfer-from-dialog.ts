import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { CatalogueParentKind } from './catalogue-parent-kind.enum';
import { ConfirmComponent } from './confirm/confirm.component';
import { EditPodcastDialogResponse } from './edit-podcast-dialog-response.interface';
import { TransferPodcastKindSendClose } from './transfer-podcast-kind-send-close.interface';
import { TransferPodcastKindSendComponent } from './transfer-podcast-kind-send/transfer-podcast-kind-send.component';

/** Confirm + send transfer choreography shared by Add and Edit Podcast dialogs. */
export async function confirmAndTransferPodcastKind(
  dialog: MatDialog,
  podcastId: string,
  targetKind: CatalogueParentKind
): Promise<EditPodcastDialogResponse | undefined> {
  const isTvShow = targetKind === CatalogueParentKind.TvShow;
  const title = isTvShow ? 'Transfer to TV show' : 'Transfer to news organisation';
  const question = isTvShow
    ? 'Move this podcast and all of its episodes to a TV show? The podcast id becomes the TV show id. Episode ids stay the same.'
    : 'Move this podcast and all of its episodes to a news organisation? The podcast id becomes the news organisation id. Episode ids stay the same.';

  const confirmed = await firstValueFrom(dialog.open(ConfirmComponent, {
    data: { title, question },
    disableClose: true,
    autoFocus: true
  }).afterClosed());
  if (!confirmed?.result) {
    return undefined;
  }

  const sendRef = dialog.open(TransferPodcastKindSendComponent, { disableClose: true, autoFocus: true });
  sendRef.componentInstance.submit(podcastId, targetKind);
  const result = await firstValueFrom(sendRef.afterClosed()) as TransferPodcastKindSendClose | undefined;
  if (!result?.transferred) {
    return undefined;
  }

  return {
    transferred: true,
    targetKind: result.targetKind ?? targetKind,
    response: result.response ?? undefined
  };
}
