export const PODCAST_DEFAULT_LANGUAGE_EXCLUDED_CODES = ['en'] as const;

export function buildEpisodeLanguageOptions(languages: Record<string, string>): Record<string, string> {
  return { unset: 'No Language', ...languages };
}

export function buildPodcastLanguageOptions(languages: Record<string, string>): Record<string, string> {
  const filtered = Object.fromEntries(
    Object.entries(languages).filter(([code]) =>
      !PODCAST_DEFAULT_LANGUAGE_EXCLUDED_CODES.includes(code as typeof PODCAST_DEFAULT_LANGUAGE_EXCLUDED_CODES[number]))
  );
  return { unset: 'No Language', ...filtered };
}
