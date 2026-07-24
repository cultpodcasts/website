/**
 * Builds a locale-independent `yyyy-MM-dd` key from a Date's local
 * year/month/day.
 *
 * `Date.prototype.toLocaleDateString()` must not be used for this: its
 * token order (e.g. `M/D/YYYY` vs `D/M/YYYY`) depends on the runtime's
 * default locale, which differs between server-side rendering (commonly
 * `en-US`) and a UK browser (`en-GB`). Round-tripping that ambiguous
 * string through a fixed `day/month/year` parser silently swaps day and
 * month whenever the day-of-month is 12 or less — e.g. 11 July becomes
 * "7 November".
 */
export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Inverse of {@link dateKey}: parses a `yyyy-MM-dd` key back into a local Date. */
export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-');
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
}
