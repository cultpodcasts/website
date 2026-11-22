import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { hasNonEmptyUrlValue, openExternalUrl } from '../episode-form.util';
import { newYouTubeAlternateGroup, YouTubeAlternateEditGroup } from '../playable-edit-form.util';

/**
 * Edit film: additional YouTube uploads in display order (RPP #1411). Keep, reorder, add a URL, remove, or
 * promote one into the primary YouTube link. A removed entry is gone from the film; the primary is unchanged
 * unless this editor promotes.
 */
@Component({
  selector: 'app-film-youtube-alternates-edit',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './film-youtube-alternates-edit.component.html',
  styleUrl: './film-youtube-alternates-edit.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilmYouTubeAlternatesEditComponent {
  readonly alternates = input.required<FormArray<YouTubeAlternateEditGroup>>();
  readonly promoteYouTubeId = input.required<FormControl<string>>();
  protected readonly hasNonEmptyUrlValue = hasNonEmptyUrlValue;
  protected readonly openExternalUrl = openExternalUrl;

  add(): void {
    this.alternates().push(newYouTubeAlternateGroup());
    this.alternates().markAsDirty();
  }

  move(index: number, by: -1 | 1): void {
    const target = index + by;
    const array = this.alternates();
    if (target < 0 || target >= array.length) {
      return;
    }
    const group = array.at(index);
    array.removeAt(index);
    array.insert(target, group);
    array.markAsDirty();
  }

  remove(index: number): void {
    const id = this.alternates().at(index).controls.youTubeId.value;
    if (id && this.promoteYouTubeId().value === id) {
      this.promoteYouTubeId().setValue('');
      this.promoteYouTubeId().markAsDirty();
    }
    this.alternates().removeAt(index);
    this.alternates().markAsDirty();
  }

  promote(index: number): void {
    const id = this.alternates().at(index).controls.youTubeId.value.trim();
    if (!id) {
      return;
    }
    const control = this.promoteYouTubeId();
    control.setValue(control.value === id ? '' : id);
    control.markAsDirty();
  }

  isPromoted(index: number): boolean {
    const id = this.alternates().at(index).controls.youTubeId.value;
    return !!id && this.promoteYouTubeId().value === id;
  }
}
