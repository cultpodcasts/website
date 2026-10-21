import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, model } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatSnackBar } from "@angular/material/snack-bar";
import { environment } from "../../environments/environment";
import { AuthServiceWrapper } from "../auth-service-wrapper.class";
import { CatalogueHub, hubParentKind, hubParentLabel, hubPathCommands } from "../catalogue-hub";
import { indexStateMessage } from "../catalogue-index-state-message";
import {
  EditCatalogueParentDialogComponent,
  EditCatalogueParentDialogData,
  EditCatalogueParentDialogResponse
} from "../edit-catalogue-parent-dialog/edit-catalogue-parent-dialog.component";
import {
  RenameCatalogueParentDialogComponent,
  RenameCatalogueParentDialogData,
  RenameCatalogueParentDialogResponse
} from "../rename-catalogue-parent-dialog/rename-catalogue-parent-dialog.component";
import { SendPodcastComponent } from "../send-podcast/send-podcast.component";
import { ShareMode } from "../share-mode.enum";
import { SubmitDialogResponse } from "../submit-dialog-response.interface";
import { parseSubmitDialogUrl } from "../submit-ingest-ux";
import { SubmitParentTarget } from "../submit-parent-target.interface";
import { SubmitPodcastComponent, SubmitPodcastDialogData } from "../submit-podcast/submit-podcast.component";
import { SubmitSeriesResolveService } from "../submit-series-resolve.service";
import { SubmitUrlOriginResponseSnackbarComponent } from "../submit-url-origin-response-snackbar/submit-url-origin-response-snackbar.component";

export const seriesHubSortNewest = "release desc";
export const seriesHubSortOldest = "release asc";
export type SeriesHubSort = typeof seriesHubSortNewest | typeof seriesHubSortOldest;

/**
 * Sort + curator menu for /news/{name} and /tv/{name}, mirroring the podcast page menu.
 * Curator: Edit, Submit URL for this outlet/show. Admin: Rename. Each curation item is behind
 * `environment.catalogueParentCuration` until its backend is live.
 */
@Component({
  selector: "app-series-hub-menu",
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: "./series-hub-menu.component.html",
  styleUrl: "./series-hub-menu.component.sass",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SeriesHubMenuComponent {
  readonly hub = input.required<CatalogueHub>();
  readonly seriesName = input.required<string>();
  readonly sort = model<SeriesHubSort>(seriesHubSortNewest);
  /** False on the empty hub: no sort items, and the trigger only appears when a curation item is available. */
  readonly sortable = input(true);

  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly seriesResolve = inject(SubmitSeriesResolveService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authRoles = toSignal(inject(AuthServiceWrapper).roles, { initialValue: [] as string[] });

  protected readonly flags = environment.catalogueParentCuration;
  protected readonly isCurator = computed(() => this.authRoles().includes("Curator"));
  protected readonly isAdmin = computed(() => this.authRoles().includes("Admin"));
  protected readonly label = computed(() => hubParentLabel(this.hub()));
  protected readonly sortLabel = computed(() => (this.sort() === seriesHubSortOldest ? "Oldest first" : "Newest first"));
  protected readonly showEdit = computed(() => this.flags.edit && this.isCurator());
  protected readonly showSubmit = computed(() => this.flags.submit && this.isCurator());
  protected readonly showRename = computed(() => this.flags.rename && this.isAdmin());
  protected readonly visible = computed(() => this.sortable() || this.showEdit() || this.showSubmit() || this.showRename());
  protected readonly triggerLabel = computed(() => (this.sortable() ? this.sortLabel() : "Curate"));

  protected setSort(sort: SeriesHubSort): void {
    this.sort.set(sort);
  }

  protected edit(): void {
    this.dialog
      .open<EditCatalogueParentDialogComponent, EditCatalogueParentDialogData, EditCatalogueParentDialogResponse>(
        EditCatalogueParentDialogComponent,
        { data: { hub: this.hub(), name: this.seriesName() }, disableClose: true, autoFocus: true, width: "90%" }
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result?.updated) {
          this.snackBar.open(`${this.label()} updated`, "Ok", { duration: 3000 });
        } else if (result?.noChange) {
          this.snackBar.open("No change", "Ok", { duration: 3000 });
        }
      });
  }

  protected rename(): void {
    this.dialog
      .open<RenameCatalogueParentDialogComponent, RenameCatalogueParentDialogData, RenameCatalogueParentDialogResponse>(
        RenameCatalogueParentDialogComponent,
        { data: { hub: this.hub(), name: this.seriesName() }, disableClose: true, autoFocus: true }
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (!result?.updated || !result.newName) {
          return;
        }
        const newName = result.newName;
        const ref = this.snackBar.open(
          `${this.label()} name changed to "${newName}". ${indexStateMessage(result.searchIndexerState)}`,
          "Review",
          { duration: 10000 }
        );
        ref.onAction().subscribe(() => void this.router.navigate(hubPathCommands(this.hub(), newName)));
      });
  }

  protected submitUrl(): void {
    const hub = this.hub();
    const name = this.seriesName();
    const label = this.label();
    const data: SubmitPodcastDialogData = { attachToPage: true, target: { label, name } };
    this.dialog
      .open(SubmitPodcastComponent, { disableClose: true, autoFocus: true, data })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (result) => {
        if (result?.url == null || result.url === "") {
          return;
        }
        const url = parseSubmitDialogUrl(result.url);
        if (!url) {
          this.snackBar.open("Unsupported episode link", "Ok", { duration: 5000 });
          return;
        }
        const probe = await this.seriesResolve.probeParentByName(hub, name);
        if (probe.kind !== "unique") {
          const message =
            probe.kind === "missing"
              ? `${label} "${name}" was not found.`
              : probe.kind === "conflict"
                ? `More than one ${label.toLowerCase()} is called "${name}". Nothing was sent.`
                : `Could not look up this ${label.toLowerCase()}. Nothing was sent.`;
          this.snackBar.open(message, "Ok", { duration: 5000 });
          return;
        }
        const parent: SubmitParentTarget = {
          parentKind: hubParentKind(hub) as SubmitParentTarget["parentKind"],
          parentId: probe.id,
          parentName: probe.name
        };
        await this.send(url, parent);
      });
  }

  private async send(url: URL, parent: SubmitParentTarget): Promise<void> {
    const dialog = this.dialog.open<SendPodcastComponent, unknown, SubmitDialogResponse>(SendPodcastComponent, {
      disableClose: true,
      autoFocus: true
    });
    dialog
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (!result?.submitted) {
          return;
        }
        if (result.originResponse?.success != null) {
          this.snackBar.openFromComponent(SubmitUrlOriginResponseSnackbarComponent, {
            duration: 10000,
            data: { existingPodcast: true, response: result.originResponse.success, roles: this.authRoles() }
          });
        } else {
          this.snackBar.open(`Sent to ${parent.parentName}`, "Ok", { duration: 3000 });
        }
      });
    await dialog.componentInstance.submit({
      url,
      podcastId: undefined,
      podcastName: undefined,
      shareMode: ShareMode.Text,
      parent
    });
  }
}

