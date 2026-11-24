import * as searchDescription from './search-description';
import { formatSearchDescription, parseSearchEngine, SEARCH_DESCRIPTION_SIZE } from './search-description';
import { SearchEngine } from './search-engine.enum';

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
    expect(formatSearchDescription(text, SearchEngine.Azure)).toBe(`${'y'.repeat(SEARCH_DESCRIPTION_SIZE)}\u2026`);
    expect(formatSearchDescription(text, null)).toBe(`${'y'.repeat(SEARCH_DESCRIPTION_SIZE)}\u2026`);
  });

  it('does not cut a description past the Azure cap when the engine is d1', () => {
    const text = 'A reasonably long D1 description that would be cut at the Azure cap. '.repeat(3).trimEnd();
    expect(text.length).toBeGreaterThan(SEARCH_DESCRIPTION_SIZE);
    expect(formatSearchDescription(text, SearchEngine.D1)).toBe(text);
  });

  it('#703: never caps D1 copy, like the homepage hero (50k+ characters pass through in full)', () => {
    const full = Array.from({ length: 900 }, (_, i) => `Synthetic sentence ${i + 1} with a mid-word Salt Lake City tail.`).join(' ');
    expect(full.length).toBeGreaterThan(50_000);
    expect(formatSearchDescription(full, SearchEngine.D1)).toBe(full);
  });

  it('D1: trims surrounding whitespace only (homepage featuredDesc), keeping ASCII periods as sent', () => {
    expect(formatSearchDescription('  Full D1 text...  \n', SearchEngine.D1)).toBe('Full D1 text...');
  });

  it('#703: there is no D1 character cap to configure', () => {
    expect('D1_SEARCH_DESCRIPTION_SIZE' in searchDescription).toBe(false);
    expect('searchDescriptionSize' in searchDescription).toBe(false);
  });
});

describe('parseSearchEngine', () => {
  it('treats only the exact d1 value as D1, and everything else as Azure', () => {
    expect(SearchEngine.D1).toBe('d1');
    expect(SearchEngine.Azure).toBe('azure');
    expect(parseSearchEngine('d1')).toBe(SearchEngine.D1);
    expect(parseSearchEngine('azure')).toBe(SearchEngine.Azure);
    expect(parseSearchEngine(undefined)).toBe(SearchEngine.Azure);
    expect(parseSearchEngine(null)).toBe(SearchEngine.Azure);
    expect(parseSearchEngine('D1')).toBe(SearchEngine.Azure);
    expect(parseSearchEngine('')).toBe(SearchEngine.Azure);
  });
});
