import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ApplePodcastsSvgComponent } from '../apple-podcasts-svg/apple-podcasts-svg.component';
import { EpisodeImagePreviewItem, EpisodeImageService } from '../episode-form.util';

export interface ImagePreviewDialogData {
  images: EpisodeImagePreviewItem[];
  /** Service of the field whose preview button was clicked — scrolled into view on open. */
  initialService?: EpisodeImageService;
}

@Component({
  selector: 'app-image-preview-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, ApplePodcastsSvgComponent],
  templateUrl: './image-preview-dialog.component.html',
  styleUrl: './image-preview-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImagePreviewDialogComponent implements AfterViewInit {
  @ViewChild('scrollHost') private scrollHost?: ElementRef<HTMLElement>;

  constructor(@Inject(MAT_DIALOG_DATA) public data: ImagePreviewDialogData) {}

  ngAfterViewInit(): void {
    const service = this.data.initialService;
    if (!service || !this.scrollHost) {
      return;
    }
    const target = this.scrollHost.nativeElement.querySelector<HTMLElement>(`#preview-${service}`);
    target?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
}
