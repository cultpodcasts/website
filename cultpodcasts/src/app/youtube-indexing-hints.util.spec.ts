import { describe, expect, it } from 'vitest';
import { effectiveYouTubeIndexingHints, formatIndexingHintInstant } from './youtube-indexing-hints.util';

describe('youtube-indexing-hints.util', () => {
  it('returns null when hints are missing or playlist id does not match the current playlist', () => {
    expect(effectiveYouTubeIndexingHints(null, 'PLabc')).toBeNull();
    expect(
      effectiveYouTubeIndexingHints({ playlistId: 'PLold', playlistItemCount: 10 }, 'PLnew')
    ).toBeNull();
    expect(effectiveYouTubeIndexingHints({ playlistId: 'PLabc' }, '')).toBeNull();
  });

  it('returns the hints when playlistId matches the current playlist', () => {
    const hints = { playlistId: 'PLabc', playlistItemCount: 5 };
    expect(effectiveYouTubeIndexingHints(hints, 'PLabc')).toEqual(hints);
  });

  it('formats instants for display and uses an em dash when unset or invalid', () => {
    expect(formatIndexingHintInstant(null)).toBe('—');
    expect(formatIndexingHintInstant('')).toBe('—');
    expect(formatIndexingHintInstant('not-a-date')).toBe('—');
    expect(formatIndexingHintInstant(new Date('2026-11-01T12:00:00Z'))).toContain('2026');
  });
});
