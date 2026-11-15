import { identityLinkKind, identityServiceLinks } from './identity-service-links';
import { SearchResult } from './search-result.interface';

function hit(partial: Partial<SearchResult>): SearchResult {
  return {
    id: 'id',
    podcastName: 'Show',
    episodeTitle: 'Title',
    episodeDescription: '',
    release: new Date('2024-01-01T00:00:00Z'),
    duration: '1:30:00',
    ...partial
  };
}

describe('identityServiceLinks', () => {
  it('builds IMDb and TMDB movie links for a film and skips missing ids', () => {
    expect(identityLinkKind('Film')).toBe('film');
    expect(identityServiceLinks(hit({ imdbId: 'tt11280740', tmdbId: 123 }), 'film')).toEqual([
      { label: 'IMDb', href: 'https://www.imdb.com/title/tt11280740/' },
      { label: 'TMDB', href: 'https://www.themoviedb.org/movie/123' }
    ]);
    expect(identityServiceLinks(hit({ imdbId: 'tt11280740' }), 'film')).toEqual([
      { label: 'IMDb', href: 'https://www.imdb.com/title/tt11280740/' }
    ]);
    expect(identityServiceLinks(hit({}), 'film')).toEqual([]);
  });

  it('builds IMDb, TMDB series and TVDB links for a TV show and a TV episode', () => {
    expect(identityLinkKind('TvShowEpisode')).toBe('tv-episode');
    expect(identityLinkKind('NewsReport')).toBeNull();
    const show = hit({
      seriesImdbId: 'tt1234567',
      seriesTmdbId: 99,
      seriesTvdbId: 1001,
      imdbId: 'tt7654321',
      tvdbId: 2002
    });
    expect(identityServiceLinks(show, 'tv-show')).toEqual([
      { label: 'IMDb', href: 'https://www.imdb.com/title/tt1234567/' },
      { label: 'TMDB', href: 'https://www.themoviedb.org/tv/99' },
      { label: 'TVDB', href: 'https://www.thetvdb.com/dereferrer/series/1001' }
    ]);
    expect(identityServiceLinks(show, 'tv-episode')).toEqual([
      { label: 'IMDb', href: 'https://www.imdb.com/title/tt7654321/' },
      { label: 'TMDB', href: 'https://www.themoviedb.org/tv/99' },
      { label: 'TVDB', href: 'https://www.thetvdb.com/dereferrer/episode/2002' }
    ]);
  });
});
