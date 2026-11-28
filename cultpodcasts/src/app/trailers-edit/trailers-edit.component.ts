import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TrailerEditGroup } from '../playable-edit-form.util';
import { TRAILER_PARENT_LABELS, TrailerParentKind } from '../trailer';

/**
 * Edit film or Edit TV show: the parent's trailers in display order. Rename, reorder or remove; a removed trailer is gone
 * from its film or TV show (a film's old short link still opens the film). Trailers are added from the episode editor
 * ("Attach as trailer" / "Attach as TV trailer/clip").
 */
@Component({
  selector: 'app-trailers-edit',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './trailers-edit.component.html',
  styleUrl: './trailers-edit.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrailersEditComponent {
  readonly trailers = input.required<FormArray<TrailerEditGroup>>();
  /** What holds the trailers, for the empty-list hint: a film (default) or a TV show, `'tv'` (RPP #1412). */
  readonly parent = input<TrailerParentKind>('film');
  protected readonly labels = computed(() => TRAILER_PARENT_LABELS[this.parent()]);

  move(index: number, by: -1 | 1): void {
    const target = index + by;
    const array = this.trailers();
    if (target < 0 || target >= array.length) {
      return;
    }
    const group = array.at(index);
    array.removeAt(index);
    array.insert(target, group);
    array.markAsDirty();
  }

  remove(index: number): void {
    this.trailers().removeAt(index);
    this.trailers().markAsDirty();
  }
}
