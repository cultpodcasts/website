import { LANGUAGES } from "./languages";
import { SearchResultFacet } from "./search-result-facet.interface";

export const ENGLISH_LANGUAGE_VALUE = "__english__";
export const ALL_LANGUAGES_VALUE = "__all__";

export type SubjectLanguageSelection =
  | { mode: "english" }
  | { mode: "all" }
  | { mode: "codes"; codes: string[] }
  | { mode: "englishAndCodes"; codes: string[] };

/** Explicit `en` / `en-*` facets are English (legacy); fold into the synthetic English chip. */
export function isEnglishLanguageFacetCode(code: string | null | undefined): boolean {
  if (!code?.trim()) {
    return false;
  }
  const lower = code.trim().toLowerCase().replace("_", "-");
  return lower === "en" || lower.startsWith("en-");
}

/**
 * OData clause matching product English: null (default) plus exact legacy `en`.
 * Azure AI Search does not support OData `startswith`; do not use prefix matching here.
 * Facet UI still folds any `en-*` buckets into the English chip via isEnglishLanguageFacetCode.
 */
const ENGLISH_LANG_ODATA = "(lang eq null or lang eq 'en')";

export function buildSubjectLangFilter(selection: SubjectLanguageSelection): string {
  if (selection.mode === "all") {
    return "";
  }
  if (selection.mode === "english") {
    return ` and ${ENGLISH_LANG_ODATA}`;
  }

  const codes = uniqueCodes(selection.codes).filter(code => !isEnglishLanguageFacetCode(code));
  if (!codes.length) {
    return ` and ${ENGLISH_LANG_ODATA}`;
  }

  const delimiter = ",";
  const list = codes.map(escapeODataString).join(delimiter);
  const codesFilter = `search.in(lang, '${list}', '${delimiter}')`;
  if (selection.mode === "englishAndCodes") {
    return ` and (${ENGLISH_LANG_ODATA} or ${codesFilter})`;
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
    .filter(value => value !== ENGLISH_LANGUAGE_VALUE && value !== ALL_LANGUAGES_VALUE)
    .filter(value => !isEnglishLanguageFacetCode(value));

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
  const nonEnglish = (langFacets ?? [])
    .filter(facet => facet.value && !isEnglishLanguageFacetCode(facet.value))
    .reduce((sum, facet) => sum + (facet.count ?? 0), 0);
  return Math.max(0, subjectTotal - nonEnglish);
}

/** Chip values that have episodes under the current subject (+ optional show) filter. */
export function availableLanguageChipValues(
  scopedTotal: number,
  langFacets: SearchResultFacet[] | undefined
): string[] {
  const chips: string[] = [];
  if (englishFacetCount(scopedTotal, langFacets) > 0) {
    chips.push(ENGLISH_LANGUAGE_VALUE);
  }
  for (const facet of langFacets ?? []) {
    if (facet.value && (facet.count ?? 0) > 0 && !isEnglishLanguageFacetCode(facet.value)) {
      chips.push(facet.value);
    }
  }
  return chips;
}

/** True when the active language filter can match any of the available chip values. */
export function languageSelectionIntersectsAvailable(
  selection: SubjectLanguageSelection,
  availableChips: string[]
): boolean {
  if (selection.mode === "all") {
    return true;
  }
  if (availableChips.length === 0) {
    return false;
  }
  if (selection.mode === "english") {
    return availableChips.includes(ENGLISH_LANGUAGE_VALUE);
  }
  if (selection.mode === "codes") {
    return selection.codes.some(code => availableChips.includes(code));
  }
  return availableChips.includes(ENGLISH_LANGUAGE_VALUE)
    || selection.codes.some(code => availableChips.includes(code));
}

/**
 * When a specific language filter would match nothing but other languages have
 * episodes (initial subject load, or after show selection changes), widen to All
 * — not a specific code — so the user is not stuck on an empty English/default
 * filter and later show picks are not stuck on a narrow auto-selected code.
 * Returns chip values to apply, or null when the current selection should stay.
 */
export function reconcileLanguageChipsForPodcasts(
  selection: SubjectLanguageSelection,
  availableChips: string[]
): string[] | null {
  if (languageSelectionIntersectsAvailable(selection, availableChips)) {
    return null;
  }
  if (availableChips.length === 0) {
    return null;
  }
  return [ALL_LANGUAGES_VALUE];
}

export function hasNonEnglishFacets(langFacets: SearchResultFacet[] | undefined): boolean {
  return (langFacets ?? []).some(
    facet => !!facet.value && (facet.count ?? 0) > 0 && !isEnglishLanguageFacetCode(facet.value));
}

// The Languages panel is pointless when a subject only has English/default
// results — hide it unless other languages exist, or a non-default selection
// is active (so the user can always switch back).
export function shouldShowLanguageSelector(
  langFacets: SearchResultFacet[] | undefined,
  selection: SubjectLanguageSelection
): boolean {
  return hasNonEnglishFacets(langFacets) || selection.mode !== "english";
}

// Facet buckets plus any actively selected codes missing from the current
// facets (count 0), so an active selection never disappears from the chips.
export function displayedLanguageOptions(
  langFacets: SearchResultFacet[] | undefined,
  selection: SubjectLanguageSelection
): SearchResultFacet[] {
  const facets = (langFacets ?? []).filter(
    facet => !!facet.value && (facet.count ?? 0) > 0 && !isEnglishLanguageFacetCode(facet.value));
  const selectedCodes = selection.mode === "codes" || selection.mode === "englishAndCodes"
    ? selection.codes.filter(code => !isEnglishLanguageFacetCode(code))
    : [];
  const missing = uniqueCodes(selectedCodes)
    .filter(code => !facets.some(facet => facet.value === code))
    .map(value => ({ value, count: 0 }));
  return [...facets, ...missing];
}

export function languageLabel(code: string): string {
  const normalized = (code ?? "").trim().toLowerCase();
  // Region subtags (e.g. pt-BR) fall back to the base language entry.
  const names = LANGUAGES[normalized] ?? LANGUAGES[normalized.split("-")[0]];
  if (!names) {
    return code;
  }
  if (names.english.toLowerCase() === names.local.toLowerCase()) {
    return names.english;
  }
  return `${names.english} (${names.local})`;
}

function uniqueCodes(codes: string[]): string[] {
  return [...new Set(codes.map(code => code.trim()).filter(code => !!code))];
}

function escapeODataString(value: string): string {
  return value.replaceAll("'", "''");
}
