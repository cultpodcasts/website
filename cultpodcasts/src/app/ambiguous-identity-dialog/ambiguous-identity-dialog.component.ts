import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';

export interface AmbiguousIdentityCandidate {
  key: string;
  title: string;
  year?: number | null;
  kind: string;
  source: string;
  tmdbId?: number | null;
  tvdbId?: number | null;
  pageUrl?: string | null;
  thumbnailUrl?: string | null;
  description?: string | null;
}

export interface AmbiguousIdentityPrompt {
  target: string;
  query: string;
  candidates: AmbiguousIdentityCandidate[];
  /** create = submit/discovery gate; edit = Identity tab Look up. */
  context?: 'create' | 'edit';
}

/** select = apply the chosen key; continue = create with blank identity; cancel = abort create. */
export type AmbiguousIdentityAnswer =
  | { decision: 'select'; key: string }
  | { decision: 'continue' }
  | { decision: 'cancel' };

@Component({
  selector: 'app-ambiguous-identity-dialog',
  imports: [MatDialogModule, MatButtonModule, MatRadioModule, FormsModule],
  templateUrl: './ambiguous-identity-dialog.component.html',
  styleUrl: './ambiguous-identity-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AmbiguousIdentityDialogComponent {
  readonly data = inject<AmbiguousIdentityPrompt>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AmbiguousIdentityDialogComponent, AmbiguousIdentityAnswer>);
  selectedKey = this.data.candidates[0]?.key ?? '';
  readonly isEdit = this.data.context === 'edit';

  chooseSelect() {
    if (!this.selectedKey) {
      return;
    }
    this.dialogRef.close({ decision: 'select', key: this.selectedKey });
  }

  chooseContinue() {
    this.dialogRef.close({ decision: 'continue' });
  }

  chooseCancel() {
    this.dialogRef.close({ decision: 'cancel' });
  }

  label(candidate: AmbiguousIdentityCandidate): string {
    const year = candidate.year != null ? ` (${candidate.year})` : '';
    return `${candidate.title}${year} — ${candidate.source.toUpperCase()} ${candidate.kind}`;
  }
}
