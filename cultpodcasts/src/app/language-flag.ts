import { languageLabel } from './subject-language-filter';

/**
 * Well-known country flag for a language (representative country, not
 * exhaustive geopolitics). Used for non-English episode badges on flix.
 * Regional tags prefer a matching region when listed; otherwise the base
 * language's flag.
 *
 * These are Unicode regional-indicator sequences. Windows Chromium does not
 * paint them as flags (shows "ES" etc.); `main.ts` loads a Twemoji polyfill
 * font and `--cp-font-ui` prefers `"Twemoji Country Flags"` for those codepoints.
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

  // Southeast Asia / Pacific
  fil: '🇵🇭',
  tl: '🇵🇭',

  // South Asia (India / Sri Lanka — no dedicated Punjab Unicode flag)
  te: '🇮🇳',
  mr: '🇮🇳',
  si: '🇱🇰',

  // Baltic / Balkans
  lt: '🇱🇹',
  lv: '🇱🇻',
  et: '🇪🇪',
  bs: '🇧🇦',
  mk: '🇲🇰',

  // African
  af: '🇿🇦',
  sw: '🇰🇪',
};

export interface LanguageFlagBadge {
  /** IETF-ish code as stored on the episode. */
  code: string;
  /**
   * Flag emoji for a well-known country, or the uppercase ISO language code
   * when no honest country flag exists (e.g. Punjabi, Yiddish).
   */
  flag: string;
  /** Human-readable language name for tooltips / a11y. */
  label: string;
  /** True when `flag` is a language-code fallback rather than a country flag. */
  isCode: boolean;
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
 * Non-English language badge with flag (or ISO code fallback) + label.
 * Undefined when missing/English.
 */
export function languageFlagBadge(
  code: string | null | undefined
): LanguageFlagBadge | undefined {
  if (!code?.trim() || isEnglishLanguageCode(code)) {
    return undefined;
  }
  const trimmed = code.trim();
  const normalized = trimmed.toLowerCase().replace('_', '-');
  const base = normalized.split('-')[0];
  const flag =
    LANGUAGE_FLAG_BY_CODE[normalized] ??
    LANGUAGE_FLAG_BY_CODE[base];
  if (flag) {
    return {
      code: trimmed,
      flag,
      label: languageLabel(trimmed),
      isCode: false
    };
  }
  // No country flag (Punjabi, Yiddish, …): show the uppercase ISO base code.
  if (!base) {
    return undefined;
  }
  return {
    code: trimmed,
    flag: base.toUpperCase(),
    label: languageLabel(trimmed),
    isCode: true
  };
}

export function languageFlagBadgeForEpisode(episode: {
  language?: string | null;
  lang?: string | null;
}): LanguageFlagBadge | undefined {
  return languageFlagBadge(episodeLanguageCode(episode));
}
