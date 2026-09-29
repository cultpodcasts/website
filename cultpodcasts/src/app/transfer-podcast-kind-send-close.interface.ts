import { CatalogueParentKind } from './catalogue-parent-kind.enum';
import { PodcastKindTransferResponse } from './podcast-kind-transfer-response.interface';

export interface TransferPodcastKindSendClose {
  transferred: boolean;
  targetKind?: CatalogueParentKind;
  parentId?: string;
  response?: PodcastKindTransferResponse | null;
}
