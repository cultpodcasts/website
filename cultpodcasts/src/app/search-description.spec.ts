import { formatSearchDescription, SEARCH_DESCRIPTION_SIZE } from './search-description';

describe('formatSearchDescription', () => {
  it('returns empty for nullish values', () => {
    expect(formatSearchDescription(null)).toBe('');
    expect(formatSearchDescription(undefined)).toBe('');
  });

  it('leaves short descriptions unchanged', () => {
    expect(formatSearchDescription('A short description.')).toBe('A short description.');
  });

  it('normalizes three ASCII periods to a Unicode ellipsis', () => {
    expect(formatSearchDescription('Already truncated at a word...')).toBe(
      'Already truncated at a word\u2026'
    );
  });

  it('leaves descriptions that already end with a Unicode ellipsis unchanged', () => {
    const text = 'Already truncated at a word\u2026';
    expect(formatSearchDescription(text)).toBe(text);
  });

  it('trims a mid-word hard truncate at the search size and adds a Unicode ellipsis', () => {
    const prefix = 'x'.repeat(SEARCH_DESCRIPTION_SIZE - 9);
    const hardTruncated = `${prefix} Salt Lak`;
    expect(hardTruncated.length).toBe(SEARCH_DESCRIPTION_SIZE);

    expect(formatSearchDescription(hardTruncated)).toBe(`${prefix} Salt\u2026`);
  });

  it('caps homepage-length copy at the search size then mid-word ellipsis', () => {
    const prefix = 'x'.repeat(SEARCH_DESCRIPTION_SIZE - 9);
    const fullR2 = `${prefix} Salt Lake City extra homepage copy that exceeds the search cap`;
    expect(fullR2.length).toBeGreaterThan(SEARCH_DESCRIPTION_SIZE);

    expect(formatSearchDescription(fullR2)).toBe(`${prefix} Salt\u2026`);
  });
});
