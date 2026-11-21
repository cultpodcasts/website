import { PublicEpisode } from './public-episode.interface';
import { HomepageEpisode } from './homepage-episode.interface';
import { toUrl } from './search-result-links';

/**
 * Map a public API episode (`GET /public/episode/:id`) into the shared poster / player display shape.
 * The server already coalesces `image` across services and nulls it when a curator removed it (RPP #1500);
 * `imageRemoved` stops any YouTube thumbnail fallback further down the display path.
 */
export function publicEpisodeToHomepageEpisode(episode: PublicEpisode): HomepageEpisode {
  return {
    id: episode.id,
    podcastName: episode.podcastName,
    episodeTitle: episode.title,
    episodeDescription: episode.description,
    release: episode.release,
    duration: episode.duration,
    ids: episode.ids ?? undefined,
    services: episode.services && Object.keys(episode.services).length > 0 ? { ...episode.services } : undefined,
    subjects: episode.subjects,
    image: episode.imageRemoved === true ? undefined : toUrl(episode.image),
    ...(episode.imageRemoved === true ? { imageRemoved: true } : {}),
  };
}
