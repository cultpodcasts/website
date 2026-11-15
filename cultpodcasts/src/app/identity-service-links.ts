import { imdbTitleUrl, tmdbMovieUrl, tmdbTvShowUrl, tvdbEpisodeUrl, tvdbSeriesUrl } from './playable-edit-form.util';
import { EpisodeServiceItem } from './service-catalog';

/** Film and TV-episode public pages; news and podcasts have no identity links. */
export type IdentityLinkKind = 'film' | 'tv-episode' | 'tv-show';

/** Ids a public page may have for building IMDb / TMDB / TVDB links (RPP #1437). */
export type IdentityLinkSource = {
  imdbId?: string | null;
  tmdbId?: number | string | null;
  tvdbId?: number | string | null;
  seriesImdbId?: string | null;
  seriesTmdbId?: number | string | null;
  seriesTvdbId?: number | string | null;
  contentKind?: string | null;
};

export function identityLinkKind(contentKind: string | null | undefined): IdentityLinkKind | null {
  if (contentKind === 'Film') {
    return 'film';
  }
  if (contentKind === 'TvShowEpisode') {
    return 'tv-episode';
  }
  return null;
}

/**
 * Identity-service buttons for the provider row. Only services with an id are returned, in IMDb, TMDB,
 * TVDB order, to append after streaming services. TV episode TMDB links use the series URL (episodes do
 * not store season/episode numbers).
 */
export function identityServiceLinks(hit: IdentityLinkSource, kind: IdentityLinkKind): EpisodeServiceItem[] {
  const links: EpisodeServiceItem[] = [];
  if (kind === 'film') {
    add(links, 'imdb', 'IMDb', imdbTitleUrl(hit.imdbId));
    add(links, 'tmdb', 'TMDB', tmdbMovieUrl(hit.tmdbId));
    return links;
  }
  if (kind === 'tv-show') {
    add(links, 'imdb', 'IMDb', imdbTitleUrl(hit.seriesImdbId ?? hit.imdbId));
    add(links, 'tmdb', 'TMDB', tmdbTvShowUrl(hit.seriesTmdbId ?? hit.tmdbId));
    add(links, 'tvdb', 'TVDB', tvdbSeriesUrl(hit.seriesTvdbId ?? hit.tvdbId));
    return links;
  }
  add(links, 'imdb', 'IMDb', imdbTitleUrl(hit.imdbId));
  add(links, 'tmdb', 'TMDB', tmdbTvShowUrl(hit.seriesTmdbId));
  add(links, 'tvdb', 'TVDB', tvdbEpisodeUrl(hit.tvdbId) || tvdbSeriesUrl(hit.seriesTvdbId));
  return links;
}

function add(links: EpisodeServiceItem[], key: string, displayName: string, href: string): void {
  if (!href) {
    return;
  }
  try {
    links.push({
      key,
      url: new URL(href),
      icon: key,
      displayName,
      usesAppleMark: false
    });
  } catch {
    /* skip malformed */
  }
}
