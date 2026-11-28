import { HttpErrorResponse } from '@angular/common/http';
import { TRAILER_PARENT_LABELS, TrailerParentKind } from './trailer';
import { isGuid } from './tv-show-target.util';

/**
 * Where an episode's trailer goes, shared by the film "Attach as trailer" and TV show "Attach as TV trailer/clip"
 * dialogs: a parent id (picked from the suggestions, with its name, or pasted), a parent to create (or join, by name),
 * or an existing parent named but not yet resolved to an id.
 */
export type TrailerTarget =
  | { kind: 'id'; id: string; name?: string }
  | { kind: 'create'; name: string; publisher?: string }
  | { kind: 'name'; name: string };

/** A pasted parent id (any case) as an id target, or null when the text is not a GUID. */
export function idTargetFromText(text: string): TrailerTarget | null {
  const trimmed = text.trim();
  return isGuid(trimmed) ? { kind: 'id', id: trimmed.toLowerCase() } : null;
}

/**
 * The target for the text typed in a parent picker: a pasted id, else a name to create (when `create` is set, with
 * the trimmed `publisher` if any) or to resolve. Null for blank text, or a name with '/' (it cannot be a name).
 */
export function trailerTargetFromText(
  text: string,
  options: { create: boolean; publisher?: string }
): TrailerTarget | null {
  const name = text.trim();
  if (name.length === 0) {
    return null;
  }
  const pasted = idTargetFromText(name);
  if (pasted) {
    return pasted;
  }
  if (name.includes('/')) {
    return null;
  }
  if (options.create) {
    const publisher = (options.publisher ?? '').trim();
    return { kind: 'create', name, ...(publisher ? { publisher } : {}) };
  }
  return { kind: 'name', name };
}

/** A typed name that can become a new parent from a suggestion list: at least 2 characters, not an id, no '/'. */
export function creatableParentName(text: string): string | null {
  const name = text.trim();
  return name.length >= 2 && !isGuid(name) && !name.includes('/') ? name : null;
}

/**
 * Orders async suggestion lookups: each keystroke calls {@link begin}, and a lookup that comes back after a later
 * keystroke began is stale ({@link isLatest} is false), so its results are dropped.
 */
export class SuggestionQueryGuard {
  private version = 0;

  begin(): number {
    return ++this.version;
  }

  isLatest(token: number): boolean {
    return token === this.version;
  }
}

/**
 * The curator message for a failed attach (the POST of an episode as a film trailer or TV trailer/clip). The server's
 * own text wins for 400, 404 and 409. Any other status resumes: sending again completes an interrupted attach.
 */
export function attachTrailerErrorMessage(e: HttpErrorResponse, parent: TrailerParentKind): string {
  const { noun, attach } = TRAILER_PARENT_LABELS[parent];
  const body = e.error as { error?: string } | null | undefined;
  switch (e.status) {
    case 400:
      return body?.error ?? `The episode cannot be attached as a ${attach}.`;
    case 404:
      return body?.error ?? `The episode or ${noun} was not found. The episode may already be a trailer of a ${noun}.`;
    case 409:
      return body?.error ?? `This episode is already a trailer of another ${noun}, or is being attached right now. Try again shortly.`;
    default:
      return `An error occurred attaching the ${attach}. Sending again resumes an interrupted attach.`;
  }
}
