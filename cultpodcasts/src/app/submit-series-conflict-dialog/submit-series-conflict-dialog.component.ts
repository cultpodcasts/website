import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AmbiguousNameCandidate } from '../ambiguous-name-candidate';
import { displayCatalogName } from '../display-catalog-name';

export interface SubmitSeriesConflictDialogData {
  name: string;
  candidates: AmbiguousNameCandidate[];
  /** Dialog title; default "Choose series". */
  title?: string;
  /** Noun in the lede, e.g. "news outlets", "TV shows", "catalogue rows". */
  itemNounPlural?: string;
}

@Component({
  selector: 'app-submit-series-conflict-dialog',
  templateUrl: './submit-series-conflict-dialog.component.html',
  styleUrl: './submit-series-conflict-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule]
})
export class SubmitSeriesConflictDialogComponent {
  protected readonly displayCatalogName = displayCatalogName;
  protected readonly title = this.data.title ?? 'Choose series';
  protected readonly itemNounPlural = this.data.itemNounPlural ?? 'catalogue rows';

  constructor(
    private readonly dialogRef: MatDialogRef<SubmitSeriesConflictDialogComponent, AmbiguousNameCandidate | undefined>,
    @Inject(MAT_DIALOG_DATA) protected readonly data: SubmitSeriesConflictDialogData
  ) {
  }

  pick(candidate: AmbiguousNameCandidate): void {
    if (!candidate.id) {
      return;
    }
    this.dialogRef.close(candidate);
  }

  close(): void {
    this.dialogRef.close(undefined);
  }
}
