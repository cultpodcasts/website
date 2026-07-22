import { Component, Inject } from '@angular/core';
import { Person } from '../person.interface';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { CurationSubmitService } from '../curation-submit.service';

@Component({
  selector: 'app-edit-person-send',
  imports: [MatDialogModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './edit-person-send.component.html',
  styleUrl: './edit-person-send.component.sass'
})
export class EditPersonSendComponent {
  isSending: boolean = true;
  sendError: boolean = false;
  conflict: string | undefined;
  create: boolean;

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
