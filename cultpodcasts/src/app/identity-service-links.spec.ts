import { identityLinkKind, identityServiceLinks, IdentityLinkSource } from './identity-service-links';

function hit(partial: IdentityLinkSource): IdentityLinkSource {
  return { ...partial };
}

function hrefs(source: IdentityLinkSource, kind: 'film' | 'tv-episode' | 'tv-show') {
  return identityServiceLinks(source, kind).map((item) => ({
    key: item.key,
    href: item.url.href,
    icon: item.icon,
    displayName: item.displayName
  }));
}

describe('identityServiceLinks', () => {
  it('builds IMDb and TMDB movie links for a film and skips missing ids', () => {
    expect(identityLinkKind('Film')).toBe('film');
    expect(hrefs(hit({ imdbId: 'tt11280740', tmdbId: 123 }), 'film')).toEqual([
      { key: 'imdb', href: 'https://www.imdb.com/title/tt11280740/', icon: 'imdb', displayName: 'IMDb' },
      { key: 'tmdb', href: 'https://www.themoviedb.org/movie/123', icon: 'tmdb', displayName: 'TMDB' }
    ]);
    expect(hrefs(hit({ imdbId: 'tt11280740' }), 'film')).toEqual([
      { key: 'imdb', href: 'https://www.imdb.com/title/tt11280740/', icon: 'imdb', displayName: 'IMDb' }
    ]);
    expect(hrefs(hit({}), 'film')).toEqual([]);
  });

  it('builds IMDb, TMDB series and TVDB links for a TV show and a TV episode', () => {
    expect(identityLinkKind('TvShowEpisode')).toBe('tv-episode');
    expect(identityLinkKind('NewsReport')).toBeNull();
    const show: IdentityLinkSource = {
      seriesImdbId: 'tt1234567',
      seriesTmdbId: 99,
      seriesTvdbId: 1001,
      imdbId: 'tt7654321',
      tvdbId: 2002
    };
    expect(hrefs(show, 'tv-show')).toEqual([
      { key: 'imdb', href: 'https://www.imdb.com/title/tt1234567/', icon: 'imdb', displayName: 'IMDb' },
      { key: 'tmdb', href: 'https://www.themoviedb.org/tv/99', icon: 'tmdb', displayName: 'TMDB' },
      { key: 'tvdb', href: 'https://www.thetvdb.com/dereferrer/series/1001', icon: 'tvdb', displayName: 'TVDB' }
    ]);
    expect(hrefs(show, 'tv-episode')).toEqual([
      { key: 'imdb', href: 'https://www.imdb.com/title/tt7654321/', icon: 'imdb', displayName: 'IMDb' },
      { key: 'tmdb', href: 'https://www.themoviedb.org/tv/99', icon: 'tmdb', displayName: 'TMDB' },
      { key: 'tvdb', href: 'https://www.thetvdb.com/dereferrer/episode/2002', icon: 'tvdb', displayName: 'TVDB' }
    ]);
  });
});
