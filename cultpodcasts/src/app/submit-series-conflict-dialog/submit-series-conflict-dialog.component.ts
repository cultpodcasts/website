import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { displayCatalogName } from '../display-catalog-name';
import { Podcast } from '../podcast.interface';
import { SimplePodcast } from '../simple-podcast.interface';

export interface SubmitSeriesConflictDialogData {
  name: string;
  podcasts: Podcast[];
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

  constructor(
    private readonly dialogRef: MatDialogRef<SubmitSeriesConflictDialogComponent, SimplePodcast | undefined>,
    @Inject(MAT_DIALOG_DATA) protected readonly data: SubmitSeriesConflictDialogData
  ) {
  }

  pick(podcast: Podcast): void {
    if (!podcast.id) {
      return;
    }
    this.dialogRef.close({
      id: podcast.id,
      name: podcast.name ?? this.data.name
    });
  }

  close(): void {
    this.dialogRef.close(undefined);
  }
}
