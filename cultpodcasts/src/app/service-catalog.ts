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

const DEFAULT_UI_SET = new Set<string>(DEFAULT_UI_SERVICE_KEYS);

/** Mirrors RPP ServiceCatalog JSON keys, icon names, and display order. */
export const SERVICE_CATALOG: ServiceDescriptor[] = [
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
  { key: "tvnzPlus", displayName: "TVNZ+", icon: "tvnz-plus", wideImage: true }
];

const byKey = new Map(SERVICE_CATALOG.map((d) => [d.key, d]));

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

export function resolveServiceKey(url: URL): string | undefined {
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
  if (host.endsWith("tvnz.co.nz")) {
    return "tvnzPlus";
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

const EXPAND: Record<string, (id: string) => string> = {
  bbcSounds: (id) => `https://www.bbc.co.uk/sounds/play/${id}`,
  bbcIplayer: (id) => `https://www.bbc.co.uk/iplayer/episode/${id}`,
  internetArchive: (id) => `https://archive.org/details/${id}`,
  vimeo: (id) => `https://vimeo.com/${id}`,
  netflix: (id) => `https://www.netflix.com/title/${id}`
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
    } else {
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
  return collectEpisodeServices(source)
    .filter((item) => !isDefaultUiService(item.key))
    .map((item) => item.url);
}
