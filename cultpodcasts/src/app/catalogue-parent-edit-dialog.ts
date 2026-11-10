import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Observable, tap } from "rxjs";
import { ApiEpisode } from "./api-episode.interface";
import { CatalogueHub, hubParentLabel } from "./catalogue-hub";
import {
  EditCatalogueParentDialogComponent,
  EditCatalogueParentDialogData,
  EditCatalogueParentDialogResponse
} from "./edit-catalogue-parent-dialog/edit-catalogue-parent-dialog.component";

/**
 * The parent editor target for a playable card: a news report's news outlet or a TV episode's show.
 * Null for a podcast episode (it uses Edit Podcast), a film (no separate parent) or a playable with no parent name.
 */
export function catalogueParentEditTarget(
  episode: Pick<ApiEpisode, "contentKind" | "parentName" | "podcastName">
): EditCatalogueParentDialogData | null {
  const hub: CatalogueHub | null =
    episode.contentKind === "NewsReport" ? "news" : episode.contentKind === "TvShowEpisode" ? "tv" : null;
  const name = (episode.parentName ?? episode.podcastName ?? "").trim();
  return hub && name ? { hub, name } : null;
}

/** True when a card belongs to the news outlet / TV show just edited (same hub kind and parent name). */
export function isCardOfCatalogueParent(
  episode: Pick<ApiEpisode, "contentKind" | "parentName" | "podcastName">,
  parent: EditCatalogueParentDialogData
): boolean {
  const target = catalogueParentEditTarget(episode);
  return !!target && target.hub === parent.hub && target.name === parent.name.trim();
}

/** Menu text for the parent editor, using the hub's label: "Edit News Outlet" / "Edit TV Show". */
export function catalogueParentEditLabel(hub: CatalogueHub): string {
  return `Edit ${hubParentLabel(hub)}`;
}

/**
 * Opens the news outlet / TV show editor (same dialog and snackbars as the hub page menu). The caller subscribes,
 * so it can tie the subscription to its own lifetime.
 */
export function openCatalogueParentEditDialog(
  dialog: MatDialog,
  snackBar: MatSnackBar,
  data: EditCatalogueParentDialogData
): Observable<EditCatalogueParentDialogResponse | undefined> {
  return dialog
    .open<EditCatalogueParentDialogComponent, EditCatalogueParentDialogData, EditCatalogueParentDialogResponse>(
      EditCatalogueParentDialogComponent,
      { data, disableClose: true, autoFocus: true, width: "90%" }
    )
    .afterClosed()
    .pipe(
      tap((result) => {
        if (result?.updated) {
          snackBar.open(`${hubParentLabel(data.hub)} updated`, "Ok", { duration: 3000 });
        } else if (result?.noChange) {
          snackBar.open("No change", "Ok", { duration: 3000 });
        }
      })
    );
}
