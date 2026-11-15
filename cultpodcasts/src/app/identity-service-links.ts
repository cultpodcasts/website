import { imdbTitleUrl, tmdbMovieUrl, tmdbTvShowUrl, tvdbEpisodeUrl, tvdbSeriesUrl } from './playable-edit-form.util';
import { SearchResult } from './search-result.interface';

/** A public chip for one identity service (RedditPodcastPoster#1437). */
export type IdentityServiceLink = { label: 'IMDb' | 'TMDB' | 'TVDB'; href: string };

export type IdentityLinkKind = 'film' | 'tv-episode' | 'tv-show';

/** Film and TV-episode public pages; news and podcasts have no identity chips. */
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
 * External identity-service links we can build from a search document. Only services with an id are
 * returned. TV episode TMDB links use the series URL (episodes do not store season/episode numbers).
 */
export function identityServiceLinks(hit: SearchResult, kind: IdentityLinkKind): IdentityServiceLink[] {
  const links: IdentityServiceLink[] = [];
  if (kind === 'film') {
    add(links, 'IMDb', imdbTitleUrl(hit.imdbId));
    add(links, 'TMDB', tmdbMovieUrl(hit.tmdbId));
    return links;
  }
  if (kind === 'tv-show') {
    add(links, 'IMDb', imdbTitleUrl(hit.seriesImdbId ?? hit.imdbId));
    add(links, 'TMDB', tmdbTvShowUrl(hit.seriesTmdbId ?? hit.tmdbId));
    add(links, 'TVDB', tvdbSeriesUrl(hit.seriesTvdbId ?? hit.tvdbId));
    return links;
  }
  add(links, 'IMDb', imdbTitleUrl(hit.imdbId));
  add(links, 'TMDB', tmdbTvShowUrl(hit.seriesTmdbId));
  add(links, 'TVDB', tvdbEpisodeUrl(hit.tvdbId) || tvdbSeriesUrl(hit.seriesTvdbId));
  return links;
}

function add(links: IdentityServiceLink[], label: IdentityServiceLink['label'], href: string): void {
  if (href) {
    links.push({ label, href });
  }
}
