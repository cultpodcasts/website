import { CatalogueParentKind } from './catalogue-parent-kind.enum';

export interface PodcastKindTransferRequest {
  targetKind: CatalogueParentKind;
}

export interface PodcastKindTransferResponse {
  parentId?: string;
  targetKind?: CatalogueParentKind;
  playableCount?: number;
  failureIndexingPlayables?: boolean;
}
