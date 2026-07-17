import { SearchResultFacet } from "./search-result-facet.interface";

export const ENGLISH_LANGUAGE_VALUE = "__english__";
export const ALL_LANGUAGES_VALUE = "__all__";

export type SubjectLanguageSelection =
  | { mode: "english" }
  | { mode: "all" }
  | { mode: "codes"; codes: string[] }
  | { mode: "englishAndCodes"; codes: string[] };

export function buildSubjectLangFilter(selection: SubjectLanguageSelection): string {
  if (selection.mode === "all") {
    return "";
  }
  if (selection.mode === "english") {
    return " and lang eq null";
  }

  const codes = uniqueCodes(selection.codes);
  if (!codes.length) {
    return " and lang eq null";
  }

  const delimiter = ",";
  const list = codes.map(escapeODataString).join(delimiter);
  const codesFilter = `search.in(lang, '${list}', '${delimiter}')`;
  if (selection.mode === "englishAndCodes") {
    return ` and (lang eq null or ${codesFilter})`;
  }
  if (codes.length === 1) {
    return ` and lang eq '${escapeODataString(codes[0])}'`;
  }
  return ` and ${codesFilter}`;
}

export function selectionFromChipValues(values: string[]): SubjectLanguageSelection {
  const selected = new Set(values);
  if (selected.has(ALL_LANGUAGES_VALUE)) {
    return { mode: "all" };
  }
  if (selected.size === 0) {
    return { mode: "english" };
  }

  const includeEnglish = selected.has(ENGLISH_LANGUAGE_VALUE);
  const codes = [...selected]
    .filter(value => value !== ENGLISH_LANGUAGE_VALUE && value !== ALL_LANGUAGES_VALUE);

  if (includeEnglish && codes.length) {
    return { mode: "englishAndCodes", codes };
  }
  if (includeEnglish) {
    return { mode: "english" };
  }
  if (codes.length) {
    return { mode: "codes", codes };
  }
  return { mode: "english" };
}

export function englishFacetCount(
  subjectTotal: number,
  langFacets: SearchResultFacet[] | undefined
): number {
  const nonNull = (langFacets ?? []).reduce((sum, facet) => sum + (facet.count ?? 0), 0);
  return Math.max(0, subjectTotal - nonNull);
}

export function languageLabel(code: string): string {
  const trimmed = (code ?? "").trim();
  if (!trimmed) {
    return code;
  }

  const english = intlLanguageName(trimmed, "en");
  const endonym = intlLanguageName(trimmed, trimmed);

  if (english && endonym && english.toLowerCase() !== endonym.toLowerCase()) {
    return `${english} (${endonym})`;
  }
  return english ?? endonym ?? trimmed;
}

function intlLanguageName(code: string, locale: string): string | undefined {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(code);
    if (!name || name.toLowerCase() === code.toLowerCase()) {
      return undefined;
    }
    return capitalizeFirst(name, locale);
  } catch {
    return undefined;
  }
}

// Some endonyms come back lowercase (e.g. "español"); uppercase the first
// character only when the locale produces a single cased letter, so caseless
// scripts pass through untouched.
function capitalizeFirst(name: string, locale: string): string {
  const first = name.charAt(0);
  let upper: string;
  try {
    upper = first.toLocaleUpperCase(locale);
  } catch {
    upper = first.toUpperCase();
  }
  if (upper === first || upper.length !== 1) {
    return name;
  }
  return upper + name.slice(1);
}

function uniqueCodes(codes: string[]): string[] {
  return [...new Set(codes.map(code => code.trim()).filter(code => !!code))];
}

function escapeODataString(value: string): string {
  return value.replaceAll("'", "''");
}
