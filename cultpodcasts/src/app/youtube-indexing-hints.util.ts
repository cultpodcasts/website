import { YouTubeIndexingHints } from './youtube-indexing-hints.interface';

/**
 * Hints that apply to the current playlist. When the stored `playlistId` does not match
 * (or hints are missing), the next indexer pass does a full walk — show the empty state.
 */
export function effectiveYouTubeIndexingHints(
  hints: YouTubeIndexingHints | null | undefined,
  currentPlaylistId: string | null | undefined
): YouTubeIndexingHints | null {
  if (!hints) {
    return null;
  }
  const current = (currentPlaylistId ?? '').trim();
  const stored = (hints.playlistId ?? '').trim();
  if (!current || !stored || current !== stored) {
    return null;
  }
  return hints;
}

export function formatIndexingHintInstant(value: Date | string | null | undefined): string {
  if (value == null || value === '') {
    return '—';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString();
}
