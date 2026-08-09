import { ChangeDetectionStrategy, Component, Inject, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ApplePodcastsSvgComponent } from '../apple-podcasts-svg/apple-podcasts-svg.component';
import { EpisodeImagePreviewItem, EpisodeImageService } from '../episode-form.util';

export interface ImagePreviewDialogData {
  images: EpisodeImagePreviewItem[];
  /** Service of the field whose preview button was clicked — shown first. */
  initialService?: EpisodeImageService;
}

@Component({
  selector: 'app-image-preview-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, ApplePodcastsSvgComponent],
  templateUrl: './image-preview-dialog.component.html',
  styleUrl: './image-preview-dialog.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)'
  }
})
export class ImagePreviewDialogComponent {
  private static readonly SWIPE_THRESHOLD_PX = 48;

  protected readonly index = signal(0);
  protected readonly dragging = signal(false);
  protected readonly dragPx = signal(0);

  protected readonly current = computed(() => this.data.images[this.index()] ?? this.data.images[0]);

  protected readonly hasMultiple = computed(() => this.data.images.length > 1);

  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private axisLocked: 'x' | 'y' | null = null;

  constructor(@Inject(MAT_DIALOG_DATA) public data: ImagePreviewDialogData) {
    const service = data.initialService;
    if (service) {
      const i = data.images.findIndex((img) => img.service === service);
      if (i >= 0) {
        this.index.set(i);
      }
    }
  }

  previous(): void {
    const n = this.data.images.length;
    if (n < 2) {
      return;
    }
    this.index.update((i) => (i - 1 + n) % n);
  }

  next(): void {
    const n = this.data.images.length;
    if (n < 2) {
      return;
    }
    this.index.update((i) => (i + 1) % n);
  }

  select(i: number): void {
    if (i >= 0 && i < this.data.images.length) {
      this.index.set(i);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previous();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.hasMultiple()) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.axisLocked = null;
    this.dragging.set(true);
    this.dragPx.set(0);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging() || event.pointerId !== this.pointerId) {
      return;
    }
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    if (!this.axisLocked) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        return;
      }
      this.axisLocked = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      if (this.axisLocked === 'y') {
        this.endDrag();
        return;
      }
    }
    if (this.axisLocked !== 'x') {
      return;
    }
    event.preventDefault();
    this.dragPx.set(dx);
  }

  onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    const dx = this.dragPx();
    const swiped = this.axisLocked === 'x' && Math.abs(dx) >= ImagePreviewDialogComponent.SWIPE_THRESHOLD_PX;
    this.endDrag();
    if (!swiped) {
      return;
    }
    if (dx < 0) {
      this.next();
    } else {
      this.previous();
    }
  }

  onPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.endDrag();
  }

  private endDrag(): void {
    this.pointerId = null;
    this.axisLocked = null;
    this.dragging.set(false);
    this.dragPx.set(0);
  }
}
