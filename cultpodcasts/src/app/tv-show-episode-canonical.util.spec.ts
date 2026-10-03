import { describe, expect, it } from 'vitest';
import { buildTvShowEpisodeCanonicalChangeRequest } from './tv-show-episode-canonical.util';

describe('buildTvShowEpisodeCanonicalChangeRequest', () => {
  const storedImdb = 'https://www.imdb.com/title/tt0000001/';
  const storedTvdb = 'https://www.thetvdb.com/series/nightly';
  const nextImdb = 'https://www.imdb.com/title/tt0000002/';

  it('omits an unchanged URL', () => {
    expect(buildTvShowEpisodeCanonicalChangeRequest(
      { imdb: storedImdb, tvdb: storedTvdb },
      { imdb: storedImdb, tvdb: storedTvdb }
    )).toEqual({});
  });

  it('omits an unchanged empty field', () => {
    expect(buildTvShowEpisodeCanonicalChangeRequest(
      { imdb: null, tvdb: undefined },
      { imdb: '', tvdb: '   ' }
    )).toEqual({});
  });

  it('sends empty string after clear', () => {
    expect(buildTvShowEpisodeCanonicalChangeRequest(
      { imdb: storedImdb, tvdb: storedTvdb },
      { imdb: '', tvdb: storedTvdb }
    )).toEqual({ imdb: '' });
  });

  it('sets a new URL and omits the other field', () => {
    expect(buildTvShowEpisodeCanonicalChangeRequest(
      { imdb: storedImdb, tvdb: null },
      { imdb: nextImdb, tvdb: '' }
    )).toEqual({ imdb: nextImdb });
  });
});
