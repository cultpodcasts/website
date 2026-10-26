import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  additionalServicePreviewKey,
  EpisodeImagePreviewItem,
  EpisodeImageService,
  hasNonEmptyUrlValue
} from '../episode-form.util';
import { ImagePreviewDialogComponent } from '../image-preview-dialog/image-preview-dialog.component';
import { PlayableServiceLinkGroup } from '../playable-edit-form.util';
import { serviceLabelForUrl } from '../service-catalog';

/**
 * Playable Images tab (film / news / TV): one image URL per Urls row, labelled by that row's service.
 * Preview opens `ImagePreviewDialogComponent` (same as podcast episode edit).
 */
@Component({
  selector: 'app-film-images-edit',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './film-images-edit.component.html',
  styleUrl: './film-images-edit.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilmImagesEditComponent {
  /** Same FormArray as the Urls tab (`url` + `image` per service). */
  readonly links = input.required<FormArray<PlayableServiceLinkGroup>>();
  protected readonly hasNonEmptyUrlValue = hasNonEmptyUrlValue;
  private readonly dialog = inject(MatDialog);

  protected label(url: string): string {
    return serviceLabelForUrl(url) || 'Image';
  }

  protected previewKey(url: string): EpisodeImageService {
    return additionalServicePreviewKey(url);
  }

  protected clearImage(control: FormControl<string>): void {
    control.setValue('');
    control.markAsDirty();
  }

  protected previewImage(service: EpisodeImageService): void {
    const images = this.collectPreviews();
    if (images.length === 0) {
      return;
    }
    this.dialog.open(ImagePreviewDialogComponent, {
      data: { images, initialService: service },
      maxWidth: 'min(920px, 95vw)',
      width: 'min(920px, 95vw)'
    });
  }

  private collectPreviews(): EpisodeImagePreviewItem[] {
    const items: EpisodeImagePreviewItem[] = [];
    for (const group of this.links().controls) {
      const urlValue = group.controls.url.value;
      const image = group.controls.image.value?.trim();
      if (!image) {
        continue;
      }
      items.push({
        service: this.previewKey(urlValue),
        label: this.label(urlValue),
        url: image
      });
    }
    return items;
  }
}
