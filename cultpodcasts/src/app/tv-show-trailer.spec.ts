import { HttpErrorResponse } from '@angular/common/http';
import {
  TV_SHOW_TRAILER_CONTENT_KIND,
  TvShowTrailer,
  staleTvShowTrailersError,
  staleTvShowTrailersMessage,
  tvShowIdFromTrailerId,
  tvShowTrailerChanges,
  tvShowTrailerEpisode,
  tvShowTrailerEpisodes,
  tvShowTrailerSearchDuration
} from './tv-show-trailer';

const showId = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d';

function trailer(overrides: Partial<TvShowTrailer> = {}): TvShowTrailer {
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

  describe('tvShowTrailerSearchDuration', () => {
    it.each([
      ['0:02:11', '00:02:11'],
      ['00:02:11', '00:02:11'],
      ['00:02:11.9910000', '00:02:11'],
      ['1:02:03', '01:02:03'],
      ['1.02:00:00', '26:00:00'],
      ['', ''],
      ['soon', '']
    ])('turns %j into the search duration %j (the card strips one leading zero)', (value, expected) => {
      expect(tvShowTrailerSearchDuration(value)).toBe(expected);
    });
  });

  describe('tvShowIdFromTrailerId', () => {
    it('reads the show id out of a card id, and nothing out of any other id', () => {
      expect(tvShowIdFromTrailerId(`${showId}:trailer:12`)).toBe(showId);
      expect(tvShowIdFromTrailerId(showId)).toBeNull();
      expect(tvShowIdFromTrailerId(`${showId}:trailer:x`)).toBeNull();
      expect(tvShowIdFromTrailerId(':trailer:1')).toBeNull();
    });
  });

  describe('tvShowTrailerChanges', () => {
    const stored = [
      { id: 'a', title: 'First' },
      { id: 'b', title: 'Second' }
    ];

    it('is null when the order and titles are unchanged (titles compared trimmed)', () => {
      expect(tvShowTrailerChanges({ trailers: stored }, [
        { id: 'a', title: 'First' },
        { id: 'b', title: '  Second ' }
      ])).toBeNull();
      expect(tvShowTrailerChanges({}, [])).toBeNull();
    });

    it('is the whole keep-list in the new order when trailers are reordered', () => {
      expect(tvShowTrailerChanges({ trailers: stored }, [
        { id: 'b', title: 'Second' },
        { id: 'a', title: 'First' }
      ])).toEqual([{ id: 'b', title: 'Second' }, { id: 'a', title: 'First' }]);
    });

    it('sends a rename as the trimmed title and omits a blank title so the server keeps the stored one', () => {
      expect(tvShowTrailerChanges({ trailers: stored }, [
        { id: 'a', title: '  Renamed ' },
        { id: 'b', title: '   ' }
      ])).toEqual([{ id: 'a', title: 'Renamed' }, { id: 'b' }]);
    });

    it('omits a removed trailer from the keep-list, and is [] when every trailer was removed', () => {
      expect(tvShowTrailerChanges({ trailers: stored }, [{ id: 'b', title: 'Second' }]))
        .toEqual([{ id: 'b', title: 'Second' }]);
      expect(tvShowTrailerChanges({ trailers: stored }, [])).toEqual([]);
    });
  });

  describe('staleTvShowTrailersError', () => {
    it('names the trailers the editor never saw on a 409 with unexpectedTrailerIds', () => {
      const conflict = new HttpErrorResponse({ status: 409, error: { unexpectedTrailerIds: ['x', 'y'] } });

      expect(staleTvShowTrailersError(conflict)).toBe(staleTvShowTrailersMessage(2));
      expect(staleTvShowTrailersMessage(2)).toContain('2 trailers were attached to this TV show after the editor opened');
      expect(staleTvShowTrailersMessage(1)).toContain('A trailer was attached');
      expect(staleTvShowTrailersMessage(1)).toContain('Nothing was saved');
    });

    it.each([
      ['a service-id 409 with no trailer ids', new HttpErrorResponse({ status: 409, error: { message: 'Owned elsewhere' } })],
      ['a 409 with an empty list', new HttpErrorResponse({ status: 409, error: { unexpectedTrailerIds: [] } })],
      ['a 400 that names trailer ids', new HttpErrorResponse({ status: 400, error: { unexpectedTrailerIds: ['x'] } })],
      ['a 409 with no body', new HttpErrorResponse({ status: 409 })],
      ['a non-HTTP error', new Error('boom')],
      ['null', null]
    ])('is undefined for %s', (_name, error) => {
      expect(staleTvShowTrailersError(error)).toBeUndefined();
    });
  });
});
