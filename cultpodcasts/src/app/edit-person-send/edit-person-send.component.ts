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
    if (create) {
      this.curationSubmit.putPerson(changes).subscribe({
        next: resp => {
          if (resp.status != 202) {
            this.isSending.set(false);
            this.sendError.set(true);
            return;
          }
          const name = changes.name;
          if (!name) {
            this.isSending.set(false);
            this.sendError.set(true);
            return;
          }
          this.curationSubmit.getPerson(name).subscribe({
            next: person => {
              if (!person?.id) {
                this.isSending.set(false);
                this.sendError.set(true);
                return;
              }
              this.dialogRef.close({
                updated: true,
                person,
                personName: person.name || name
              });
            },
            error: () => {
              this.isSending.set(false);
              this.sendError.set(true);
            }
          });
        },
        error: e => this.failCreate(e)
      });
      return;
    }

    this.curationSubmit.postPerson(personId, changes).subscribe({
      next: () => this.dialogRef.close({ updated: true, personName: changes.name }),
      error: e => {
        this.isSending.set(false);
        this.sendError.set(true);
        console.error(e);
      }
    });
  }

  private failCreate(e: { status?: number; error?: { conflict?: string } }) {
    if (e.status == 409) {
      this.isSending.set(false);
      this.sendError.set(true);
      this.conflict.set(e.error?.conflict);
      return;
    }
    this.isSending.set(false);
    this.sendError.set(true);
    console.error(e);
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
