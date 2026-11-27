import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from "@angular/material/snack-bar";
import { SearchIndexerState } from "@cultpodcasts/contracts";
import { CatalogueIndexDialogResult } from "./catalogue-index-response.interface";
import { indexStateMessage } from "./catalogue-index-state-message";

/**
 * Snackbars for a news outlet / TV show index, the same words as the hub menu.
 * `onReview` runs when the curator picks Review after items were updated.
 */
export function presentCatalogueIndexResult(
  snackBar: MatSnackBar,
  result: CatalogueIndexDialogResult | undefined,
  label: string,
  name: string,
  onReview: () => void
): void {
  if (!result) {
    return;
  }
  if (result.updated) {
    const count = result.itemIds?.length ?? 0;
    if (count === 0) {
      snackBar.open(`${label} indexed. Nothing new`, "Ok", { duration: 10000 });
      return;
    }
    const searchNote = result.searchIndexerState === SearchIndexerState.Failure ? ` ${indexStateMessage(result.searchIndexerState)}` : "";
    const items = `${count} item${count > 1 ? "s" : ""}`;
    const ref: MatSnackBarRef<TextOnlySnackBar> = snackBar.open(
      result.enrichOnly
        ? `${label} is not auto-indexed, so only Spotify / Apple links were looked up. ${items} updated.${searchNote}`
        : `${label} indexed. ${items} updated.${searchNote}`,
      "Review",
      { duration: 10000 }
    );
    ref.onAction().subscribe(() => onReview());
    return;
  }
  if (result.notIndexable) {
    snackBar.open(notIndexableMessage(label, result), "Ok", { duration: 10000 });
  } else if (result.notFound) {
    snackBar.open(`${label} not found`, "Ok", { duration: 10000 });
  } else if (result.ambiguous) {
    snackBar.open(`More than one ${label.toLowerCase()} is called "${name}". Nothing was indexed.`, "Ok", { duration: 10000 });
  } else if (result.enrichFailed) {
    snackBar.open(
      `${label} is not auto-indexed, so only Spotify / Apple links were looked up, but the lookup failed or was rate-limited. Try again later.`,
      "Ok",
      { duration: 10000 }
    );
  } else if (result.unavailable) {
    snackBar.open(`${label} indexing is unavailable right now. Try again later.`, "Ok", { duration: 10000 });
  } else if (result.timedOut) {
    snackBar.open(`${label} indexing ran out of time. Anything it saved will appear shortly; try again later.`, "Ok", { duration: 10000 });
  }
}

/** The toast for a 400 from the outlet / show index: says why it was not indexed (RPP #1400). */
export function notIndexableMessage(label: string, result: CatalogueIndexDialogResult): string {
  switch (result.reason) {
    case "Removed":
      return `${label} not indexed: it is removed`;
    case "NotAutoIndexed":
      return `${label} not indexed: it is not auto-indexed and has no Spotify or Apple id to look links up from`;
    case "NothingToEnrich":
      return `${label} is not auto-indexed, so only Spotify / Apple links were looked up. No recent item gained one`;
    case "SourcePodcastStillExists":
      return `${label} not indexable (its podcast still exists)`;
    default:
      return result.message ? `${label} not indexed: ${result.message}` : `${label} not indexable`;
  }
}
