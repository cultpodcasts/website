import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { FormsModule, NgModel } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { firstValueFrom } from "rxjs";
import { CatalogueHub, hubParentLabel } from "../catalogue-hub";
import { CurationSubmitService } from "../curation-submit.service";
import { SearchIndexerState } from "../search-indexer-state.interface";

export interface RenameCatalogueParentDialogData {
  hub: CatalogueHub;
  name: string;
}

export interface RenameCatalogueParentDialogResponse {
  updated?: boolean;
  closed?: boolean;
  newName?: string;
  searchIndexerState?: SearchIndexerState;
}

/** Admin rename of a news outlet / TV show (POST …/name/{identifier}). Not part of the edit form. */
@Component({
  selector: "app-rename-catalogue-parent-dialog",
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  templateUrl: "./rename-catalogue-parent-dialog.component.html",
  styleUrl: "./rename-catalogue-parent-dialog.component.sass",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RenameCatalogueParentDialogComponent {
  protected readonly data = inject<RenameCatalogueParentDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RenameCatalogueParentDialogComponent, RenameCatalogueParentDialogResponse>>(MatDialogRef);
  private readonly curation = inject(CurationSubmitService);

  protected readonly label = hubParentLabel(this.data.hub);
  protected readonly isSending = signal(false);
  protected readonly conflict = signal(false);
  protected readonly ambiguous = signal(false);
  protected readonly notFound = signal(false);
  protected readonly isInError = signal(false);
  protected newName = "";

  protected close(): void {
    this.dialogRef.close({ closed: true });
  }

  protected async onSubmit(): Promise<void> {
    const newName = this.newName.trim();
    if (!newName || newName.includes("/") || this.isSending()) {
      return;
    }
    this.isSending.set(true);
    this.conflict.set(false);
    this.ambiguous.set(false);
    this.notFound.set(false);
    this.isInError.set(false);
    try {
      const resp = await firstValueFrom(this.curation.renameCatalogueParent(this.data.hub, this.data.name, newName));
      if (resp.status === 200) {
        this.dialogRef.close({ updated: true, newName, searchIndexerState: resp.body?.indexState });
        return;
      }
      this.isInError.set(true);
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      // 409 with a guid array = the current name is ambiguous; empty 409 = the new name is taken.
      const ambiguous = status === 409 && error instanceof HttpErrorResponse && Array.isArray(error.error) && error.error.length > 0;
      this.ambiguous.set(ambiguous);
      this.conflict.set(status === 409 && !ambiguous);
      this.notFound.set(status === 404);
      this.isInError.set(true);
    } finally {
      this.isSending.set(false);
    }
  }

  protected checkControl(control: NgModel): void {
    if (control.control.value && control.control.value.indexOf("/") >= 0) {
      control.control.setErrors({ unsafe: true });
    }
  }
}
