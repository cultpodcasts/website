import { CatalogueParentChangeRequest, CatalogueParentDto } from "./catalogue-parent.interface";

/** Editable text fields, in form order. Lists are edited as comma-separated text. */
export const catalogueParentTextFields = [
  "publisher",
  "description",
  "language",
  "twitterHandle",
  "blueskyHandle",
  "hashTag",
  "searchTerms",
  "defaultSubject"
] as const;

export const catalogueParentListFields = [
  "enrichmentHashTags",
  "knownTerms",
  "ignoredSubjects",
  "ignoredAssociatedSubjects"
] as const;

export const tvShowIdentityFields = ["imdb", "tvdb"] as const;

/** String service ids: "" clears, like the podcast edit API. `appleId` is numeric and handled on its own. */
export const catalogueParentServiceIdFields = ["youTubeChannelId", "youTubePlaylistId", "spotifyId"] as const;

type TextField =
  | typeof catalogueParentTextFields[number]
  | typeof tvShowIdentityFields[number]
  | typeof catalogueParentServiceIdFields[number];
type ListField = typeof catalogueParentListFields[number];

/** `appleId` is edited as text so a blank field can mean "clear". */
export type CatalogueParentEditModel = Record<TextField, string> & Record<ListField, string> & {
  removed: boolean;
  appleId: string;
};

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
    appleId: dto.appleId == null ? "" : String(dto.appleId)
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
 * Only the fields the curator changed. A cleared string is sent as "" and a cleared list as [],
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
    if (before.length !== after.length || before.some((value, i) => value !== after[i])) {
      changes[field] = after;
    }
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
  if ((original.removed === true) !== edited.removed) {
    changes.removed = edited.removed;
  }
  return changes;
}
