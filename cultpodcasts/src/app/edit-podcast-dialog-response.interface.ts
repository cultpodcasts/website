import { CatalogueParentKind } from './catalogue-parent-kind.enum';
import { PodcastKindTransferResponse } from './podcast-kind-transfer-response.interface';
import { PodcastPostResponse } from './podcast-post-response.interface';

export interface EditPodcastDialogResponse {
  closed?: boolean;
  noChange?: boolean;
  updated?: boolean;
  transferred?: boolean;
  targetKind?: CatalogueParentKind;
  response?: PodcastPostResponse | PodcastKindTransferResponse;
}

export function podcastPostUpdateFlags(
  response: PodcastPostResponse | PodcastKindTransferResponse | undefined
): PodcastPostResponse {
  if (!response) {
    return {};
  }
  return {
    failureIndexingEpisodes: 'failureIndexingEpisodes' in response
      ? response.failureIndexingEpisodes
      : undefined,
    failureDeletingFromIndex: 'failureDeletingFromIndex' in response
      ? response.failureDeletingFromIndex
      : undefined
  };
}
