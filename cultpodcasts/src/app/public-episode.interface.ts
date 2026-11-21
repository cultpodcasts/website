import type { PublicEpisodeDto } from '@cultpodcasts/contracts';
import type { WithDates } from './contract-dates';

/**
 * Public episode read model (`GET /public/episode/:id`, used by the bookmarks page): the generated
 * `Api.Dtos.PublicEpisodeDto` (RedditPodcastPoster#1502) with `release` as the `Date` that {@link JsonDateInterceptor}
 * produces. Not the curator {@link ApiEpisode}: the public body has no curator fields (`displayTitle`, `urls`,
 * `images`, `podcastId`, ...), its `image` is already coalesced server-side, and it carries `imageRemoved` (RPP #1500).
 */
export type PublicEpisode = WithDates<PublicEpisodeDto, 'release'>;
