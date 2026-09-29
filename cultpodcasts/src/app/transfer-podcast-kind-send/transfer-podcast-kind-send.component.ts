import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CatalogueParentKind } from '../catalogue-parent-kind.enum';
import { CurationSubmitService } from '../curation-submit.service';
import { PodcastKindTransferResponse } from '../podcast-kind-transfer-response.interface';

@Component({
  selector: 'app-transfer-podcast-kind-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './transfer-podcast-kind-send.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './transfer-podcast-kind-send.component.sass'
})
export class TransferPodcastKindSendComponent {
  readonly isSending = signal(true);
  readonly sendError = signal(false);

  constructor(
    private dialogRef: MatDialogRef<TransferPodcastKindSendComponent>,
    private curationSubmit: CurationSubmitService) {
  }

  public submit(podcastId: string, targetKind: CatalogueParentKind) {
    this.curationSubmit.postPodcastKind(podcastId, targetKind).subscribe({
      next: resp => {
        const body = resp.body as PodcastKindTransferResponse | null;
        this.dialogRef.close({ transferred: true, response: body });
      },
      error: e => {
        this.isSending.set(false);
        this.sendError.set(true);
        console.error(e);
      }
    });
  }

  close() {
    this.dialogRef.close({ transferred: false });
  }
}
