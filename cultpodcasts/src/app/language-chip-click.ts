import { ALL_LANGUAGES_VALUE } from './subject-language-filter';

/**
 * Chip values after a language chip click.
 *
 * - All always gives All on its own.
 * - Until the visitor has chosen a language (the English default, or All after
 *   an automatic widen), a click starts afresh with just that language, so a
 *   non-English speaker gets their language without first removing English.
 * - After that, chips add and remove. Removing the last one gives All.
 */
export function nextLanguageChipValues(current: string[], clicked: string, touched: boolean): string[] {
  if (clicked === ALL_LANGUAGES_VALUE) {
    return [ALL_LANGUAGES_VALUE];
  }
  if (!touched) {
    return [clicked];
  }
  const selected = current.filter(value => value !== ALL_LANGUAGES_VALUE);
  const next = selected.includes(clicked)
    ? selected.filter(value => value !== clicked)
    : [...selected, clicked];
  return next.length ? next : [ALL_LANGUAGES_VALUE];
}
