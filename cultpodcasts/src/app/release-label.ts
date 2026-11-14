/**
 * The release, or null when there is none: missing, unparseable, or the 0001-01-01 search default of a playable with no
 * release (e.g. a film created for a trailer before it is out, RPP #1418). Feed it to the date pipe, which renders null
 * as nothing.
 */
export function knownRelease(release: Date | string | null | undefined): Date | string | null {
  if (!release) {
    return null;
  }
  const date = release instanceof Date ? release : new Date(release);
  return Number.isNaN(date.getTime()) || date.getUTCFullYear() <= 1 ? null : release;
}

/**
 * Human-readable publication date for an episode (e.g. `17 Jul 2026`).
 *
 * The locale is pinned rather than left to the runtime default: server-side
 * rendering commonly resolves to `en-US` while a UK browser resolves to
 * `en-GB`, and the differing token order would produce a hydration mismatch.
 */
export function releaseDateLabel(release: Date | string | undefined): string | undefined {
  if (!release) {
    return undefined;
  }
  const date = release instanceof Date ? release : new Date(release);
  // A playable with no release (e.g. a film created for a trailer before it is out, RPP #1418) has the default
  // 0001-01-01 in search: show no date rather than "1 Jan 1".
  if (knownRelease(date) === null) {
    return undefined;
  }
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}
