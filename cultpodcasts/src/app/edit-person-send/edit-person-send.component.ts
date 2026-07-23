import { Component, Inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { Person } from '../person.interface';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { CurationSubmitService } from '../curation-submit.service';

@Component({
  selector: 'app-edit-person-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './edit-person-send.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './edit-person-send.component.sass'
})
export class EditPersonSendComponent {
  readonly isSending = signal(true);
  readonly sendError = signal(false);
  readonly conflict = signal<string | undefined>(undefined);
  readonly create: boolean;

  constructor(
    private dialogRef: MatDialogRef<EditPersonSendComponent>,
    private curationSubmit: CurationSubmitService,
    @Inject(MAT_DIALOG_DATA) public data: { create: boolean }
  ) {
    this.create = data.create;
  }

  public submit(personId: string, changes: Person, create: boolean) {
    const request$ = create
      ? this.curationSubmit.putPerson(changes)
      : this.curationSubmit.postPerson(personId, changes);

    request$.subscribe({
      next: resp => {
        if (create) {
          if (resp.status == 202) {
            this.dialogRef.close({
              updated: true,
              person: resp.body,
              personName: (resp.body as Person)?.name ?? changes.name
            });
          }
        } else {
          this.dialogRef.close({ updated: true, personName: changes.name });
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
