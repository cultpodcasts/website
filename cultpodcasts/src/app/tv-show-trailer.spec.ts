import {
  TV_SHOW_TRAILER_CONTENT_KIND,
  tvShowTrailerEpisode,
  tvShowTrailerEpisodes
} from './tv-show-trailer';
import { Trailer } from './trailer';

const showId = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d';

function trailer(overrides: Partial<Trailer> = {}): Trailer {
  return {
    id: 't1',
    title: 'Synthetic Teaser',
    url: new URL('https://www.youtube.com/watch?v=synthetic01'),
    duration: '0:02:11',
    ...overrides
  };
}

describe('tv-show-trailer', () => {
  describe('tvShowTrailerEpisode', () => {
    it('makes a rail card with a made-up id, the show name, and the trailer URL as its host service', () => {
      const episode = tvShowTrailerEpisode(trailer(), showId, 2, '  Synthetic Show  ')!;

      expect(episode.id).toBe(`${showId}:trailer:2`);
      expect(episode.podcastName).toBe('Synthetic Show');
      expect(episode.episodeTitle).toBe('Synthetic Teaser');
      expect(episode.contentKind).toBe(TV_SHOW_TRAILER_CONTENT_KIND);
      expect(episode.duration).toBe('00:02:11');
      expect(Object.keys(episode.services ?? {})).toEqual(['youtube']);
      expect(episode.services?.['youtube']?.url?.toString()).toBe('https://www.youtube.com/watch?v=synthetic01');
    });

    it('carries the trailer image and release when it has them, and an invalid release otherwise', () => {
      const release = new Date('2026-03-04T00:00:00Z');
      const withBoth = tvShowTrailerEpisode(
        trailer({ image: 'https://example.com/synthetic.jpg', release }), showId, 0)!;
      const without = tvShowTrailerEpisode(trailer(), showId, 0)!;

      expect(withBoth.release).toBe(release);
      expect(withBoth.services?.['youtube']?.image?.toString()).toBe('https://example.com/synthetic.jpg');
      expect(Number.isNaN(without.release.getTime())).toBe(true);
      expect(without.services?.['youtube']?.image).toBeUndefined();
    });

    it('files a non-streaming host under its host-derived service key, and accepts a string URL', () => {
      const episode = tvShowTrailerEpisode(trailer({ url: 'https://example.org/clip/1' }), showId, 0)!;

      expect(Object.keys(episode.services ?? {})).toEqual(['exampleorg']);
    });

    it.each(['', 'not a url', 'javascript:alert(1)', 'ftp://example.org/clip'])('skips a trailer whose URL is %j', url => {
      expect(tvShowTrailerEpisode(trailer({ url }), showId, 0)).toBeNull();
    });
  });

  describe('tvShowTrailerEpisodes', () => {
    it('keeps display order and numbers each card by its position in the show, skipping unusable URLs', () => {
      const episodes = tvShowTrailerEpisodes([
        trailer({ id: 'a', title: 'First' }),
        trailer({ id: 'b', title: 'Broken', url: 'nope' }),
        trailer({ id: 'c', title: 'Third' })
      ], showId, 'Synthetic Show');

      expect(episodes.map(e => e.episodeTitle)).toEqual(['First', 'Third']);
      expect(episodes.map(e => e.id)).toEqual([`${showId}:trailer:0`, `${showId}:trailer:2`]);
    });

    it.each([null, undefined, []])('is empty for %j', trailers => {
      expect(tvShowTrailerEpisodes(trailers, showId)).toEqual([]);
    });
  });
});
