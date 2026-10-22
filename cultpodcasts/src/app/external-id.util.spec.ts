import { FormControl } from '@angular/forms';
import { externalIdSiteName, externalIdUrl, externalIdValidator, parseExternalId, parseImdbId, parseTmdbId } from './external-id.util';

// Synthetic ids only.
describe('external-id.util', () => {
  describe('parseImdbId', () => {
    const condenses: [string, string][] = [
      ['tt0000001', 'tt0000001'],
      ['  tt0000001  ', 'tt0000001'],
      ['TT0000001', 'tt0000001'],
      ['tt1234567890', 'tt1234567890'],
      ['https://www.imdb.com/title/tt0000001/', 'tt0000001'],
      ['https://www.imdb.com/title/tt0000001', 'tt0000001'],
      ['https://www.imdb.com/title/tt0000001/?ref_=synthetic_ref', 'tt0000001'],
      ['https://www.imdb.com/title/tt0000001/#section', 'tt0000001'],
      ['https://www.imdb.com/title/tt0000001/reviews/?ref_=tt_ql', 'tt0000001'],
      ['https://www.imdb.com/title/tt0000001/fullcredits', 'tt0000001'],
      ['http://www.imdb.com/title/tt0000001/', 'tt0000001'],
      ['https://imdb.com/title/tt0000001/', 'tt0000001'],
      ['https://m.imdb.com/title/tt0000001/', 'tt0000001'],
      ['https://m.imdb.com/title/tt0000001/?ref_=m_synthetic', 'tt0000001'],
      ['https://WWW.IMDB.COM/Title/TT0000001/', 'tt0000001'],
      ['https://www.imdb.com/de/title/tt0000001/', 'tt0000001'],
      ['https://www.imdb.com/pt-br/title/tt0000001/', 'tt0000001'],
      ['www.imdb.com/title/tt0000001/', 'tt0000001'],
      ['imdb.com/title/tt0000001', 'tt0000001'],
      ['m.imdb.com/title/tt0000001/', 'tt0000001'],
      ['https://www.imdb.com//title//tt0000001//', 'tt0000001']
    ];
    for (const [input, id] of condenses) {
      it(`condenses ${JSON.stringify(input)}`, () => expect(parseImdbId(input)).toBe(id));
    }

    it('blank is empty (clears)', () => {
      expect(parseImdbId('')).toBe('');
      expect(parseImdbId('   ')).toBe('');
      expect(parseImdbId(null)).toBe('');
      expect(parseImdbId(undefined)).toBe('');
    });

    const rejects = [
      'tt123456',
      'tt12345678901',
      'nm0000001',
      '0000001',
      'tt 0000001',
      'synthetic',
      'https://www.imdb.com/name/nm0000001/',
      'https://www.imdb.com/title/',
      'https://www.imdb.com/',
      'https://www.imdb.com/list/ls000000001/',
      'https://www.imdb.com/title/nm0000001/',
      'https://www.imdb.com/find/?q=tt0000001',
      'https://www.example.com/title/tt0000001/',
      'https://imdb.com.example.org/title/tt0000001/',
      'https://www.themoviedb.org/movie/1',
      'ftp://www.imdb.com/title/tt0000001/',
      'javascript:alert(1)'
    ];
    for (const input of rejects) {
      it(`rejects ${JSON.stringify(input)}`, () => expect(parseImdbId(input)).toBeNull());
    }
  });

  describe('parseTmdbId', () => {
    const movies: [string, string][] = [
      ['1', '1'],
      ['1234567', '1234567'],
      [' 1234567 ', '1234567'],
      ['007', '7'],
      ['https://www.themoviedb.org/movie/1234567', '1234567'],
      ['https://www.themoviedb.org/movie/1234567/', '1234567'],
      ['https://www.themoviedb.org/movie/1234567-a-synthetic-film', '1234567'],
      ['https://www.themoviedb.org/movie/1234567-a-synthetic-film/', '1234567'],
      ['https://www.themoviedb.org/movie/1234567-a-synthetic-film?language=en-GB', '1234567'],
      ['https://www.themoviedb.org/movie/1234567-a-synthetic-film#cast', '1234567'],
      ['https://www.themoviedb.org/movie/1234567-a-synthetic-film/cast', '1234567'],
      ['https://www.themoviedb.org/movie/1234567/images/posters?image_language=en', '1234567'],
      ['https://themoviedb.org/movie/1234567', '1234567'],
      ['http://www.themoviedb.org/movie/1234567', '1234567'],
      ['www.themoviedb.org/movie/1234567-synthetic', '1234567'],
      ['https://www.themoviedb.org/fr/movie/1234567-synthetic', '1234567'],
      ['https://www.themoviedb.org/en-GB/movie/1234567-synthetic', '1234567'],
      ['https://WWW.THEMOVIEDB.ORG/Movie/1234567', '1234567']
    ];
    for (const [input, id] of movies) {
      it(`condenses movie ${JSON.stringify(input)}`, () => expect(parseTmdbId(input, 'movie')).toBe(id));
    }

    const tv: [string, string][] = [
      ['7654321', '7654321'],
      ['https://www.themoviedb.org/tv/7654321', '7654321'],
      ['https://www.themoviedb.org/tv/7654321-a-synthetic-show', '7654321'],
      ['https://www.themoviedb.org/tv/7654321-a-synthetic-show/season/1', '7654321'],
      ['https://www.themoviedb.org/tv/7654321-a-synthetic-show/season/1/episode/2?language=en-US', '7654321'],
      ['https://www.themoviedb.org/de/tv/7654321-synthetic/', '7654321']
    ];
    for (const [input, id] of tv) {
      it(`condenses tv ${JSON.stringify(input)}`, () => expect(parseTmdbId(input, 'tv')).toBe(id));
    }

    it('blank is empty (clears)', () => {
      expect(parseTmdbId('', 'movie')).toBe('');
      expect(parseTmdbId('  ', 'tv')).toBe('');
      expect(parseTmdbId(null, 'movie')).toBe('');
    });

    const movieRejects = [
      '0',
      '-3',
      '12.5',
      '1e5',
      '2147483648',
      'synthetic',
      'https://www.themoviedb.org/tv/1234567-a-synthetic-show',
      'https://www.themoviedb.org/person/1234567-synthetic-person',
      'https://www.themoviedb.org/movie/',
      'https://www.themoviedb.org/movie/a-synthetic-film',
      'https://www.themoviedb.org/movie/0',
      'https://www.themoviedb.org/search?query=1234567',
      'https://www.example.com/movie/1234567',
      'https://www.imdb.com/title/tt0000001/',
      'tt0000001'
    ];
    for (const input of movieRejects) {
      it(`rejects movie ${JSON.stringify(input)}`, () => expect(parseTmdbId(input, 'movie')).toBeNull());
    }

    it('rejects a movie URL as a TV id', () => {
      expect(parseTmdbId('https://www.themoviedb.org/movie/1234567-a-synthetic-film', 'tv')).toBeNull();
    });
  });

  it('parseExternalId dispatches on kind', () => {
    expect(parseExternalId('imdb', 'https://m.imdb.com/title/tt0000001/')).toBe('tt0000001');
    expect(parseExternalId('tmdb-movie', 'https://www.themoviedb.org/movie/5-x')).toBe('5');
    expect(parseExternalId('tmdb-tv', 'https://www.themoviedb.org/tv/6-x')).toBe('6');
    expect(parseExternalId('tmdb-tv', 'https://www.themoviedb.org/movie/5-x')).toBeNull();
  });

  it('builds the page URL from the id (or a URL that condenses to it), null when blank or invalid', () => {
    expect(externalIdUrl('imdb', 'tt0000001')).toBe('https://www.imdb.com/title/tt0000001/');
    expect(externalIdUrl('imdb', 'https://m.imdb.com/title/tt0000001/?ref_=x')).toBe('https://www.imdb.com/title/tt0000001/');
    expect(externalIdUrl('tmdb-movie', '42')).toBe('https://www.themoviedb.org/movie/42');
    expect(externalIdUrl('tmdb-tv', '42')).toBe('https://www.themoviedb.org/tv/42');
    expect(externalIdUrl('imdb', '')).toBeNull();
    expect(externalIdUrl('imdb', 'nm0000001')).toBeNull();
    expect(externalIdUrl('tmdb-movie', '0')).toBeNull();
  });

  it('names the site', () => {
    expect(externalIdSiteName('imdb')).toBe('IMDb');
    expect(externalIdSiteName('tmdb-movie')).toBe('TMDB');
    expect(externalIdSiteName('tmdb-tv')).toBe('TMDB');
  });

  it('the validator accepts blank, ids and condensable URLs, and flags the rest', () => {
    const imdb = new FormControl('', { nonNullable: true, validators: [externalIdValidator('imdb')] });
    expect(imdb.valid).toBe(true);
    imdb.setValue('https://www.imdb.com/title/tt0000001/');
    expect(imdb.valid).toBe(true);
    imdb.setValue('https://www.imdb.com/name/nm0000001/');
    expect(imdb.hasError('externalId')).toBe(true);
    const tmdb = new FormControl('12', { nonNullable: true, validators: [externalIdValidator('tmdb-movie')] });
    expect(tmdb.valid).toBe(true);
    tmdb.setValue('twelve');
    expect(tmdb.hasError('externalId')).toBe(true);
  });
});
