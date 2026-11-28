import { imdbIdPattern, int32Max } from './playable-edit-form.util';

/** True when the text is an IMDb title id (`tt…`) or a positive TMDB movie id (digits within int32). */
export function isFilmExternalIdPaste(text: string): boolean {
  const trimmed = text.trim();
  if (imdbIdPattern.test(trimmed)) {
    return true;
  }
  if (!/^[1-9]\d*$/.test(trimmed) || trimmed.length > 10) {
    return false;
  }
  return Number(trimmed) <= int32Max;
}
