import { HomepageEpisode } from './homepage-episode.interface';
import { appleUrl, spotifyUrl, youtubeUrl } from './search-result-links';

export type EmbedService = 'youtube' | 'spotify' | 'apple';

export interface EpisodeEmbedOption {
  service: EmbedService;
  label: string;
  /** Safe embed iframe src (known host + id only). */
  embedUrl: string;
  /** Original episode page for “open in app”. */
  externalUrl: string;
}

const SERVICE_ORDER: EmbedService[] = ['youtube', 'spotify', 'apple'];

export function episodeEmbedOptions(episode: HomepageEpisode): EpisodeEmbedOption[] {
  const options: EpisodeEmbedOption[] = [];

  const yt = youtubeUrl(episode);
  const ytEmbed = yt ? youtubeEmbedUrl(yt) : undefined;
  if (yt && ytEmbed) {
    options.push({
      service: 'youtube',
      label: 'YouTube',
      embedUrl: ytEmbed,
      externalUrl: yt.toString(),
    });
  }

  const sp = spotifyUrl(episode);
  const spEmbed = sp ? spotifyEmbedUrl(sp) : undefined;
  if (sp && spEmbed) {
    options.push({
      service: 'spotify',
      label: 'Spotify',
      embedUrl: spEmbed,
      externalUrl: sp.toString(),
    });
  }

  const ap = appleUrl(episode);
  const apEmbed = ap ? appleEmbedUrl(ap) : undefined;
  if (ap && apEmbed) {
    options.push({
      service: 'apple',
      label: 'Apple',
      embedUrl: apEmbed,
      externalUrl: ap.toString(),
    });
  }

  return options.sort(
    (a, b) => SERVICE_ORDER.indexOf(a.service) - SERVICE_ORDER.indexOf(b.service)
  );
}

export function preferredEmbedService(options: EpisodeEmbedOption[]): EmbedService | undefined {
  return options[0]?.service;
}

export function youtubeEmbedUrl(watchUrl: URL): string | undefined {
  const id = youtubeVideoId(watchUrl);
  if (!id) {
    return undefined;
  }
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
}

export function spotifyEmbedUrl(episodeUrl: URL): string | undefined {
  const match = episodeUrl.pathname.match(/\/episode\/([A-Za-z0-9]+)/);
  if (!match) {
    return undefined;
  }
  return `https://open.spotify.com/embed/episode/${encodeURIComponent(match[1])}?utm_source=generator&theme=0`;
}

export function appleEmbedUrl(podcastUrl: URL): string | undefined {
  const host = podcastUrl.hostname.replace(/^www\./, '');
  if (host !== 'podcasts.apple.com') {
    return undefined;
  }

  const pathMatch = podcastUrl.pathname.match(/\/id(\d+)/);
  const episodeId = podcastUrl.searchParams.get('i');
  if (!pathMatch || !episodeId) {
    return undefined;
  }

  const localeMatch = podcastUrl.pathname.match(/^\/([a-z]{2})(?:-[a-z]{2})?\//i);
  const locale = localeMatch?.[1]?.toLowerCase() ?? 'us';
  return `https://embed.podcasts.apple.com/${locale}/podcast/id${pathMatch[1]}?i=${encodeURIComponent(episodeId)}`;
}

function youtubeVideoId(url: URL): string | undefined {
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
