import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-first-login-notice',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './first-login-notice.component.html',
  styleUrl: './first-login-notice.component.sass'
})

export class FirstLoginNoticeComponent {
  constructor(private dialogRef: MatDialogRef<FirstLoginNoticeComponent>) { }

  close(proceed: boolean) {
    this.dialogRef.close({ continue: proceed });
  }
}
