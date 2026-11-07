import { MatDialog } from '@angular/material/dialog';
import { AmbiguousNameCandidate } from './ambiguous-name-candidate';
import { chooseAmbiguousNameOnConflict } from './submit-series-conflict';

/** Outcome of loading a 409 UUID list and letting the curator pick one row. */
export type ResolveAmbiguousEditResult<T> =
  | { kind: 'picked'; row: T }
  | { kind: 'cancelled' }
  | { kind: 'unrecoverable' };

type RowWithId = { id?: string | null };

/**
 * Shared 409 edit-path algorithm: load each id, require a full set with ids,
 * open the same-name picker, return the chosen domain row (or cancel / fail).
 * Hub-specific loaders stay as callbacks — do not force podcast through catalogue GET.
 */
export async function resolveAmbiguousEditRows<T extends RowWithId>(
  ids: string[],
  loadById: (id: string) => Promise<T | null>,
  dialog: MatDialog,
  name: string,
  options: {
    toCandidate: (row: T) => AmbiguousNameCandidate;
    title?: string;
    itemNounPlural?: string;
  }
): Promise<ResolveAmbiguousEditResult<T>> {
  const loaded: Array<T | null> = await Promise.all(
    ids.map(async (id) => {
      try {
        return await loadById(id);
      } catch {
        return null;
      }
    })
  );
  const rows: T[] = [];
  for (const row of loaded) {
    if (row != null && !!row.id) {
      rows.push(row);
    }
  }

  if (rows.length !== ids.length) {
    return { kind: 'unrecoverable' };
  }

  const picked = await chooseAmbiguousNameOnConflict(
    dialog,
    rows.map(options.toCandidate),
    name,
    { title: options.title, itemNounPlural: options.itemNounPlural }
  );

  if (!picked?.id) {
    return { kind: 'cancelled' };
  }

  const row = rows.find((r) => r.id === picked.id);
  if (!row) {
    return { kind: 'unrecoverable' };
  }
  return { kind: 'picked', row };
}
