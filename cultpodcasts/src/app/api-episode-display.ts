import { ApiEpisode } from './api-episode.interface';
import { HomepageEpisode } from './homepage-episode.interface';
import { toUrl } from './search-result-links';

/** Map a public API episode into the shared poster / player display shape. */
export function apiEpisodeToHomepageEpisode(episode: ApiEpisode): HomepageEpisode {
  return {
    id: episode.id,
    podcastName: episode.podcastName ?? '',
    episodeTitle: episode.displayTitle ?? episode.title,
    episodeDescription: episode.displayDescription ?? episode.description,
    release: episode.release,
    duration: episode.duration,
    spotify: toUrl(episode.urls?.spotify),
    apple: toUrl(episode.urls?.apple),
    youtube: toUrl(episode.urls?.youtube),
    bbc: toUrl(episode.urls?.bbc),
    internetArchive: toUrl(episode.urls?.internetArchive),
    subjects: episode.subjects,
    image: episode.image
      ?? toUrl(episode.images?.youtube ?? undefined)
      ?? toUrl(episode.images?.spotify ?? undefined)
      ?? toUrl(episode.images?.apple ?? undefined)
      ?? toUrl(episode.images?.other ?? undefined),
    language: episode.lang ?? undefined,
  };
}
