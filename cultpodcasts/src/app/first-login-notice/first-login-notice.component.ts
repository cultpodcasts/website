import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-first-login-notice',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './first-login-notice.component.html',
  styleUrl: './first-login-notice.component.sass'
})

export class FirstLoginNoticeComponent {
  constructor(private dialogRef: MatDialogRef<FirstLoginNoticeComponent>) { }

  close(proceed: boolean) {
    this.dialogRef.close({ continue: proceed });
  }
}
