import { SearchResult } from './search-result.interface';

/**
 * Additional YouTube uploads (RPP #1411). The item's search document has one
 * `{youTubeId}|{release}|{channelName}` token per upload, in display order. Channel name is last and may
 * itself contain `|`, so a token splits on its first two `|` only. Release is `yyyy-MM-dd` UTC, or empty.
 */
export interface YouTubeAlternateLink {
  youTubeId: string;
  url: URL;
  /** `yyyy-MM-dd`, or empty when unknown. */
  release: string;
  channelName: string;
}

/** `contentKind` of an "Also on YouTube" rail card. Not an RPP kind. */
export const YOUTUBE_ALTERNATE_CONTENT_KIND = 'YouTubeAlternate';

const WATCH_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com']);

/** The video id from a YouTube watch / share / embed / shorts URL, or undefined when it is not one. */
export function youtubeVideoId(url: URL): string | undefined {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id || undefined;
  }
  if (WATCH_HOSTS.has(host)) {
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

export function youTubeWatchUrl(youTubeId: string): URL {
  return new URL(`https://www.youtube.com/watch?v=${encodeURIComponent(youTubeId)}`);
}

/** Parses the search document's `youTubeAlternates` tokens. Malformed tokens and blank ids are skipped. */
export function parseYouTubeAlternateTokens(tokens: readonly string[] | null | undefined): YouTubeAlternateLink[] {
  const links: YouTubeAlternateLink[] = [];
  for (const token of tokens ?? []) {
    if (typeof token !== 'string') {
      continue;
    }
    const first = token.indexOf('|');
    const second = first < 0 ? -1 : token.indexOf('|', first + 1);
    if (second < 0) {
      continue;
    }
    const youTubeId = token.slice(0, first).trim();
    if (!youTubeId) {
      continue;
    }
    links.push({
      youTubeId,
      url: youTubeWatchUrl(youTubeId),
      release: token.slice(first + 1, second).trim(),
      channelName: token.slice(second + 1).trim(),
    });
  }
  return links;
}

/**
 * An additional YouTube upload as a rail card. The token has the video id, optional publish date and channel
 * name, so: the id is made up (unique per item and position, for the player and queue); `services.youtube` is
 * the watch URL; `podcastName` carries the item title so the player and queue can link back; the card title is
 * the channel name (or "YouTube" when it is missing).
 */
/** The owning item's id, parsed out of `{itemId}:youtube-alternate:{n}`. Null when the id is not one. */
export function itemIdFromYouTubeAlternateId(id: string | null | undefined): string | null {
  if (!id) {
    return null;
  }
  const marker = ':youtube-alternate:';
  const at = id.lastIndexOf(marker);
  if (at <= 0) {
    return null;
  }
  const itemId = id.slice(0, at);
  return itemId || null;
}

export type YouTubeAlternateOwnerKind = 'Film' | 'TvShowEpisode' | 'NewsReport' | 'Episode';

/**
 * An additional YouTube upload as a rail card. The token has the video id, optional publish date and channel
 * name, so: the id is made up (unique per item and position, for the player and queue); `services.youtube` is
 * the watch URL; `podcastName` is the owner's page slug (a film's title, or the show / outlet / podcast name)
 * so links go to the owning item, never a podcast URL built from the synthetic id; the card title is the
 * channel name (or "YouTube" when it is missing).
 */
export function youTubeAlternateEpisode(
  link: YouTubeAlternateLink,
  itemId: string,
  index: number,
  itemTitle = '',
  owner?: { contentKind?: string | null; parentName?: string | null }
): SearchResult {
  const kind = owner?.contentKind;
  const parentName = owner?.parentName?.trim() ?? '';
  const title = itemTitle.trim();
  const pageName = kind === 'Film' || !kind ? title : parentName || title;
  return {
    id: `${itemId}:youtube-alternate:${index}`,
    podcastName: pageName,
    episodeTitle: link.channelName || 'YouTube',
    episodeDescription: '',
    release: link.release ? new Date(`${link.release}T00:00:00Z`) : new Date(Number.NaN),
    duration: '',
    services: { youtube: { url: link.url } },
    youtubeId: link.youTubeId,
    contentKind: YOUTUBE_ALTERNATE_CONTENT_KIND,
    ownerContentKind: kind ?? undefined,
  };
}
