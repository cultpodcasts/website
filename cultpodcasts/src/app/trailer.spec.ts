import { HttpErrorResponse } from '@angular/common/http';
import { filmTrailerEpisode, parseFilmTrailerTokens } from './film-trailer';
import { tvShowTrailerEpisode } from './tv-show-trailer';
import {
  displayDuration,
  httpUrl,
  staleTrailersError,
  staleTrailersMessage,
  Trailer,
  trailerChanges,
  trailerParentId,
  trailerSearchDuration,
  trailerUrl
} from './trailer';

const parentId = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d';

const stored = [
  { id: 'a', title: 'First' },
  { id: 'b', title: 'Second' }
];

describe('trailer (shared by films and TV shows)', () => {
  describe('displayDuration', () => {
    it('drops zero hours and fractions and keeps hours when present', () => {
      expect(displayDuration('00:02:11.9910000')).toBe('2:11');
      expect(displayDuration('01:02:03')).toBe('1:02:03');
      expect(displayDuration('1.02:00:00')).toBe('26:00:00');
      expect(displayDuration('not a duration')).toBe('');
    });
  });

  describe('trailerSearchDuration', () => {
    it.each([
      ['0:02:11', '00:02:11'],
      ['00:02:11', '00:02:11'],
      ['00:02:11.9910000', '00:02:11'],
      ['1:02:03', '01:02:03'],
      ['1.02:00:00', '26:00:00'],
      ['', ''],
      ['soon', '']
    ])('turns %j into the search duration %j (the card strips one leading zero)', (value, expected) => {
      expect(trailerSearchDuration(value)).toBe(expected);
    });

    it.each([null, undefined])('is empty for %s', value => {
      expect(trailerSearchDuration(value)).toBe('');
    });
  });

  describe('httpUrl', () => {
    it('accepts http(s) text or URLs and nothing else', () => {
      expect(httpUrl('https://example.org/a')?.href).toBe('https://example.org/a');
      expect(httpUrl(new URL('http://example.org/b'))?.href).toBe('http://example.org/b');
      expect(httpUrl('javascript:alert(1)')).toBeUndefined();
      expect(httpUrl('ftp://example.org/c')).toBeUndefined();
      expect(httpUrl('not a url')).toBeUndefined();
      expect(httpUrl(null)).toBeUndefined();
    });
  });

  describe('trailerParentId', () => {
    it('reads the film or TV show id out of a card id, and nothing out of any other id', () => {
      expect(trailerParentId(`${parentId}:trailer:12`)).toBe(parentId);
      expect(trailerParentId(parentId)).toBeNull();
      expect(trailerParentId(`${parentId}:trailer:x`)).toBeNull();
      expect(trailerParentId(':trailer:1')).toBeNull();
    });

    it('reads the id of a film trailer card and of a TV show trailer card alike', () => {
      const [link] = parseFilmTrailerTokens(['00:02:11|https://www.youtube.com/watch?v=synthetic01|Synthetic Teaser']);
      const tvTrailer: Trailer = {
        id: 't1', title: 'Synthetic Teaser', url: 'https://www.youtube.com/watch?v=synthetic01', duration: '0:02:11'
      };

      expect(trailerParentId(filmTrailerEpisode(link, 'film-a', 0).id)).toBe('film-a');
      expect(trailerParentId(tvShowTrailerEpisode(tvTrailer, parentId, 3)!.id)).toBe(parentId);
    });
  });

  describe('trailerUrl', () => {
    it('gives back the trailer URL for the card title, whichever parent made the card', () => {
      const [link] = parseFilmTrailerTokens(['00:00:30|https://synthetic-video.example/v/3|Synthetic Elsewhere']);
      const tvTrailer: Trailer = {
        id: 't1', title: 'Synthetic Clip', url: 'https://synthetic-video.example/v/4', duration: '0:00:30'
      };

      expect(trailerUrl(filmTrailerEpisode(link, 'f', 0))).toBe('https://synthetic-video.example/v/3');
      expect(trailerUrl(tvShowTrailerEpisode(tvTrailer, parentId, 0)!)).toBe('https://synthetic-video.example/v/4');
      expect(trailerUrl({})).toBeUndefined();
    });
  });

  describe('trailerChanges', () => {
    it('is null when the order and titles are unchanged (titles compared trimmed)', () => {
      expect(trailerChanges({ trailers: stored }, [
        { id: 'a', title: 'First' },
        { id: 'b', title: '  Second ' }
      ])).toBeNull();
      expect(trailerChanges({}, [])).toBeNull();
    });

    it('is the whole keep-list in the new order when trailers are reordered', () => {
      expect(trailerChanges({ trailers: stored }, [
        { id: 'b', title: 'Second' },
        { id: 'a', title: 'First' }
      ])).toEqual([{ id: 'b', title: 'Second' }, { id: 'a', title: 'First' }]);
    });

    it('sends a rename as the trimmed title and omits a blank title so the server keeps the stored one', () => {
      expect(trailerChanges({ trailers: stored }, [
        { id: 'a', title: '  Renamed ' },
        { id: 'b', title: '   ' }
      ])).toEqual([{ id: 'a', title: 'Renamed' }, { id: 'b' }]);
    });

    it('omits a removed trailer from the keep-list, and is [] when every trailer was removed', () => {
      expect(trailerChanges({ trailers: stored }, [{ id: 'b', title: 'Second' }]))
        .toEqual([{ id: 'b', title: 'Second' }]);
      expect(trailerChanges({ trailers: stored }, [])).toEqual([]);
    });
  });

  describe('staleTrailersMessage', () => {
    it.each([
      ['film', 'film'],
      ['tv', 'TV show']
    ] as const)('names the %s parent and says nothing was saved', (parent, noun) => {
      expect(staleTrailersMessage(1, parent)).toBe(
        `A trailer was attached to this ${noun} after the editor opened. ` +
        `Nothing was saved. Close and reopen the ${noun} to edit its trailers.`);
      expect(staleTrailersMessage(2, parent)).toContain(`2 trailers were attached to this ${noun} after the editor opened`);
    });
  });

  describe('staleTrailersError', () => {
    it('names the trailers the editor never saw on a 409 with unexpectedTrailerIds', () => {
      const conflict = new HttpErrorResponse({ status: 409, error: { unexpectedTrailerIds: ['x', 'y'] } });

      expect(staleTrailersError(conflict, 'tv')).toBe(staleTrailersMessage(2, 'tv'));
      expect(staleTrailersError(conflict, 'film')).toBe(staleTrailersMessage(2, 'film'));
    });

    it.each([
      ['a service-id 409 with no trailer ids', new HttpErrorResponse({ status: 409, error: { message: 'Owned elsewhere' } })],
      ['a 409 with an empty list', new HttpErrorResponse({ status: 409, error: { unexpectedTrailerIds: [] } })],
      ['a 400 that names trailer ids', new HttpErrorResponse({ status: 400, error: { unexpectedTrailerIds: ['x'] } })],
      ['a 409 with no body', new HttpErrorResponse({ status: 409 })],
      ['a non-HTTP error', new Error('boom')],
      ['null', null]
    ])('is undefined for %s', (_name, error) => {
      expect(staleTrailersError(error, 'film')).toBeUndefined();
    });
  });
});
