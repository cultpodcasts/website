import type { EpisodeDto } from '@cultpodcasts/contracts';
import type { WithDates } from './contract-dates';
import type { YouTubeAlternateDto } from './playable-edit.interface';

/**
 * RPP #1484: a curator's decision on an episode held for approval. Request model (`Api.Models`), not exported by
 * `@cultpodcasts/contracts` yet, so it stays hand-written.
 */
export type ApprovalDecision = 'Approve' | 'Reject';

/**
 * Curator episode read model (`GET /episode/:id`, `GET /episode/:podcastName/:episodeId`, `GET /episodes/outgoing`, `GET /episodes/awaiting-approval`):
 * the generated `Api.Dtos.EpisodeDto` (RedditPodcastPoster#1502) with `release` as the `Date` that
 * {@link JsonDateInterceptor} produces.
 */
export type ApiEpisode = WithDates<EpisodeDto, 'release'> & {
  /**
   * Extra YouTube uploads (RPP #1526). The generated `EpisodeDto` does not list this yet; the Azure GET returns it
   * and the editor reads it here until the contract package includes the field.
   */
  additionalYouTube?: YouTubeAlternateDto[] | null;
};
