import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-confirm',
  templateUrl: './confirm.component.html',
  styleUrls: ['./confirm.component.sass'],
  imports: [MatDialogModule, MatButtonModule]
})
export class ConfirmComponent {
  title: string;
  question: string;

  constructor(
    private dialogRef: MatDialogRef<ConfirmComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string, question: string }) {
    this.title = data.title;
    this.question = data.question;
  }

  yes() {
    this.dialogRef.close({ result: true });
  }

  no() {
    this.dialogRef.close({ result: false });
  }
}
