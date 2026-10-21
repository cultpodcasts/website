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

type TextField = typeof catalogueParentTextFields[number] | typeof tvShowIdentityFields[number];
type ListField = typeof catalogueParentListFields[number];

export type CatalogueParentEditModel = Record<TextField, string> & Record<ListField, string> & { removed: boolean };

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
  const model = { removed: dto.removed === true } as CatalogueParentEditModel;
  for (const field of [...catalogueParentTextFields, ...tvShowIdentityFields]) {
    model[field] = (dto[field] ?? "").toString();
  }
  for (const field of catalogueParentListFields) {
    model[field] = listToText(dto[field]);
  }
  return model;
}

/**
 * Only the fields the curator changed. A cleared string is sent as "" and a cleared list as [],
 * which the API treats as "clear"; untouched fields are omitted ("unchanged").
 */
export function catalogueParentChanges(
  original: CatalogueParentDto,
  edited: CatalogueParentEditModel,
  includeTvIdentity: boolean
): CatalogueParentChangeRequest {
  const changes: CatalogueParentChangeRequest = {};
  const textFields: readonly TextField[] = includeTvIdentity
    ? [...catalogueParentTextFields, ...tvShowIdentityFields]
    : catalogueParentTextFields;
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
  if ((original.removed === true) !== edited.removed) {
    changes.removed = edited.removed;
  }
  return changes;
}
