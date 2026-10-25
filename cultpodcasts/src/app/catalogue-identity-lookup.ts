import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, Observable } from 'rxjs';
import { promptAmbiguousIdentity } from './submit-language-identity-prompts';
import {
  CatalogueIdentityIds,
  CatalogueIdentityLookupRequest,
  CatalogueIdentityLookupResponse
} from './catalogue-identity-lookup.interface';

export type CatalogueIdentityLookupOutcome =
  | { kind: 'matched'; ids: CatalogueIdentityIds; parentIds?: CatalogueIdentityIds | null }
  | { kind: 'noMatch'; message: string }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

const MAX_ROUNDS = 4;

type AmbiguousPrompt = typeof promptAmbiguousIdentity;

/**
 * Edit-time Identity lookup loop: probe → ambiguous picker → select re-POST.
 * Continue / cancel leave the form unchanged.
 */
export async function runCatalogueIdentityLookup(
  dialog: MatDialog,
  post: (body: CatalogueIdentityLookupRequest) => Observable<CatalogueIdentityLookupResponse>,
  request: CatalogueIdentityLookupRequest,
  prompt: AmbiguousPrompt = promptAmbiguousIdentity
): Promise<CatalogueIdentityLookupOutcome> {
  let body: CatalogueIdentityLookupRequest = { ...request };
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await firstValueFrom(post(body));
      if (response.status === 'Matched') {
        return {
          kind: 'matched',
          ids: response.ids ?? {},
          parentIds: response.parentIds
        };
      }
      if (response.status === 'NoMatch') {
        return {
          kind: 'noMatch',
          message: response.message?.trim() || 'No confident identity match.'
        };
      }
      const decision = response.identityDecision;
      if (!decision?.candidates?.length) {
        return { kind: 'noMatch', message: 'No confident identity match.' };
      }
      const answer = await prompt(dialog, {
        target: decision.target,
        query: decision.query,
        candidates: decision.candidates,
        context: 'edit'
      });
      if (!answer || answer.decision === 'cancel' || answer.decision === 'continue') {
        return { kind: 'cancelled' };
      }
      body = {
        ...request,
        identityDecision: 'select',
        selectedIdentityKey: answer.key
      };
    }
    return { kind: 'error', message: 'Identity lookup stopped after too many prompts.' };
  } catch {
    return { kind: 'error', message: 'Identity lookup failed.' };
  }
}

/** Fill blank identity fields only (never overwrite curator-entered values). */
export function applyIdentityIds(
  current: { imdbId?: string | null; tmdbId?: string | number | null; tvdbId?: string | number | null },
  ids: CatalogueIdentityIds | null | undefined
): { imdbId?: string; tmdbId?: string; tvdbId?: string; changed: boolean } {
  const next: { imdbId?: string; tmdbId?: string; tvdbId?: string; changed: boolean } = { changed: false };
  if (!ids) {
    return next;
  }
  const imdbBlank = !(current.imdbId ?? '').toString().trim();
  if (imdbBlank && ids.imdbId?.trim()) {
    next.imdbId = ids.imdbId.trim();
    next.changed = true;
  }
  const tmdbRaw = (current.tmdbId ?? '').toString().trim();
  const tmdbBlank = !tmdbRaw || tmdbRaw === '0';
  if (tmdbBlank && ids.tmdbId != null && ids.tmdbId > 0) {
    next.tmdbId = String(ids.tmdbId);
    next.changed = true;
  }
  const tvdbRaw = (current.tvdbId ?? '').toString().trim();
  const tvdbBlank = !tvdbRaw || tvdbRaw === '0';
  if (tvdbBlank && ids.tvdbId != null && ids.tvdbId > 0) {
    next.tvdbId = String(ids.tvdbId);
    next.changed = true;
  }
  return next;
}

/** Year from a film release control (`yyyy` or `yyyy-MM-dd`). */
export function filmReleaseYear(release: string | null | undefined): number | undefined {
  const trimmed = (release ?? '').trim();
  if (trimmed.length < 4) {
    return undefined;
  }
  const year = Number.parseInt(trimmed.slice(0, 4), 10);
  return year > 0 ? year : undefined;
}
