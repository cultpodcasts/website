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
  // Homepage episodes come from a feed that always carries full image URLs.
  if (isHomepageEpisode(episode)) {
    return toUrl(episode.image);
  }

  const expanded = expandImage(episode.image, episode.youtubeId);
  if (expanded) {
    return expanded;
  }

  // Legacy fallback: documents indexed before the loss-less compaction scheme carry the coarse
  // youtubeImageVariant (maxres/sd/hq) with an empty image. Expand it until they re-merge.
  if (!episode.youtubeId || !episode.youtubeImageVariant) {
    return undefined;
  }
  const variant = {
    maxres: "maxresdefault",
    sd: "sddefault",
    hq: "hqdefault"
  }[episode.youtubeImageVariant];
  return toUrl(`https://i.ytimg.com/vi/${encodeURIComponent(episode.youtubeId)}/${variant}.jpg`);
}

const youtubeQualityByCode: Record<string, string> = {
  x: "maxresdefault",
  s: "sddefault",
  h: "hqdefault",
  m: "mqdefault",
  d: "default"
};

// Loss-less inverse of the search index's image compaction (RPP `SearchEpisodeImage`). `image` holds
// either a full URL (used as-is) or a short token whose first character is the platform sigil:
//   y{q}       -> https://i.ytimg.com/vi/{youtubeId}/{quality}.jpg   (x/s/h/m/d)
//   s{id}      -> https://i.scdn.co/image/{id}
//   a{n}{path} -> https://is{n}-ssl.mzstatic.com/image/thumb/{path}
// The exact URL that was selected/probed at index time is reconstructed byte-for-byte; there is no
// maxres->hqdefault guessing.
export function expandImage(image: URL | string | undefined, youtubeId: string | undefined): URL | undefined {
  if (!image) {
    return undefined;
  }
  const value = image instanceof URL ? image.toString() : image;
  if (value.startsWith("http")) {
    return toUrl(value);
  }

  const payload = value.slice(1);
  switch (value[0]) {
    case "y": {
      const quality = youtubeQualityByCode[payload];
      return quality && youtubeId
        ? toUrl(`https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/${quality}.jpg`)
        : undefined;
    }
    case "s":
      return payload ? toUrl(`https://i.scdn.co/image/${payload}`) : undefined;
    case "a":
      return payload
        ? toUrl(`https://is${payload[0]}-ssl.mzstatic.com/image/thumb/${payload.slice(1)}`)
        : undefined;
    default:
      return undefined;
  }
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
