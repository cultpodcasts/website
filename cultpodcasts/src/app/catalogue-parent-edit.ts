import { CatalogueParentChangeRequest, CatalogueParentDto } from "./catalogue-parent.interface";
import { episodeLanguageFormValue } from "./language-options.util";

/**
 * Editable text fields, in form order. `defaultSubject` is a subject select ("" = No Subject).
 * `language` (select, "unset" = the "No Language" option) and `ignoredSubjects` (multi-select) are handled on their own,
 * like the podcast edit dialog; the other lists are edited as comma-separated text.
 */
export const catalogueParentTextFields = [
  "publisher",
  "description",
  "twitterHandle",
  "blueskyHandle",
  "hashTag",
  "searchTerms",
  "defaultSubject"
] as const;

export const catalogueParentListFields = [
  "enrichmentHashTags",
  "knownTerms",
  "ignoredAssociatedSubjects"
] as const;

/** TV show IMDb title id (`tt…`): "" clears. */
export const tvShowIdentityFields = ["imdbId"] as const;

/** TV show numeric ids, edited as text: blank clears (`0`). */
export const tvShowNumericIdFields = ["tvdbId", "tmdbId"] as const;

const imdbIdPattern = /^tt\d{7,10}$/;
const digitsPattern = /^\d*$/;

/** Blank (clear) or an IMDb `tt` id. Save is blocked otherwise. */
export function isValidImdbIdText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === "" || imdbIdPattern.test(trimmed);
}

/** Blank (clear) or digits only. Save is blocked otherwise. */
export function isValidNumericIdText(text: string): boolean {
  return digitsPattern.test(text.trim());
}

/** String service ids: "" clears, like the podcast edit API. `appleId` is numeric and handled on its own. */
export const catalogueParentServiceIdFields = ["youTubeChannelId", "youTubePlaylistId", "spotifyId"] as const;

type TextField =
  | typeof catalogueParentTextFields[number]
  | typeof tvShowIdentityFields[number]
  | typeof catalogueParentServiceIdFields[number];
type ListField = typeof catalogueParentListFields[number];

/**
 * `appleId` is edited as text so a blank field can mean "clear". `language` is a language-select key
 * ("unset" = the "No Language" option, stored blank). `ignoredSubjects` is the multi-select value.
 */
export type CatalogueParentEditModel = Record<TextField, string> & Record<ListField, string> & {
  removed: boolean;
  appleId: string;
  tvdbId: string;
  tmdbId: string;
  language: string;
  ignoredSubjects: string[];
};

/** Language-select key for the API value: blank or English → "unset" (the "No Language" option), like the episode language picker. */
export function catalogueParentLanguageFormValue(language: string | null | undefined): string {
  return episodeLanguageFormValue(language);
}

function sameList(before: readonly string[], after: readonly string[]): boolean {
  return before.length === after.length && before.every((value, i) => value === after[i]);
}

/**
 * Subject-select options in the podcast dialog's order: the current values first, then the rest
 * of the subjects. Current values missing from the subjects list are kept so they stay selected.
 */
export function subjectOptions(current: readonly string[], subjects: readonly string[]): string[] {
  const head = current.filter((value) => value.length > 0);
  const seen = new Set(head);
  return [...head, ...subjects.filter((name) => !seen.has(name))];
}

const appleIdPattern = /^\d+$/;

/** Blank (clear) or a whole number. Save is blocked otherwise. */
export function isValidAppleIdText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === "" || appleIdPattern.test(trimmed);
}

export function listToText(values: string[] | null | undefined): string {
  return (values ?? []).join(", ");
}

export function textToList(text: string): string[] {
  return text
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function catalogueParentEditModel(dto: CatalogueParentDto): CatalogueParentEditModel {
  const model = {
    removed: dto.removed === true,
    appleId: dto.appleId == null ? "" : String(dto.appleId),
    tvdbId: dto.tvdbId ? String(dto.tvdbId) : "",
    tmdbId: dto.tmdbId ? String(dto.tmdbId) : "",
    language: catalogueParentLanguageFormValue(dto.language),
    ignoredSubjects: [...(dto.ignoredSubjects ?? [])]
  } as CatalogueParentEditModel;
  for (const field of [...catalogueParentTextFields, ...tvShowIdentityFields, ...catalogueParentServiceIdFields]) {
    model[field] = (dto[field] ?? "").toString();
  }
  for (const field of catalogueParentListFields) {
    model[field] = listToText(dto[field]);
  }
  return model;
}

/** True when this save would remove (hide) the outlet / show and so cascade to its reports / episodes. */
export function removesCatalogueParent(changes: CatalogueParentChangeRequest): boolean {
  return changes.removed === true;
}

/**
 * Only the fields the curator changed. A cleared string is sent as "" and a cleared list as [];
 * "No Subject" is "" and "No Language" ("unset") is language "",
 * which the API treats as "clear"; a cleared `appleId` is `nullAppleId: true`; untouched fields are omitted
 * ("unchanged"). An invalid `appleId` text is ignored here; the dialog blocks Save on it.
 */
export function catalogueParentChanges(
  original: CatalogueParentDto,
  edited: CatalogueParentEditModel,
  includeTvIdentity: boolean
): CatalogueParentChangeRequest {
  const changes: CatalogueParentChangeRequest = {};
  const textFields: readonly TextField[] = includeTvIdentity
    ? [...catalogueParentTextFields, ...tvShowIdentityFields, ...catalogueParentServiceIdFields]
    : [...catalogueParentTextFields, ...catalogueParentServiceIdFields];
  for (const field of textFields) {
    const before = (original[field] ?? "").toString().trim();
    const after = edited[field].trim();
    if (before !== after) {
      changes[field] = after;
    }
  }
  for (const field of catalogueParentListFields) {
    const before = original[field] ?? [];
    const after = textToList(edited[field]);
    if (!sameList(before, after)) {
      changes[field] = after;
    }
  }
  if (!sameList(original.ignoredSubjects ?? [], edited.ignoredSubjects)) {
    changes.ignoredSubjects = [...edited.ignoredSubjects];
  }
  if (catalogueParentLanguageFormValue(original.language) !== edited.language) {
    changes.language = edited.language === "unset" ? "" : edited.language;
  }
  const appleText = edited.appleId.trim();
  const appleBefore = original.appleId ?? null;
  if (appleText === "") {
    if (appleBefore != null) {
      changes.nullAppleId = true;
    }
  } else if (appleIdPattern.test(appleText) && Number(appleText) !== appleBefore) {
    changes.appleId = Number(appleText);
  }
  if (includeTvIdentity) {
    for (const field of tvShowNumericIdFields) {
      const text = edited[field].trim();
      if (!digitsPattern.test(text)) {
        continue;
      }
      const after = text === "" ? 0 : Number(text);
      if (after !== (original[field] ?? 0)) {
        changes[field] = after;
      }
    }
  }
  if ((original.removed === true) !== edited.removed) {
    changes.removed = edited.removed;
  }
  return changes;
}
