import { LANGUAGES } from "./languages";
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
