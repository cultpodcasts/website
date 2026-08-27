import { ApiEpisode } from './api-episode.interface';
import { HomepageEpisode } from './homepage-episode.interface';
import { EpisodeServiceMap } from './service-catalog';
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
    ids: episode.ids ?? {
      spotify: episode.spotifyId,
      apple: episode.appleId,
      youtube: episode.youTubeId
    },
    services: mergeApiServices(episode),
    subjects: episode.subjects,
    image: episode.image
      ?? toUrl(episode.images?.youtube ?? undefined)
      ?? toUrl(episode.images?.spotify ?? undefined)
      ?? toUrl(episode.images?.apple ?? undefined)
      ?? toUrl(episode.images?.other ?? undefined),
    language: episode.lang ?? undefined,
  };
}

function mergeApiServices(episode: ApiEpisode): EpisodeServiceMap | undefined {
  const services: EpisodeServiceMap = { ...(episode.services ?? {}) };
  const add = (key: string, value: URL | string | null | undefined) => {
    const url = toUrl(value ?? undefined);
    if (!url) {
      return;
    }
    services[key] = { ...services[key], url };
  };
  add('spotify', episode.urls?.spotify);
  add('apple', episode.urls?.apple);
  add('youtube', episode.urls?.youtube);
  if (episode.urls?.bbc) {
    const bbc = toUrl(episode.urls.bbc);
    if (bbc) {
      const path = bbc.pathname;
      add(path.startsWith('/iplayer/') ? 'bbcIplayer' : 'bbcSounds', bbc);
    }
  }
  add('internetArchive', episode.urls?.internetArchive);
  return Object.keys(services).length > 0 ? services : undefined;
}
