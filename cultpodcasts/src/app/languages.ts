// Language display names come from the runtime's Intl.DisplayNames (ICU/CLDR)
// rather than a hand-maintained code → name table, so any ISO 639 code the
// backend emits (including languages added later via the admin "Supported
// languages" dialog) gets a readable label without a website change. Pure
// functions with no browser-only globals: safe in the browser, Node prerender
// and Cloudflare SSR.

export const DEFAULT_VIEWER_LOCALE = "en";

export interface SupplementaryLanguageName {
  /** CLDR English name, used for any viewer when the runtime has no name at all. */
  english?: string;
  /** CLDR native name (endonym), used when the runtime lacks that locale's data. */
  native?: string;
}

/**
 * Gap-filler for Chromium / Cloudflare workerd, whose ICU data is trimmed
 * (Node and Firefox/Safari ship full CLDR). Only consulted when Intl cannot
 * name the language itself; values are copied from full-ICU CLDR so the label
 * is identical on every runtime. Add a code here only when a supported
 * language shows its bare code or loses its native name in Chrome.
 */
export const SUPPLEMENTARY_LANGUAGE_NAMES: Readonly<Record<string, SupplementaryLanguageName>> = {
  ki: { english: "Kikuyu", native: "Gikuyu" },
  ti: { native: "ትግርኛ" },
  is: { native: "Íslenska" },
  mk: { native: "Македонски" },
  nn: { native: "Norsk nynorsk" },
  si: { native: "සිංහල" },
  sq: { native: "Shqip" },
  yi: { native: "ייִדיש" }
};

/** Creates `Intl.DisplayNames` for a locale; injectable so tests can simulate trimmed ICU data. */
export type LanguageDisplayNamesFactory = (locale: string) => Intl.DisplayNames | null;

const intlDisplayNames: LanguageDisplayNamesFactory = locale => {
  try {
    return typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames([locale], { type: "language" })
      : null;
  } catch {
    return null;
  }
};

/** Lower-case base language subtag (`pt-BR` / `pt_BR` → `pt`). */
function baseLanguageCode(code: string): string {
  return code.trim().toLowerCase().replace("_", "-").split("-")[0];
}

function languageOf(locale: string): string | undefined {
  try {
    return Intl.getCanonicalLocales(locale)[0]?.split("-")[0];
  } catch {
    return undefined;
  }
}

/**
 * Canonical BCP 47 tag for the viewer (`es_ES` → `es-ES`), or
 * {@link DEFAULT_VIEWER_LOCALE} when missing or not a valid tag.
 */
export function normaliseViewerLocale(locale: string | null | undefined): string {
  const candidate = locale?.trim().replace("_", "-");
  if (!candidate) {
    return DEFAULT_VIEWER_LOCALE;
  }
  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? DEFAULT_VIEWER_LOCALE;
  } catch {
    return DEFAULT_VIEWER_LOCALE;
  }
}

function capitaliseFirst(value: string, locale: string): string {
  if (!value) {
    return value;
  }
  let first: string;
  try {
    first = value.charAt(0).toLocaleUpperCase(locale);
  } catch {
    first = value.charAt(0).toUpperCase();
  }
  return first + value.slice(1);
}

/**
 * Builds a memoised `(code, viewerLocale) → label` function over a
 * display-names factory. Production code uses {@link languageLabel}.
 */
export function createLanguageLabeler(
  factory: LanguageDisplayNamesFactory = intlDisplayNames,
  supplementary: Readonly<Record<string, SupplementaryLanguageName>> = SUPPLEMENTARY_LANGUAGE_NAMES
): (code: string, viewerLocale?: string) => string {
  const namesCache = new Map<string, Intl.DisplayNames | null>();
  const labelCache = new Map<string, string | null>();

  const names = (locale: string): Intl.DisplayNames | null => {
    let value = namesCache.get(locale);
    if (value === undefined) {
      value = factory(locale);
      namesCache.set(locale, value);
    }
    return value;
  };

  /** Name of `base` in `locale`; undefined when unknown or when the runtime fell back to another locale. */
  const nameIn = (locale: string, base: string, requireLocaleData: boolean): string | undefined => {
    const displayNames = names(locale);
    if (!displayNames) {
      return undefined;
    }
    if (requireLocaleData) {
      // Trimmed ICU silently answers in the default locale (e.g. en-US) instead.
      let resolved: string | undefined;
      try {
        resolved = languageOf(displayNames.resolvedOptions().locale);
      } catch {
        resolved = undefined;
      }
      if (!resolved || (resolved !== base && resolved !== languageOf(base))) {
        return undefined;
      }
    }
    let name: string | undefined;
    try {
      name = displayNames.of(base);
    } catch {
      return undefined;
    }
    // Unknown codes come back as the code itself.
    if (!name || name.toLowerCase() === base) {
      return undefined;
    }
    return capitaliseFirst(name, locale);
  };

  const resolveLabel = (base: string, viewerLocale: string): string | null => {
    const extra = supplementary[base];
    const viewerName = nameIn(viewerLocale, base, false)
      ?? (extra?.english ? capitaliseFirst(extra.english, DEFAULT_VIEWER_LOCALE) : undefined);
    if (!viewerName) {
      return null;
    }
    const nativeName = nameIn(base, base, true)
      ?? (extra?.native ? capitaliseFirst(extra.native, base) : undefined);
    if (!nativeName || nativeName.toLowerCase() === viewerName.toLowerCase()) {
      return viewerName;
    }
    return `${viewerName} (${nativeName})`;
  };

  return (code: string, viewerLocale: string = DEFAULT_VIEWER_LOCALE): string => {
    const base = baseLanguageCode(code ?? "");
    if (!base) {
      return code;
    }
    const viewer = normaliseViewerLocale(viewerLocale);
    const key = `${viewer}|${base}`;
    let label = labelCache.get(key);
    if (label === undefined) {
      label = resolveLabel(base, viewer);
      labelCache.set(key, label);
    }
    return label ?? code;
  };
}

/**
 * Human-readable label for a language code: the name in the viewer's language
 * followed by the language's own name — e.g. `es` for an English viewer is
 * "Spanish (Español)", `en` for a Spanish viewer is "Inglés (English)". Shows a
 * single name when both match (case-insensitive). Region/script subtags fall
 * back to the base language (`pt-BR` → Portuguese). Returns the code unchanged
 * when it cannot be named.
 */
export const languageLabel = createLanguageLabeler();
