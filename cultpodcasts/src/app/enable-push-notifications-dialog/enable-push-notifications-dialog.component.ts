import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-enable-push-notifications-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
  ],
  templateUrl: './enable-push-notifications-dialog.component.html',
  styleUrl: './enable-push-notifications-dialog.component.sass'
})
export class EnablePushNotificationsDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<EnablePushNotificationsDialogComponent, any>
  ) { }

  ok() {
    this.dialogRef.close(true);
  }

  close(remember: boolean) {
    if (remember) {
      localStorage.setItem("neverAskForNotifications", "true");
    }
    this.dialogRef.close(false);
  }
}
