import { describe, expect, it } from 'vitest';
import { cssUrl } from './css-url';

const franceTv = 'https://medias.france.tv/mWIYxjXWQa3O-mgGdwXYWnbGh8s/880x0/filters:quality(85):format(jpeg)/c/w/w/phptgvwwc.jpg';

// Pure-string assertions on purpose: happy-dom (the unit-test DOM) drops any background-image whose
// URL contains brackets, quoted or not, so a DOM round-trip cannot show the fix. Chrome keeps the
// quoted form and drops the unquoted one.
describe('cssUrl', () => {
  it('returns null when there is no image', () => {
    expect(cssUrl(undefined)).toBeNull();
    expect(cssUrl(null)).toBeNull();
    expect(cssUrl('')).toBeNull();
    expect(cssUrl('   ')).toBeNull();
  });

  it('quotes the URL so brackets in the path survive (France TV thumbnails)', () => {
    expect(cssUrl(franceTv)).toBe(`url("${franceTv}")`);
  });

  it('accepts a URL object', () => {
    expect(cssUrl(new URL('https://i.ytimg.com/vi/abc/hqdefault.jpg'))).toBe('url("https://i.ytimg.com/vi/abc/hqdefault.jpg")');
  });

  it('escapes quotes, backslashes and line breaks', () => {
    expect(cssUrl('https://img.example/a"b\\c\nd.jpg')).toBe('url("https://img.example/a\\"b\\\\c\\a d.jpg")');
  });
});
