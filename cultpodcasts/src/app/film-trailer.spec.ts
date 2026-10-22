import { displayDuration, parseFilmTrailerTokens } from './film-trailer';

describe('parseFilmTrailerTokens', () => {
  it('parses duration|url|title tokens in order', () => {
    const links = parseFilmTrailerTokens([
      '00:02:11|https://www.youtube.com/watch?v=synthetic01|Synthetic Teaser',
      '00:00:45.5000000|https://archive.org/details/synthetic-clip|Synthetic Clip'
    ]);

    expect(links.map(l => l.title)).toEqual(['Synthetic Teaser', 'Synthetic Clip']);
    expect(links[0].url.href).toBe('https://www.youtube.com/watch?v=synthetic01');
    expect(links[0].duration).toBe('2:11');
    expect(links[1].duration).toBe('0:45');
  });

  it('keeps a title that contains the separator whole', () => {
    const [link] = parseFilmTrailerTokens(['00:01:00|https://www.youtube.com/watch?v=synthetic02|Part 1 | Synthetic']);

    expect(link.title).toBe('Part 1 | Synthetic');
  });

  it('skips malformed tokens, blank titles and non-http URLs', () => {
    expect(parseFilmTrailerTokens([
      'no separators',
      '00:01:00|only-two-parts',
      '00:01:00|javascript:alert(1)|Synthetic Bad',
      '00:01:00|https://www.youtube.com/watch?v=synthetic03|   '
    ])).toEqual([]);
    expect(parseFilmTrailerTokens(undefined)).toEqual([]);
    expect(parseFilmTrailerTokens(null)).toEqual([]);
  });
});

describe('displayDuration', () => {
  it('drops zero hours and fractions and keeps hours when present', () => {
    expect(displayDuration('00:02:11.9910000')).toBe('2:11');
    expect(displayDuration('01:02:03')).toBe('1:02:03');
    expect(displayDuration('1.02:00:00')).toBe('26:00:00');
    expect(displayDuration('not a duration')).toBe('');
  });
});
