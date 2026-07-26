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
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}
