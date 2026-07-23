import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { SubjectEntity } from '../subject-entity.interface';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { CurationSubmitService } from '../curation-submit.service';

@Component({
  selector: 'app-edit-subject-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './edit-subject-send.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './edit-subject-send.component.sass'
})
export class EditSubjectSendComponent {
  isSending: boolean = true;
  sendError: boolean = false;
  conflict: string | undefined;
  create: boolean;

  constructor(
    private dialogRef: MatDialogRef<EditSubjectSendComponent>,
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
            this.dialogRef.close({ updated: true });
          }
        } else {
          this.dialogRef.close({ updated: true });
        }
      },
      error: e => {
        if (create && e.status == 409) {
          this.isSending = false;
          this.sendError = true;
          this.conflict = e.error.conflict;
        } else {
          this.isSending = false;
          this.sendError = true;
          console.error(e);
        }
      }
    });
  }

  close() {
    if (this.conflict) {
      this.dialogRef.close({ conflict: this.conflict });
    } else {
      this.dialogRef.close({ updated: false });
    }
  }
}
