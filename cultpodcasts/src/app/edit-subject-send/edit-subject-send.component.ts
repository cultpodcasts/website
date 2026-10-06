import { Component, Inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { SubjectEntity, subjectEntityWithId } from '../subject-entity.interface';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { CurationSubmitService } from '../curation-submit.service';

export interface EditSubjectSendResult {
  updated?: boolean;
  subject?: SubjectEntity;
  conflict?: string;
}

@Component({
  selector: 'app-edit-subject-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './edit-subject-send.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './edit-subject-send.component.sass'
})
export class EditSubjectSendComponent {
  readonly isSending = signal(true);
  readonly sendError = signal(false);
  readonly conflict = signal<string | undefined>(undefined);
  readonly create: boolean;

  constructor(
    private dialogRef: MatDialogRef<EditSubjectSendComponent, EditSubjectSendResult>,
    private curationSubmit: CurationSubmitService,
    @Inject(MAT_DIALOG_DATA) public data: { create: boolean }
  ) {
    this.create = data.create;
  }

  public submit(subjectId: string, changes: SubjectEntity, create: boolean) {
    const request$ = create
      ? this.curationSubmit.putSubject(changes)
      : this.curationSubmit.postSubject(subjectId, changes);

    request$.subscribe({
      next: resp => {
        if (create) {
          if (resp.status == 202) {
            const subject = subjectEntityWithId(resp.body);
            if (!subject) {
              this.isSending.set(false);
              this.sendError.set(true);
              return;
            }
            this.dialogRef.close({ updated: true, subject });
          }
        } else {
          this.dialogRef.close({ updated: true });
        }
      },
      error: e => {
        if (create && e.status == 409) {
          this.isSending.set(false);
          this.sendError.set(true);
          this.conflict.set(e.error.conflict);
        } else {
          this.isSending.set(false);
          this.sendError.set(true);
          console.error(e);
        }
      }
    });
  }

  close() {
    const conflict = this.conflict();
    if (conflict) {
      this.dialogRef.close({ conflict });
    } else {
      this.dialogRef.close({ updated: false });
    }
  }
}
