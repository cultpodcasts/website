import { formatSearchDescription, parseSearchEngine, SEARCH_DESCRIPTION_SIZE, D1_SEARCH_DESCRIPTION_SIZE } from './search-description';

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

  it('keeps the Azure cap when the engine is azure or omitted', () => {
    const text = 'y'.repeat(SEARCH_DESCRIPTION_SIZE + 1);
    expect(formatSearchDescription(text)).toBe(`${'y'.repeat(SEARCH_DESCRIPTION_SIZE)}\u2026`);
    expect(formatSearchDescription(text, 'azure')).toBe(`${'y'.repeat(SEARCH_DESCRIPTION_SIZE)}\u2026`);
    expect(formatSearchDescription(text, null)).toBe(`${'y'.repeat(SEARCH_DESCRIPTION_SIZE)}\u2026`);
  });

  it('does not clamp a description between the Azure and D1 caps when the engine is d1', () => {
    const text = 'A reasonably long D1 description that would be cut at the Azure cap. '.repeat(3).trimEnd();
    expect(text.length).toBeGreaterThan(SEARCH_DESCRIPTION_SIZE);
    expect(text.length).toBeLessThanOrEqual(D1_SEARCH_DESCRIPTION_SIZE);
    expect(formatSearchDescription(text, 'd1')).toBe(text);
  });

  it('caps D1 copy at the D1 size then mid-word ellipsis', () => {
    const prefix = 'x'.repeat(D1_SEARCH_DESCRIPTION_SIZE - 9);
    const full = `${prefix} Salt Lake City extra copy that exceeds the D1 cap`;
    expect(full.length).toBeGreaterThan(D1_SEARCH_DESCRIPTION_SIZE);
    expect(formatSearchDescription(full, 'd1')).toBe(`${prefix} Salt\u2026`);
  });
});

describe('parseSearchEngine', () => {
  it('treats only the exact d1 value as D1, and everything else as Azure', () => {
    expect(parseSearchEngine('d1')).toBe('d1');
    expect(parseSearchEngine('azure')).toBe('azure');
    expect(parseSearchEngine(undefined)).toBe('azure');
    expect(parseSearchEngine(null)).toBe('azure');
    expect(parseSearchEngine('D1')).toBe('azure');
    expect(parseSearchEngine('')).toBe('azure');
  });
});
