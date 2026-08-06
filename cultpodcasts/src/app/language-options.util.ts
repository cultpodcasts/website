/** English is represented as unset/null — never store or offer an `en` code. */
export const ENGLISH_LANGUAGE_EXCLUDED_CODES = ['en'] as const;

/** @deprecated Prefer ENGLISH_LANGUAGE_EXCLUDED_CODES */
export const PODCAST_DEFAULT_LANGUAGE_EXCLUDED_CODES = ENGLISH_LANGUAGE_EXCLUDED_CODES;

function withoutEnglishCodes(languages: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(languages).filter(([code]) =>
      !ENGLISH_LANGUAGE_EXCLUDED_CODES.includes(code as typeof ENGLISH_LANGUAGE_EXCLUDED_CODES[number]))
  );
}

/** Episode picker: unset = English (stored as null). */
export function buildEpisodeLanguageOptions(languages: Record<string, string>): Record<string, string> {
  return { unset: 'English', ...withoutEnglishCodes(languages) };
}

/** Podcast default language: unset = no default. English is never a podcast default code. */
export function buildPodcastLanguageOptions(languages: Record<string, string>): Record<string, string> {
  return { unset: 'No Language', ...withoutEnglishCodes(languages) };
}

/** Form value for an episode language code (English / empty / en* → unset). */
export function episodeLanguageFormValue(lang: string | null | undefined): string {
  if (!lang?.trim()) {
    return 'unset';
  }
  const lower = lang.trim().toLowerCase().replace('_', '-');
  if (lower === 'en' || lower.startsWith('en-')) {
    return 'unset';
  }
  return lang;
}
