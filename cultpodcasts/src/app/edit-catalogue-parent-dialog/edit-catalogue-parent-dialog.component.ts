import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTabsModule } from "@angular/material/tabs";
import { TextFieldModule } from "@angular/cdk/text-field";
import { firstValueFrom } from "rxjs";
import { CatalogueHub, hubParentLabel } from "../catalogue-hub";
import { CatalogueParentDto } from "../catalogue-parent.interface";
import {
  CatalogueParentEditModel,
  catalogueParentChanges,
  catalogueParentEditModel,
  isValidAppleIdText,
  removesCatalogueParent
} from "../catalogue-parent-edit";
import { ConfirmComponent } from "../confirm/confirm.component";
import { CurationSubmitService } from "../curation-submit.service";

export interface EditCatalogueParentDialogData {
  hub: CatalogueHub;
  name: string;
}

export interface EditCatalogueParentDialogResponse {
  updated?: boolean;
  noChange?: boolean;
  closed?: boolean;
}

/**
 * Curator edit of a news outlet / TV show (PATCH, RPP #1053). Same tabbed layout as the podcast edit dialog:
 * Details (service ids), Flags, Subjects, Social, Meta, and Identity for TV. Rename is a separate admin dialog.
 */
@Component({
  selector: "app-edit-catalogue-parent-dialog",
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TextFieldModule
  ],
  templateUrl: "./edit-catalogue-parent-dialog.component.html",
  styleUrl: "./edit-catalogue-parent-dialog.component.sass",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditCatalogueParentDialogComponent {
  protected readonly data = inject<EditCatalogueParentDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<EditCatalogueParentDialogComponent, EditCatalogueParentDialogResponse>>(MatDialogRef);
  private readonly curation = inject(CurationSubmitService);
  private readonly dialog = inject(MatDialog);

  protected readonly label = hubParentLabel(this.data.hub);
  protected readonly isTv = this.data.hub === "tv";
  protected readonly isLoading = signal(true);
  protected readonly isSending = signal(false);
  protected readonly notFound = signal(false);
  protected readonly conflict = signal(false);
  protected readonly isInError = signal(false);
  protected readonly saveError = signal(false);
  protected readonly model = signal<CatalogueParentEditModel | null>(null);
  protected readonly appleIdInvalid = signal(false);
  protected readonly playlistHistory = signal<{ id: string; replacedAt: string }[]>([]);
  protected readonly itemNoun = this.data.hub === "news" ? "reports" : "episodes";
  private original: CatalogueParentDto | null = null;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const dto = await firstValueFrom(this.curation.getCatalogueParent(this.data.hub, this.data.name));
      this.original = dto;
      this.model.set(catalogueParentEditModel(dto));
      this.playlistHistory.set(dto.youTubePlaylistIdHistory ?? []);
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      this.notFound.set(status === 404);
      this.conflict.set(status === 409);
      this.isInError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async save(): Promise<void> {
    const model = this.model();
    if (!model || !this.original) {
      return;
    }
    this.appleIdInvalid.set(!isValidAppleIdText(model.appleId));
    if (this.appleIdInvalid()) {
      return;
    }
    const changes = catalogueParentChanges(this.original, model, this.isTv);
    if (Object.keys(changes).length === 0) {
      this.dialogRef.close({ noChange: true });
      return;
    }
    if (removesCatalogueParent(changes) && !(await this.confirmRemove())) {
      return;
    }
    this.isSending.set(true);
    this.saveError.set(false);
    try {
      const resp = await firstValueFrom(this.curation.patchCatalogueParent(this.data.hub, this.original.id, changes));
      if (resp.status === 202 || resp.status === 200) {
        this.dialogRef.close({ updated: true });
        return;
      }
      this.saveError.set(true);
    } catch {
      this.saveError.set(true);
    } finally {
      this.isSending.set(false);
    }
  }

  /** Removing cascades to every report / episode, so it takes an explicit Yes. Restoring stays one step. */
  private async confirmRemove(): Promise<boolean> {
    const closed = await firstValueFrom(
      this.dialog
        .open(ConfirmComponent, {
          data: {
            title: `Remove ${this.label.toLowerCase()}?`,
            question: `"${this.data.name}" and all of its ${this.itemNoun} will be hidden from the site. Remove it?`
          }
        })
        .afterClosed()
    );
    return (closed as { result?: boolean } | undefined)?.result === true;
  }

  protected close(): void {
    this.dialogRef.close({ closed: true });
  }
}
