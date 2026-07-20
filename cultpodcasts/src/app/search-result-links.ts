import { HomepageEpisode } from "./homepage-episode.interface";
import { SearchResult } from "./search-result.interface";

export type SearchDisplayEpisode = HomepageEpisode | SearchResult;

export function spotifyUrl(episode: SearchDisplayEpisode): URL | undefined {
  if (isHomepageEpisode(episode)) {
    return toUrl(episode.spotify);
  }
  return episode.spotifyId
    ? toUrl(`https://open.spotify.com/episode/${encodeURIComponent(episode.spotifyId)}`)
    : undefined;
}

export function youtubeUrl(episode: SearchDisplayEpisode): URL | undefined {
  if (isHomepageEpisode(episode)) {
    return toUrl(episode.youtube);
  }
  return episode.youtubeId
    ? toUrl(`https://www.youtube.com/watch?v=${encodeURIComponent(episode.youtubeId)}`)
    : undefined;
}

export function appleUrl(episode: SearchDisplayEpisode): URL | undefined {
  if (isHomepageEpisode(episode)) {
    return toUrl(episode.apple);
  }
  return episode.appleId && episode.podcastAppleId
    ? toUrl(`https://podcasts.apple.com/podcast/id${encodeURIComponent(episode.podcastAppleId)}?i=${encodeURIComponent(episode.appleId)}`)
    : undefined;
}

export function episodeImageUrl(episode: SearchDisplayEpisode): URL | undefined {
  // A YouTube image-variant is only ever set when the episode's YouTube image is a
  // standard i.ytimg.com thumbnail, which the index encodes compactly (nulling `image`).
  // Prefer that reconstructed thumbnail: it matches the backend's YouTube-first image
  // priority and is robust to a stale `image` value that the incremental search indexer
  // cannot clear once a YouTube image is merged onto an existing episode.
  const youtubeThumbnail = youtubeThumbnailUrl(episode);
  if (youtubeThumbnail) {
    return youtubeThumbnail;
  }
  return toUrl(episode.image);
}

function youtubeThumbnailUrl(episode: SearchDisplayEpisode): URL | undefined {
  if (isHomepageEpisode(episode) || !episode.youtubeId || !episode.youtubeImageVariant) {
    return undefined;
  }

  const variant = {
    maxres: "maxresdefault",
    sd: "sddefault",
    hq: "hqdefault"
  }[episode.youtubeImageVariant];
  return toUrl(`https://i.ytimg.com/vi/${encodeURIComponent(episode.youtubeId)}/${variant}.jpg`);
}

export function toUrl(value: URL | string | undefined): URL | undefined {
  if (!value) {
    return undefined;
  }
  if (value instanceof URL) {
    return value;
  }
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function isHomepageEpisode(episode: SearchDisplayEpisode): episode is HomepageEpisode {
  return "spotify" in episode || "apple" in episode || "youtube" in episode;
}
