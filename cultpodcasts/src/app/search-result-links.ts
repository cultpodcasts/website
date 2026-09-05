import { EpisodeIds } from "./episode-ids.interface";
import { HomepageEpisode } from "./homepage-episode.interface";
import { SearchResult } from "./search-result.interface";
import { BBCServiceResolver } from "./service-resolver";
import { expandSvc, SERVICE_CATALOG } from "./service-catalog";

/** Catalogue key type — keeps Watch special-cases aligned with SERVICE_CATALOG. */
type ServiceCatalogKey = (typeof SERVICE_CATALOG)[number]["key"];

/**
 * Non-embeddable video destinations (wideImage catalogue services).
 * YouTube embeds in-app; BBC Sounds is audio (wideImage: false) — Listen only.
 */
const EXTERNAL_WATCH_SERVICE_KEYS: ReadonlyArray<ServiceCatalogKey> = SERVICE_CATALOG
  .filter((d) => d.wideImage && d.key !== "youtube")
  .map((d) => d.key);

export type SearchDisplayEpisode = HomepageEpisode | SearchResult;

function serviceUrl(episode: SearchDisplayEpisode, key: string): URL | undefined {
  return toUrl(episode.services?.[key]?.url ?? undefined);
}

function platformIds(episode: SearchDisplayEpisode): EpisodeIds & { podcastAppleId?: string } {
  const nested = episode.ids ?? {};
  const search = episode as SearchResult;
  return {
    spotify: nested.spotify ?? search.spotifyId,
    apple: nested.apple ?? search.appleId,
    youtube: nested.youtube ?? search.youtubeId,
    podcastAppleId: search.podcastAppleId
  };
}

function leftoverNamedUrl(episode: SearchDisplayEpisode, key: "spotify" | "apple" | "youtube"): URL | undefined {
  const leftover = episode as HomepageEpisode;
  if (key === "spotify") {
    return toUrl(leftover.spotify);
  }
  if (key === "apple") {
    return toUrl(leftover.apple);
  }
  return toUrl(leftover.youtube);
}

export function spotifyUrl(episode: SearchDisplayEpisode): URL | undefined {
  const id = platformIds(episode).spotify;
  return serviceUrl(episode, "spotify")
    ?? leftoverNamedUrl(episode, "spotify")
    ?? (id ? toUrl(`https://open.spotify.com/episode/${encodeURIComponent(String(id))}`) : undefined);
}

export function youtubeUrl(episode: SearchDisplayEpisode): URL | undefined {
  const id = platformIds(episode).youtube;
  return serviceUrl(episode, "youtube")
    ?? leftoverNamedUrl(episode, "youtube")
    ?? (id ? toUrl(`https://www.youtube.com/watch?v=${encodeURIComponent(String(id))}`) : undefined);
}

export function appleUrl(episode: SearchDisplayEpisode): URL | undefined {
  const ids = platformIds(episode);
  const fromServices = serviceUrl(episode, "apple") ?? leftoverNamedUrl(episode, "apple");
  if (fromServices) {
    return fromServices;
  }
  return ids.apple && ids.podcastAppleId
    ? toUrl(`https://podcasts.apple.com/podcast/id${encodeURIComponent(String(ids.podcastAppleId))}?i=${encodeURIComponent(String(ids.apple))}`)
    : undefined;
}

function svcUrl(episode: SearchDisplayEpisode, key: string): URL | undefined {
  return expandSvc(episode.svc).find((item) => item.key === key)?.url;
}

function legacyBbcUrl(episode: SearchDisplayEpisode): URL | undefined {
  return toUrl((episode as SearchResult).bbc);
}

/** BBC iPlayer (video) page — not embeddable; used for outbound Watch CTAs. */
export function bbcIplayerUrl(episode: SearchDisplayEpisode): URL | undefined {
  const fromMap = serviceUrl(episode, "bbcIplayer") ?? svcUrl(episode, "bbcIplayer");
  if (fromMap) {
    return fromMap;
  }
  const bbc = legacyBbcUrl(episode);
  return bbc && BBCServiceResolver.isIplayer(bbc) ? bbc : undefined;
}

/** BBC Sounds (audio) page — not embeddable; used for outbound Listen CTAs. */
export function bbcSoundsUrl(episode: SearchDisplayEpisode): URL | undefined {
  const fromServices = serviceUrl(episode, "bbcSounds") ?? svcUrl(episode, "bbcSounds");
  if (fromServices) {
    return fromServices;
  }
  const bbc = legacyBbcUrl(episode);
  return bbc && BBCServiceResolver.isSounds(bbc) ? bbc : undefined;
}

export function internetArchiveUrl(episode: SearchDisplayEpisode): URL | undefined {
  return serviceUrl(episode, "internetArchive")
    ?? svcUrl(episode, "internetArchive")
    ?? toUrl((episode as SearchResult).internetArchive);
}

/**
 * Non-embeddable video destinations in catalogue order (iPlayer → Archive →
 * Vimeo / Netflix / ITVX / …). BBC Sounds is audio — see `externalListenUrl`.
 */
export function externalWatchUrl(episode: SearchDisplayEpisode): URL | undefined {
  for (const key of EXTERNAL_WATCH_SERVICE_KEYS) {
    const url =
      key === "bbcIplayer"
        ? bbcIplayerUrl(episode)
        : key === "internetArchive"
          ? internetArchiveUrl(episode)
          : serviceUrl(episode, key) ?? svcUrl(episode, key);
    if (url) {
      return url;
    }
  }
  return undefined;
}

/** Non-embeddable audio destinations (BBC Sounds). */
export function externalListenUrl(episode: SearchDisplayEpisode): URL | undefined {
  return bbcSoundsUrl(episode);
}

/** Outbound Watch or Listen destination when nothing embeds in-app. */
export function externalPlaybackUrl(episode: SearchDisplayEpisode): URL | undefined {
  return externalWatchUrl(episode) ?? externalListenUrl(episode);
}

export function episodeImageUrl(episode: SearchDisplayEpisode): URL | undefined {
  const ytId = String(platformIds(episode).youtube ?? "") || youtubeIdFromWatchUrl(youtubeUrl(episode));
  if (isHomepageEpisode(episode)) {
    const image = toUrl(episode.image);
    if (isYoutubeThumbnailUrl(image)) {
      return image;
    }
    return ytId ? youtubeThumbnailUrl(ytId) : image;
  }

  if (isYoutubeThumbnailUrl(episode.image)) {
    return expandImage(episode.image, ytId || undefined);
  }
  if (ytId) {
    return youtubeThumbnailUrl(ytId);
  }
  return expandImage(episode.image, ytId || undefined);
}

function youtubeThumbnailUrl(youtubeId: string): URL | undefined {
  return toUrl(`https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`);
}

function youtubeIdFromWatchUrl(url: URL | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id || undefined;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const v = url.searchParams.get('v');
    if (v) {
      return v;
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
      return parts[1] || undefined;
    }
  }
  return undefined;
}

const youtubeQualityByCode: Record<string, string> = {
  x: "maxresdefault",
  s: "sddefault",
  h: "hqdefault",
  m: "mqdefault",
  d: "default"
};

/** True when the displayed cover is a YouTube thumbnail (wide 16:9), not square podcast art. */
export function isYoutubeThumbnailUrl(image: URL | string | undefined): boolean {
  if (!image) {
    return false;
  }
  if (!(image instanceof URL)) {
    // Compact search-index token (y{q}) before expandImage.
    if (image.length >= 2 && image[0] === "y" && image[1] in youtubeQualityByCode) {
      return true;
    }
  }
  const url = toUrl(image);
  return !!url && url.hostname === "i.ytimg.com";
}

export type EpisodeArtAspect = "wide" | "square";

/**
 * Layout for cover art: YouTube thumbs → 16:9; external Watch destinations
 * (iPlayer / Archive / ITVX / …) → 16:9; else square.
 */
export function episodeArtAspect(episode: SearchDisplayEpisode): EpisodeArtAspect {
  if (isYoutubeThumbnailUrl(episodeImageUrl(episode))) {
    return "wide";
  }
  if (externalWatchUrl(episode)) {
    return "wide";
  }
  return "square";
}

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

export function toUrl(value: URL | string | undefined | null): URL | undefined {
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
  return !("spotifyId" in episode) && !("youtubeId" in episode);
}
