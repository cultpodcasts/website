import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { firstValueFrom } from "rxjs";
import { CatalogueHub, hubParentLabel } from "../catalogue-hub";
import { CatalogueParentDto } from "../catalogue-parent.interface";
import {
  CatalogueParentEditModel,
  catalogueParentChanges,
  catalogueParentEditModel
} from "../catalogue-parent-edit";
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

/** Curator edit of a news outlet / TV show's publisher fields (PATCH, RPP #1053). Rename is a separate admin dialog. */
@Component({
  selector: "app-edit-catalogue-parent-dialog",
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  templateUrl: "./edit-catalogue-parent-dialog.component.html",
  styleUrl: "./edit-catalogue-parent-dialog.component.sass",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditCatalogueParentDialogComponent {
  protected readonly data = inject<EditCatalogueParentDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<EditCatalogueParentDialogComponent, EditCatalogueParentDialogResponse>>(MatDialogRef);
  private readonly curation = inject(CurationSubmitService);

  protected readonly label = hubParentLabel(this.data.hub);
  protected readonly isTv = this.data.hub === "tv";
  protected readonly isLoading = signal(true);
  protected readonly isSending = signal(false);
  protected readonly notFound = signal(false);
  protected readonly conflict = signal(false);
  protected readonly isInError = signal(false);
  protected readonly saveError = signal(false);
  protected readonly model = signal<CatalogueParentEditModel | null>(null);
  private original: CatalogueParentDto | null = null;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const dto = await firstValueFrom(this.curation.getCatalogueParent(this.data.hub, this.data.name));
      this.original = dto;
      this.model.set(catalogueParentEditModel(dto));
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
    const changes = catalogueParentChanges(this.original, model, this.isTv);
    if (Object.keys(changes).length === 0) {
      this.dialogRef.close({ noChange: true });
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

  protected close(): void {
    this.dialogRef.close({ closed: true });
  }
}
