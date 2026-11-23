/**
 * A CSS `url("…")` value for a `[style.background-image]` binding, or `null` when there is no image.
 *
 * The URL is always quoted. An unquoted `url(…)` ends at the first `)`, so any image URL that
 * contains brackets, such as France TV's `…/filters:quality(85):format(jpeg)/…` thumbnails, made
 * the browser drop the whole declaration and the hero painted no art. Quotes, backslashes and
 * line breaks are escaped so the value stays a single CSS string.
 */
export function cssUrl(url: string | URL | null | undefined): string | null {
  const value = url?.toString().trim();
  if (!value) {
    return null;
  }
  const escaped = value.replace(/[\\"\n\r\f]/g, ch =>
    ch === '\\' || ch === '"' ? `\\${ch}` : `\\${ch.charCodeAt(0).toString(16)} `
  );
  return `url("${escaped}")`;
}
