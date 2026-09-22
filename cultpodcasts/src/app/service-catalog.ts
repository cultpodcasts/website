import { streamingServiceKeys, type StreamingServiceKey } from "./streaming-submit-contract";

export type EpisodeServiceLink = {
  url?: string | URL | null;
  image?: string | URL | null;
};

export type EpisodeServiceMap = Record<string, EpisodeServiceLink>;

export type ServiceDescriptor = {
  key: string;
  displayName: string;
  icon: string;
  wideImage: boolean;
};

export type EpisodeServiceItem = {
  key: string;
  url: URL;
  icon: string;
  displayName: string;
  usesAppleMark: boolean;
};

/** Always shown in curator URL editors (Spotify, Apple, YouTube). */
export const DEFAULT_UI_SERVICE_KEYS = ["spotify", "apple", "youtube"] as const;
export type DefaultUiServiceKey = (typeof DEFAULT_UI_SERVICE_KEYS)[number];

/**
 * Submit-retired streaming keys kept for display of historical episode links
 * (not in {@link streamingServiceKeys}; not submittable).
 */
export const retiredStreamingDisplayKeys = ["hulu"] as const;
export type RetiredStreamingDisplayKey = (typeof retiredStreamingDisplayKeys)[number];

/**
 * Wire keys the SPA knows by name: podcast trio + submit-eligible streaming + retired display.
 * Unknown-host slugs from {@link resolveServiceKey} stay plain `string`.
 */
export type KnownServiceKey = DefaultUiServiceKey | StreamingServiceKey | RetiredStreamingDisplayKey;

/** Catalog row — key is always a known podcast or streaming wire value. */
export type CatalogServiceDescriptor = ServiceDescriptor & { key: KnownServiceKey };

const DEFAULT_UI_SET = new Set<string>(DEFAULT_UI_SERVICE_KEYS);
const STREAMING_KEY_SET = new Set<string>(streamingServiceKeys);
const RETIRED_DISPLAY_SET = new Set<string>(retiredStreamingDisplayKeys);

export type { StreamingServiceKey };

export function isStreamingServiceKey(key: string): key is StreamingServiceKey {
  return STREAMING_KEY_SET.has(key);
}

export function isKnownServiceKey(key: string): key is KnownServiceKey {
  return DEFAULT_UI_SET.has(key) || STREAMING_KEY_SET.has(key) || RETIRED_DISPLAY_SET.has(key);
}

/** Mirrors RPP ServiceCatalog JSON keys, icon names, and display order. */
export const SERVICE_CATALOG: CatalogServiceDescriptor[] = [
  { key: "youtube", displayName: "YouTube", icon: "youtube", wideImage: true },
  { key: "spotify", displayName: "Spotify", icon: "spotify", wideImage: false },
  { key: "apple", displayName: "Apple Podcasts", icon: "apple", wideImage: false },
  { key: "bbcIplayer", displayName: "BBC iPlayer", icon: "bbc-iplayer", wideImage: true },
  { key: "bbcSounds", displayName: "BBC Sounds", icon: "bbc-sounds", wideImage: false },
  { key: "internetArchive", displayName: "Internet Archive", icon: "internet-archive", wideImage: true },
  { key: "vimeo", displayName: "Vimeo", icon: "vimeo", wideImage: true },
  { key: "netflix", displayName: "Netflix", icon: "netflix", wideImage: true },
  { key: "amazonPrime", displayName: "Amazon Prime Video", icon: "amazon-prime", wideImage: true },
  { key: "paramountPlus", displayName: "Paramount+", icon: "paramount-plus", wideImage: true },
  { key: "hboMax", displayName: "HBO Max", icon: "hbo-max", wideImage: true },
  { key: "playSuisse", displayName: "Play Suisse", icon: "play-suisse", wideImage: true },
  { key: "playRts", displayName: "Play RTS", icon: "play-rts", wideImage: true },
  { key: "tvnzPlus", displayName: "TVNZ+", icon: "tvnz-plus", wideImage: true },
  { key: "itvx", displayName: "ITVX", icon: "itvx", wideImage: true },
  { key: "channel4", displayName: "Channel 4", icon: "channel4", wideImage: true },
  { key: "fawesome", displayName: "Fawesome", icon: "fawesome", wideImage: true },
  { key: "disneyPlus", displayName: "Disney+", icon: "disney-plus", wideImage: true },
  { key: "bitchute", displayName: "BitChute", icon: "bitchute", wideImage: true },
  { key: "tubi", displayName: "Tubi", icon: "tubi", wideImage: true },
  { key: "discoveryPlus", displayName: "discovery+", icon: "discovery-plus", wideImage: true },
  { key: "franceTv", displayName: "France TV", icon: "france-tv", wideImage: true },
  { key: "arte", displayName: "ARTE", icon: "arte", wideImage: true },
  { key: "hulu", displayName: "Hulu", icon: "hulu", wideImage: true },
  { key: "peacock", displayName: "Peacock", icon: "peacock", wideImage: true },
  { key: "appleTvPlus", displayName: "Apple TV+", icon: "apple-tv-plus", wideImage: true },
  { key: "zdf", displayName: "ZDF", icon: "zdf", wideImage: true },
  { key: "ard", displayName: "ARD", icon: "ard", wideImage: true },
  { key: "canalPlus", displayName: "Canal+", icon: "canal-plus", wideImage: true }
];

const byKey = new Map<string, CatalogServiceDescriptor>(SERVICE_CATALOG.map((d) => [d.key, d]));

export function serviceDescriptor(key: string): ServiceDescriptor {
  return byKey.get(key) ?? {
    key,
    displayName: key,
    icon: "external-service",
    wideImage: false
  };
}

export function isDefaultUiService(key: string): boolean {
  return DEFAULT_UI_SET.has(key);
}

/**
 * Resolve a listen/watch URL to a catalog wire key when known; otherwise a host slug.
 */
export function resolveServiceKey(url: URL): KnownServiceKey | string | undefined {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname;
  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    return "youtube";
  }
  if (host === "open.spotify.com") {
    return "spotify";
  }
  if (host === "podcasts.apple.com") {
    return "apple";
  }
  if (host.endsWith("bbc.co.uk") || host.endsWith("bbc.com")) {
    if (path.startsWith("/sounds/")) {
      return "bbcSounds";
    }
    if (path.startsWith("/iplayer/") || path.startsWith("/news/av-embeds/")) {
      return "bbcIplayer";
    }
    return "bbcSounds";
  }
  if (host.endsWith("archive.org")) {
    return "internetArchive";
  }
  if (host.endsWith("vimeo.com")) {
    return "vimeo";
  }
  if (host.endsWith("netflix.com")) {
    return "netflix";
  }
  if (
    host.endsWith("primevideo.com") ||
    ((host === "amazon.com" || host.endsWith(".amazon.com") || host === "amazon.co.uk" || host.endsWith(".amazon.co.uk")) &&
      /\/gp\/video|prime-video/i.test(path))
  ) {
    return "amazonPrime";
  }
  if (host.endsWith("paramountplus.com")) {
    return "paramountPlus";
  }
  if (
    host === "max.com" ||
    host.endsWith(".max.com") ||
    host === "hbomax.com" ||
    host.endsWith(".hbomax.com")
  ) {
    return "hboMax";
  }
  if (host.endsWith("playsuisse.ch")) {
    return "playSuisse";
  }
  if (host === "rts.ch" || host.endsWith(".rts.ch")) {
    return "playRts";
  }
  if (host.endsWith("tvnz.co.nz")) {
    return "tvnzPlus";
  }
  if (host === "itv.com" || host.endsWith(".itv.com")) {
    return "itvx";
  }
  if (host.endsWith("channel4.com") || host.endsWith("all4.com")) {
    return "channel4";
  }
  if (host.endsWith("fawesome.tv")) {
    return "fawesome";
  }
  if (host.endsWith("disneyplus.com")) {
    return "disneyPlus";
  }
  if (host === "bitchute.com" || host.endsWith(".bitchute.com")) {
    return "bitchute";
  }
  if (host === "tubitv.com" || host.endsWith(".tubitv.com")) {
    return "tubi";
  }
  if (host.endsWith("discoveryplus.com")) {
    return "discoveryPlus";
  }
  if (host === "france.tv" || host.endsWith(".france.tv")) {
    return "franceTv";
  }
  if (host === "arte.tv" || host.endsWith(".arte.tv")) {
    return "arte";
  }
  if (host === "hulu.com" || host.endsWith(".hulu.com")) {
    return "hulu";
  }
  if (host === "peacocktv.com" || host.endsWith(".peacocktv.com")) {
    return "peacock";
  }
  if (host === "tv.apple.com") {
    return "appleTvPlus";
  }
  if (host === "zdf.de" || host.endsWith(".zdf.de")) {
    return "zdf";
  }
  if (host === "ardmediathek.de" || host.endsWith(".ardmediathek.de")) {
    return "ard";
  }
  if (host === "canalplus.com" || host.endsWith(".canalplus.com")) {
    return "canalPlus";
  }
  return host.replace(/[^a-z0-9]/g, "") || undefined;
}

export function serviceLabelForUrl(value: string | URL | null | undefined): string {
  const url = parseUrl(value);
  if (!url) {
    return "URL";
  }
  const key = resolveServiceKey(url);
  if (!key) {
    return "URL";
  }
  return serviceDescriptor(key).displayName;
}

const EXPAND: Partial<Record<StreamingServiceKey, (id: string) => string>> = {
  bbcSounds: (id) => `https://www.bbc.co.uk/sounds/play/${id}`,
  bbcIplayer: (id) => `https://www.bbc.co.uk/iplayer/episode/${id}`,
  internetArchive: (id) => `https://archive.org/details/${id}`,
  vimeo: (id) => `https://vimeo.com/${id}`,
  netflix: (id) => `https://www.netflix.com/title/${id}`,
  bitchute: (id) => `https://www.bitchute.com/video/${id}`,
  tubi: (id) => `https://tubitv.com/${id}`
};

/** Inverse of RPP SearchEpisodeServices compact `svc` field. */
export function expandSvc(svc: string | undefined | null): { key: string; url: URL }[] {
  if (!svc) {
    return [];
  }
  const out: { key: string; url: URL }[] = [];
  for (const entry of svc.split("|")) {
    const colon = entry.indexOf(":");
    if (colon <= 0 || colon === entry.length - 1) {
      continue;
    }
    const key = entry.slice(0, colon);
    let payload = entry.slice(colon + 1).replaceAll("%7C", "|").replaceAll("%25", "%");
    if (payload.startsWith("u") && payload.slice(1).startsWith("http")) {
      payload = payload.slice(1);
    }
    let href: string | undefined;
    if (payload.startsWith("http")) {
      href = payload;
    } else if (isStreamingServiceKey(key)) {
      href = EXPAND[key]?.(payload);
    }
    if (!href) {
      continue;
    }
    try {
      out.push({ key, url: new URL(href) });
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

export type ServiceLinkSource = {
  youtube?: URL;
  spotify?: URL;
  apple?: URL;
  bbc?: URL;
  internetArchive?: URL;
  ids?: { spotify?: string | null; apple?: number | string | null; youtube?: string | null };
  spotifyId?: string | null;
  appleId?: number | string | null;
  podcastAppleId?: string | null;
  youtubeId?: string | null;
  svc?: string | null;
  services?: EpisodeServiceMap;
};

function parseUrl(value: string | URL | null | undefined): URL | undefined {
  if (!value) {
    return undefined;
  }
  if (value instanceof URL) {
    return value;
  }
  try {
    return new URL(String(value).trim());
  } catch {
    return undefined;
  }
}

function toItem(key: string, url: URL): EpisodeServiceItem {
  const d = serviceDescriptor(key);
  return {
    key,
    url,
    icon: d.icon,
    displayName: d.displayName,
    usesAppleMark: key === "apple"
  };
}

/**
 * Every service that has a watch/listen URL, in catalog order (then unknown keys).
 * Spotify / Apple / YouTube are the same list as BBC, Archive, Vimeo, Netflix, …
 */
export function collectEpisodeServices(source: ServiceLinkSource): EpisodeServiceItem[] {
  const byService = new Map<string, URL>();
  const add = (key: string, url: URL | undefined) => {
    if (!url || byService.has(key)) {
      return;
    }
    byService.set(key, url);
  };

  add("youtube", source.youtube);
  add("spotify", source.spotify);
  add("apple", source.apple);
  const spotifyId = source.ids?.spotify ?? source.spotifyId;
  const youtubeId = source.ids?.youtube ?? source.youtubeId;
  const appleId = source.ids?.apple ?? source.appleId;
  if (spotifyId) {
    add("spotify", parseUrl(`https://open.spotify.com/episode/${encodeURIComponent(String(spotifyId))}`));
  }
  if (youtubeId) {
    add("youtube", parseUrl(`https://www.youtube.com/watch?v=${encodeURIComponent(String(youtubeId))}`));
  }
  if (appleId && source.podcastAppleId) {
    add(
      "apple",
      parseUrl(`https://podcasts.apple.com/podcast/id${encodeURIComponent(String(source.podcastAppleId))}?i=${encodeURIComponent(String(appleId))}`)
    );
  }
  if (source.bbc) {
    const bbcKey = resolveServiceKey(source.bbc);
    if (bbcKey) {
      add(bbcKey, source.bbc);
    }
  }
  add("internetArchive", source.internetArchive);
  for (const item of expandSvc(source.svc)) {
    add(item.key, item.url);
  }
  if (source.services) {
    for (const [key, link] of Object.entries(source.services)) {
      if (key === "other") {
        continue;
      }
      add(key, parseUrl(link?.url));
    }
  }

  const ordered: EpisodeServiceItem[] = [];
  const seen = new Set<string>();
  for (const descriptor of SERVICE_CATALOG) {
    const url = byService.get(descriptor.key);
    if (url) {
      ordered.push(toItem(descriptor.key, url));
      seen.add(descriptor.key);
    }
  }
  for (const [key, url] of [...byService.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!seen.has(key)) {
      ordered.push(toItem(key, url));
    }
  }
  return ordered;
}

/** URLs that are not the default Spotify/Apple/YouTube editor slots. */
export function additionalServiceUrls(source: ServiceLinkSource): URL[] {
  return additionalServiceLinks(source).map((item) => item.url);
}

/** Extra catalog destinations with adjacent artwork from services.{key}.image. */
export function additionalServiceLinks(source: ServiceLinkSource): { url: URL; image?: URL }[] {
  return collectEpisodeServices(source)
    .filter((item) => !isDefaultUiService(item.key))
    .map((item) => ({
      url: item.url,
      image: parseUrl(source.services?.[item.key]?.image)
    }));
}
