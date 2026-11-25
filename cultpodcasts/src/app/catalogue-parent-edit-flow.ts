import { HttpErrorResponse } from "@angular/common/http";
import { WritableSignal } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { firstValueFrom } from "rxjs";
import { AmbiguousNameCandidate } from "./ambiguous-name-candidate";
import { CatalogueHub } from "./catalogue-hub";
import { YouTubeIndexingHints } from "./youtube-indexing-hints.interface";
import { ConfirmComponent } from "./confirm/confirm.component";
import { CurationSubmitService } from "./curation-submit.service";
import { parseAmbiguousPodcastIds } from "./parse-ambiguous-podcast-ids";
import { resolveAmbiguousEditRows } from "./resolve-ambiguous-edit-rows";

type RowWithId = { id?: string | null };

export type NamedParentLoad<T> =
  | { kind: "loaded"; row: T }
  | { kind: "cancelled" }
  | { kind: "unrecoverable" };

/**
 * GET a catalogue parent by name. A 409 with a UUID list opens the same picker as submit.
 * Cancel and an unrecoverable conflict return without throwing. Any other error throws.
 */
export async function loadNamedCatalogueParent<T extends RowWithId>(options: {
  loadByName: () => Promise<T>;
  loadById: (id: string) => Promise<T | null>;
  dialog: MatDialog;
  name: string;
  title: string;
  itemNounPlural: string;
  toCandidate: (row: T) => AmbiguousNameCandidate;
  onCancelled: () => void;
}): Promise<NamedParentLoad<T>> {
  try {
    return { kind: "loaded", row: await options.loadByName() };
  } catch (error) {
    if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
      throw error;
    }
    const ids = parseAmbiguousPodcastIds(error.error);
    if (!ids) {
      return { kind: "unrecoverable" };
    }
    const outcome = await resolveAmbiguousEditRows(ids, options.loadById, options.dialog, options.name, {
      toCandidate: options.toCandidate,
      title: options.title,
      itemNounPlural: options.itemNounPlural
    });
    if (outcome.kind === "unrecoverable") {
      return { kind: "unrecoverable" };
    }
    if (outcome.kind === "cancelled") {
      options.onCancelled();
      return { kind: "cancelled" };
    }
    return { kind: "loaded", row: outcome.row };
  }
}

/** Removing cascades to every report or episode, so it takes an explicit Yes. */
export async function confirmCatalogueParentRemoval(
  dialog: MatDialog,
  label: string,
  name: string,
  itemNoun: string
): Promise<boolean> {
  const closed = await firstValueFrom(
    dialog
      .open(ConfirmComponent, {
        data: {
          title: `Remove ${label.toLowerCase()}?`,
          question: `"${name}" and all of its ${itemNoun} will be hidden from the site. Remove it?`
        }
      })
      .afterClosed()
  );
  return (closed as { result?: boolean } | undefined)?.result === true;
}

export type ForceWalkResult =
  | { kind: "cancelled" }
  | { kind: "unchanged" }
  | { kind: "refreshed"; hints: YouTubeIndexingHints | null };

/**
 * Confirms, clears indexing hints, then re-GETs. The acknowledgement is not the read model.
 * Snackbars stay here so both parent dialogs show the same copy.
 */
export async function forceFullCatalogueParentYouTubeWalk(options: {
  hub: CatalogueHub;
  parentId: string;
  dialog: MatDialog;
  curation: CurationSubmitService;
  snackBar: MatSnackBar;
  clearing: WritableSignal<boolean>;
}): Promise<ForceWalkResult> {
  const closed = await firstValueFrom(
    options.dialog
      .open(ConfirmComponent, {
        data: {
          title: "Force full YouTube walk?",
          question:
            "Clear indexing hints for this playlist? The next indexing pass will walk the whole playlist and write fresh hints."
        }
      })
      .afterClosed()
  );
  if ((closed as { result?: boolean } | undefined)?.result !== true) {
    return { kind: "cancelled" };
  }
  options.clearing.set(true);
  try {
    await firstValueFrom(
      options.curation.patchCatalogueParent(options.hub, options.parentId, {
        clearYouTubeIndexingHints: true
      })
    );
    const refreshed = await firstValueFrom(options.curation.getCatalogueParent(options.hub, options.parentId));
    const hints = refreshed.youTubeIndexingHints ?? null;
    if (hints != null) {
      options.snackBar.open("Could not clear indexing hints.", "Ok", { duration: 8000 });
    } else {
      options.snackBar.open("Indexing hints cleared. Next pass will do a full walk.", "Ok", { duration: 8000 });
    }
    return { kind: "refreshed", hints };
  } catch {
    options.snackBar.open("Could not clear indexing hints.", "Ok", { duration: 8000 });
    return { kind: "unchanged" };
  } finally {
    options.clearing.set(false);
  }
}
