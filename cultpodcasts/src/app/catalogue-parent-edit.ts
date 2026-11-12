import {
  AdditionalYouTubeChannelDto,
  CatalogueParentChangeRequest,
  CatalogueParentDto,
  NewsOrganisationChangeRequest,
  NewsOrganisationDto,
  NewsOrganisationYouTubeChannelsDto
} from "./catalogue-parent.interface";
import { episodeLanguageFormValue } from "./language-options.util";
import { includeTitleRegexBlocksIndexAllEpisodes } from "./podcast-form.util";

export { includeTitleRegexBlocksIndexAllEpisodes };

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

/**
 * String service ids loaded into the form model. `youTubeChannelId` is display-only and is never sent on save (see
 * `catalogueParentEditableServiceIdFields`); for the others "" clears, like the podcast edit API. `appleId` is numeric
 * and handled on its own.
 */
export const catalogueParentServiceIdFields = ["youTubeChannelId", "youTubePlaylistId", "spotifyId"] as const;

/**
 * Service ids a save may send. `youTubeChannelId` is shown read-only (podcast edit dialog parity): it is used for
 * API calls, so the dialog never sends it and saving can never change or blank the stored channel id.
 */
export const catalogueParentEditableServiceIdFields = ["youTubePlaylistId", "spotifyId"] as const;

/** A YouTube channel id: `UC` followed by 22 characters (same rule as the RPP #1370 PATCH check). */
const youTubeChannelIdPattern = /^UC[A-Za-z0-9_-]{22}$/;

/** One editable additional YouTube channel row (news organisations, RPP #1370). Blank playlist = the whole channel. */
export interface AdditionalYouTubeChannelRow {
  youTubeChannelId: string;
  youTubePlaylistId: string;
}

/**
 * Editable rows for the outlet's additional YouTube channels. Reads `additionalYouTubeChannels` (channel + optional
 * playlist); falls back to the older ids-only `additionalYouTubeChannelIds` (each channel-wide) when the API did not
 * return the newer field.
 */
export function additionalYouTubeChannelRows(dto: NewsOrganisationYouTubeChannelsDto): AdditionalYouTubeChannelRow[] {
  if (Array.isArray(dto.additionalYouTubeChannels)) {
    return dto.additionalYouTubeChannels.map((channel) => ({
      youTubeChannelId: channel.youTubeChannelId ?? "",
      youTubePlaylistId: channel.youTubePlaylistId ?? ""
    }));
  }
  return (dto.additionalYouTubeChannelIds ?? []).map((id) => ({ youTubeChannelId: id, youTubePlaylistId: "" }));
}

/**
 * The additional YouTube channels as the PATCH sends them (RPP #1370): ids trimmed, rows without a channel id
 * dropped, repeats of a channel dropped (first kept), and `youTubePlaylistId` only when the row has one.
 */
export function normaliseAdditionalYouTubeChannels(rows: readonly AdditionalYouTubeChannelRow[]): AdditionalYouTubeChannelDto[] {
  const seen = new Set<string>();
  const result: AdditionalYouTubeChannelDto[] = [];
  for (const row of rows) {
    const channel = row.youTubeChannelId.trim();
    if (!channel || seen.has(channel)) {
      continue;
    }
    seen.add(channel);
    const playlist = row.youTubePlaylistId.trim();
    result.push(playlist ? { youTubeChannelId: channel, youTubePlaylistId: playlist } : { youTubeChannelId: channel });
  }
  return result;
}

function sameAdditionalChannels(before: readonly AdditionalYouTubeChannelDto[], after: readonly AdditionalYouTubeChannelDto[]): boolean {
  return (
    before.length === after.length &&
    before.every(
      (channel, i) =>
        channel.youTubeChannelId === after[i].youTubeChannelId &&
        (channel.youTubePlaylistId ?? "") === (after[i].youTubePlaylistId ?? "")
    )
  );
}

/**
 * Curator copy when the news outlet's additional YouTube channels cannot be saved, or null when they can. Mirrors
 * the API's 400s (`invalidAdditionalYouTubeChannelId`, `additionalYouTubeChannelIsMainChannel`) so Save is blocked
 * before the request. Fully blank rows are ignored (they are dropped on save). Whether a playlist exists and is on
 * that channel is checked by the API (the main-channel playlist codes).
 */
export function additionalYouTubeChannelsError(
  rows: readonly AdditionalYouTubeChannelRow[],
  mainChannelId: string | null | undefined
): string | null {
  const orphan = rows.find((row) => !row.youTubeChannelId.trim() && row.youTubePlaylistId.trim());
  if (orphan !== undefined) {
    return `Playlist '${orphan.youTubePlaylistId.trim()}' needs the YouTube channel id it belongs to.`;
  }
  const filled = rows
    .map((row) => ({ channel: row.youTubeChannelId.trim(), playlist: row.youTubePlaylistId.trim() }))
    .filter((row) => row.channel);
  const invalid = filled.find((row) => !youTubeChannelIdPattern.test(row.channel));
  if (invalid !== undefined) {
    return `'${invalid.channel}' is not a YouTube channel id (UC followed by 22 letters, digits, - or _).`;
  }
  const main = (mainChannelId ?? "").trim();
  if (main && filled.some((row) => row.channel === main)) {
    return `'${main}' is the main YouTube channel; it cannot also be an additional channel.`;
  }
  const playlists = new Map<string, string>();
  for (const row of filled) {
    const previous = playlists.get(row.channel);
    if (previous !== undefined && previous !== row.playlist) {
      return `'${row.channel}' is listed more than once with different playlists; keep one row per channel.`;
    }
    playlists.set(row.channel, row.playlist);
  }
  return null;
}

/** Indexing regexes on the parent's `indexing` block (podcast Regexs tab parity). */
export const catalogueParentRegexFields = [
  "titleRegex",
  "descriptionRegex",
  "episodeMatchRegex",
  "episodeIncludeTitleRegex"
] as const;

/** TimeSpan text fields on `indexing` (podcast Details / Meta tab parity): "" clears. */
export const catalogueParentDurationFields = ["minimumDuration", "youTubePublicationDelay"] as const;

/**
 * Podcast Flags tab parity, kept on `indexing`. `skipEnrichingFromYouTube` is podcast-only in the UI: news / TV
 * dialogs neither show nor send it, so a stored value is left as it is.
 */
export const catalogueParentFlagFields = [
  "bypassShortEpisodeChecking",
  "alwaysPromoteAsHero",
  "ignoreAllEpisodes"
] as const;

/** Release-authority select options; "Unset" clears (podcast Meta tab parity). */
export const releaseAuthorityOptions = ["Unset", "Spotify", "Apple", "YouTube"] as const;

/**
 * `[-][d.]hh:mm[:ss[.fffffff]]`, or the `[-]d:h:mm:ss[.fffffff]` form .NET's "g" format (used by Functions for
 * `youTubePublicationDelay`) gives a span of a day or more, e.g. `1:0:00:00`. Functions parses both.
 */
const durationPattern = /^-?(?:\d+:\d{1,2}:\d{2}:\d{2}(\.\d{1,7})?|(\d+\.)?\d{1,2}:\d{1,2}(:\d{1,2}(\.\d{1,7})?)?)$/;

/** Blank (clear) or a TimeSpan such as `00:01:30`, `-1:00:00` or `1:0:00:00`. Save is blocked otherwise. */
export function isValidDurationText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === "" || durationPattern.test(trimmed);
}

type TextField =
  | typeof catalogueParentTextFields[number]
  | typeof tvShowIdentityFields[number]
  | typeof catalogueParentServiceIdFields[number]
  | typeof catalogueParentRegexFields[number]
  | typeof catalogueParentDurationFields[number];
type FlagField = typeof catalogueParentFlagFields[number];
type ListField = typeof catalogueParentListFields[number];

/**
 * `appleId` is edited as text so a blank field can mean "clear". `language` is a language-select key
 * ("unset" = the "No Language" option, stored blank). `ignoredSubjects` is the multi-select value.
 */
export type CatalogueParentEditModel = Record<TextField, string> & Record<ListField, string> & Record<FlagField, boolean> & {
  removed: boolean;
  /** A `releaseAuthorityOptions` value; "Unset" = none. */
  releaseAuthority: string;
  indexAllEpisodes: boolean;
  appleId: string;
  tvdbId: string;
  tmdbId: string;
  language: string;
  ignoredSubjects: string[];
};

/**
 * News-organisation edit model: the shared fields plus the outlet's additional YouTube channel rows
 * (RPP #1370). The field lives only here, matching the DTO split (RPP #1392): a TV show's
 * {@link CatalogueParentEditModel} does not declare it, so the compiler rejects reading or sending it
 * on a TV path.
 */
export type NewsOrganisationEditModel = CatalogueParentEditModel & {
  additionalYouTubeChannels: AdditionalYouTubeChannelRow[];
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

/**
 * `yyyy-MM-dd` (UTC) for a playlist history `replacedAt`. Same rules as
 * {@link utcCalendarDateText} (Date after JsonDateInterceptor, or ISO / date text).
 */
export { utcCalendarDateText as historyDateText } from './utc-calendar-date';

export function listToText(values: string[] | null | undefined): string {
  return (values ?? []).join(", ");
}

export function textToList(text: string): string[] {
  return text
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/** Edit model of the shared fields. Additional YouTube channels are not present: see {@link newsOrganisationEditModel}. */
export function catalogueParentEditModel(dto: CatalogueParentDto): CatalogueParentEditModel {
  const model = {
    removed: dto.removed === true,
    indexAllEpisodes: dto.indexAllEpisodes === true,
    appleId: dto.appleId == null ? "" : String(dto.appleId),
    tvdbId: dto.tvdbId ? String(dto.tvdbId) : "",
    tmdbId: dto.tmdbId ? String(dto.tmdbId) : "",
    language: catalogueParentLanguageFormValue(dto.language),
    ignoredSubjects: [...(dto.ignoredSubjects ?? [])],
    releaseAuthority: dto.releaseAuthority || "Unset"
  } as CatalogueParentEditModel;
  for (const field of catalogueParentFlagFields) {
    model[field] = dto[field] === true;
  }
  for (const field of [
    ...catalogueParentTextFields,
    ...tvShowIdentityFields,
    ...catalogueParentServiceIdFields,
    ...catalogueParentRegexFields,
    ...catalogueParentDurationFields
  ]) {
    model[field] = (dto[field] ?? "").toString();
  }
  for (const field of catalogueParentListFields) {
    model[field] = listToText(dto[field]);
  }
  if (includeTitleRegexBlocksIndexAllEpisodes(model.episodeIncludeTitleRegex)) {
    model.indexAllEpisodes = false;
  }
  return model;
}

/** Edit model of a news organisation: the shared fields plus its additional YouTube channel rows (RPP #1370). */
export function newsOrganisationEditModel(dto: NewsOrganisationDto): NewsOrganisationEditModel {
  return { ...catalogueParentEditModel(dto), additionalYouTubeChannels: additionalYouTubeChannelRows(dto) };
}

/** True when this save would remove (hide) the outlet / show and so cascade to its reports / episodes. */
export function removesCatalogueParent(changes: CatalogueParentChangeRequest): boolean {
  return changes.removed === true;
}

/**
 * Only the fields the curator changed. A cleared string is sent as "" and a cleared list as [];
 * "No Subject" is "" and "No Language" ("unset") is language "",
 * which the API treats as "clear"; a cleared `appleId` is `nullAppleId: true`; untouched fields are omitted
 * ("unchanged"). An invalid `appleId` or duration text is ignored here; the dialog blocks Save on it.
 * Flags send `true` / `false` when toggled; a cleared release authority is `unsetReleaseAuthority: true`.
 * `youTubeChannelId` is read-only and never sent. Only shared fields: a news organisation's additional YouTube
 * channels are added by {@link newsOrganisationChanges}, so a TV show never sends them.
 */
export function catalogueParentChanges(
  original: CatalogueParentDto,
  edited: CatalogueParentEditModel,
  includeTvIdentity: boolean
): CatalogueParentChangeRequest {
  const changes: CatalogueParentChangeRequest = {};
  // Excluding the read-only channel id here means the compiler rejects any attempt to send it.
  const textFields: readonly Exclude<TextField, "youTubeChannelId">[] = includeTvIdentity
    ? [
        ...catalogueParentTextFields,
        ...tvShowIdentityFields,
        ...catalogueParentEditableServiceIdFields,
        ...catalogueParentRegexFields
      ]
    : [...catalogueParentTextFields, ...catalogueParentEditableServiceIdFields, ...catalogueParentRegexFields];
  for (const field of textFields) {
    const before = (original[field] ?? "").toString().trim();
    const after = edited[field].trim();
    if (before !== after) {
      changes[field] = after;
    }
  }
  for (const field of catalogueParentDurationFields) {
    const after = edited[field].trim();
    if (!isValidDurationText(after)) {
      continue;
    }
    const before = (original[field] ?? "").toString().trim();
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
  for (const field of catalogueParentFlagFields) {
    if ((original[field] === true) !== edited[field]) {
      changes[field] = edited[field];
    }
  }
  const releaseAuthorityBefore = original.releaseAuthority || "Unset";
  if (releaseAuthorityBefore !== edited.releaseAuthority) {
    if (edited.releaseAuthority === "Unset") {
      changes.unsetReleaseAuthority = true;
    } else {
      changes.releaseAuthority = edited.releaseAuthority;
    }
  }
  if ((original.removed === true) !== edited.removed) {
    changes.removed = edited.removed;
  }
  const indexAllBlocked = includeTitleRegexBlocksIndexAllEpisodes(edited.episodeIncludeTitleRegex);
  const indexAllAfter = indexAllBlocked ? false : edited.indexAllEpisodes;
  if ((original.indexAllEpisodes === true) !== indexAllAfter) {
    changes.indexAllEpisodes = indexAllAfter;
  }
  return changes;
}

/**
 * A news organisation's changed fields: {@link catalogueParentChanges} plus `additionalYouTubeChannels` (channel id
 * plus optional playlist id) as the whole normalised list when it changed (`[]` when every row was removed). The older
 * `additionalYouTubeChannelIds` is never sent (the API refuses both together).
 */
export function newsOrganisationChanges(
  original: NewsOrganisationDto,
  edited: NewsOrganisationEditModel
): NewsOrganisationChangeRequest {
  const changes: NewsOrganisationChangeRequest = catalogueParentChanges(original, edited, false);
  const channelsAfter = normaliseAdditionalYouTubeChannels(edited.additionalYouTubeChannels);
  const channelsBefore = normaliseAdditionalYouTubeChannels(additionalYouTubeChannelRows(original));
  if (!sameAdditionalChannels(channelsBefore, channelsAfter)) {
    changes.additionalYouTubeChannels = channelsAfter;
  }
  return changes;
}
