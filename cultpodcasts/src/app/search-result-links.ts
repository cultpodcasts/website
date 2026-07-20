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
  // The index compacts the two platforms whose cover URL is a fixed prefix + a single opaque
  // token, emptying `image` and storing only the token: a standard i.ytimg.com thumbnail becomes
  // `youtubeImageVariant`, and a standard i.scdn.co cover becomes `spotifyImageId`. Rebuild them
  // here in the backend's YouTube-first priority. This also stays robust to a stale `image` value
  // that the incremental search indexer cannot clear once such an image is merged onto an episode.
  const youtubeThumbnail = youtubeThumbnailUrl(episode);
  if (youtubeThumbnail) {
    return youtubeThumbnail;
  }
  const spotifyImage = spotifyImageUrl(episode);
  if (spotifyImage) {
    return spotifyImage;
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

function spotifyImageUrl(episode: SearchDisplayEpisode): URL | undefined {
  if (isHomepageEpisode(episode) || !episode.spotifyImageId) {
    return undefined;
  }
  return toUrl(`https://i.scdn.co/image/${encodeURIComponent(episode.spotifyImageId)}`);
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
