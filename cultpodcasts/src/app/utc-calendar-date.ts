/**
 * Calendar `yyyy-MM-dd` (UTC) from a value that may already be a `Date` after
 * {@link JsonDateInterceptor}, or still be ISO / date-only text.
 *
 * Use this whenever a form control or display needs a calendar date but the API
 * field can be DateTimeUtc on the wire (films, playlist history, …). Do not put a
 * raw `Date` into a `FormControl` bound to `type="date"` or a `yyyy`/`yyyy-MM-dd`
 * text field — Angular stringifies it as a locale GMT dump and validation fails.
 *
 * - `Date`: UTC calendar date via `toISOString().slice(0, 10)`.
 * - ISO with `Z` or `±hh:mm`: UTC calendar date of that instant.
 * - Strict zone-less `yyyy-MM-ddTHH:mm[:ss[.fff]]`: read as UTC (append `Z`).
 * - Date-only `yyyy-MM-dd` / year / other text: returned trimmed when already a
 *   calendar shape; otherwise parsed then UTC-sliced (same as playlist history).
 * Never throws: invalid / empty → `""`.
 */
const zonelessDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

export function utcCalendarDateText(value: Date | string | null | undefined): string {
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    const text = value.trim();
    if (!text) {
      return '';
    }
    // Already a year or calendar date for film / news / TV editors — keep as-is.
    if (/^\d{4}(-\d{2}-\d{2})?$/.test(text)) {
      return text;
    }
    date = new Date(zonelessDateTime.test(text) ? `${text}Z` : text);
  }
  return date === null || Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}
