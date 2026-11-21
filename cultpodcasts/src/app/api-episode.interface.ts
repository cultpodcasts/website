import type { EpisodeDto } from '@cultpodcasts/contracts';
import type { WithDates } from './contract-dates';

/**
 * RPP #1484: a curator's decision on an episode held for approval. Request model (`Api.Models`), not exported by
 * `@cultpodcasts/contracts` yet, so it stays hand-written.
 */
export type ApprovalDecision = 'Approve' | 'Reject';

/**
 * Curator episode read model (`GET /episode/:id`, `GET /episode/:podcastName/:episodeId`, `GET /episodes/outgoing`):
 * the generated `Api.Dtos.EpisodeDto` (RedditPodcastPoster#1502) with `release` as the `Date` that
 * {@link JsonDateInterceptor} produces.
 */
export type ApiEpisode = WithDates<EpisodeDto, 'release'>;
