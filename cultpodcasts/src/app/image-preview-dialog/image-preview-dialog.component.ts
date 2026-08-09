import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface ImagePreviewDialogData {
  url: string;
}

@Component({
  selector: 'app-image-preview-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './image-preview-dialog.component.html',
  styleUrl: './image-preview-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImagePreviewDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: ImagePreviewDialogData) {}
}
