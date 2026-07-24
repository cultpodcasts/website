import { languageLabel } from './subject-language-filter';

/**
 * Well-known country flag for a language (representative country, not
 * exhaustive geopolitics). Used for non-English episode badges on flix.
 * Regional tags prefer a matching region when listed; otherwise the base
 * language's flag.
 */
const LANGUAGE_FLAG_BY_CODE: Record<string, string> = {
  // Romance / Iberian
  es: '🇪🇸',
  'es-es': '🇪🇸',
  'es-mx': '🇲🇽',
  'es-ar': '🇦🇷',
  pt: '🇵🇹',
  'pt-pt': '🇵🇹',
  'pt-br': '🇧🇷',
  fr: '🇫🇷',
  'fr-fr': '🇫🇷',
  'fr-ca': '🇨🇦',
  it: '🇮🇹',
  ro: '🇷🇴',
  ca: '🇪🇸',

  // Germanic
  de: '🇩🇪',
  nl: '🇳🇱',
  sv: '🇸🇪',
  da: '🇩🇰',
  no: '🇳🇴',
  nb: '🇳🇴',
  nn: '🇳🇴',
  fi: '🇫🇮',
  is: '🇮🇸',

  // Slavic / Central / Eastern Europe
  cs: '🇨🇿',
  sk: '🇸🇰',
  pl: '🇵🇱',
  uk: '🇺🇦',
  ru: '🇷🇺',
  bg: '🇧🇬',
  hr: '🇭🇷',
  sr: '🇷🇸',
  sl: '🇸🇮',
  hu: '🇭🇺',

  // Other European
  el: '🇬🇷',
  tr: '🇹🇷',
  sq: '🇦🇱',

  // Middle East / South Asia / East Asia
  ar: '🇸🇦',
  he: '🇮🇱',
  hi: '🇮🇳',
  bn: '🇧🇩',
  ur: '🇵🇰',
  fa: '🇮🇷',
  zh: '🇨🇳',
  'zh-cn': '🇨🇳',
  'zh-tw': '🇹🇼',
  'zh-hk': '🇭🇰',
  ja: '🇯🇵',
  ko: '🇰🇷',
  th: '🇹🇭',
  vi: '🇻🇳',
  id: '🇮🇩',
  ms: '🇲🇾',

  // African
  af: '🇿🇦',
  sw: '🇰🇪',
};

export interface LanguageFlagBadge {
  /** IETF-ish code as stored on the episode. */
  code: string;
  /** Flag emoji for a well-known country associated with the language. */
  flag: string;
  /** Human-readable language name for tooltips / a11y. */
  label: string;
}

export function isEnglishLanguageCode(code: string | null | undefined): boolean {
  if (!code?.trim()) {
    return true;
  }
  const lower = code.trim().toLowerCase().replace('_', '-');
  return lower === 'en' || lower.startsWith('en-');
}

/** Resolve episode language from homepage (`language`) or search (`lang`). */
export function episodeLanguageCode(episode: {
  language?: string | null;
  lang?: string | null;
}): string | undefined {
  const raw = episode.language ?? episode.lang;
  const code = raw?.trim();
  return code || undefined;
}

/**
 * Non-English language badge with flag + label. Undefined when missing/English
 * or when no representative flag is known for the code.
 */
export function languageFlagBadge(
  code: string | null | undefined
): LanguageFlagBadge | undefined {
  if (!code?.trim() || isEnglishLanguageCode(code)) {
    return undefined;
  }
  const normalized = code.trim().toLowerCase().replace('_', '-');
  const flag =
    LANGUAGE_FLAG_BY_CODE[normalized] ??
    LANGUAGE_FLAG_BY_CODE[normalized.split('-')[0]];
  if (!flag) {
    return undefined;
  }
  return {
    code: code.trim(),
    flag,
    label: languageLabel(code.trim())
  };
}

export function languageFlagBadgeForEpisode(episode: {
  language?: string | null;
  lang?: string | null;
}): LanguageFlagBadge | undefined {
  return languageFlagBadge(episodeLanguageCode(episode));
}
