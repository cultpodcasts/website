import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-set-number-of-days',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, FormsModule],
  templateUrl: './set-number-of-days.component.html',
  styleUrl: './set-number-of-days.component.sass'
})
export class SetNumberOfDaysComponent {
  days: any;
  constructor(private dialogRef: MatDialogRef<SetNumberOfDaysComponent>,
    @Inject(MAT_DIALOG_DATA) data: any) {
    this.days = data.days;
  }

  close(proceed: boolean) {
    if (proceed) {
      this.dialogRef.close({ days: this.days });
    } else {
      this.dialogRef.close();
    }
  }
}




