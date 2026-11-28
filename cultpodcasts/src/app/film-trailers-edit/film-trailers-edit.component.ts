import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FilmTrailerEditGroup } from '../playable-edit-form.util';

/**
 * Edit film or Edit TV show: the parent's trailers in display order. Rename, reorder or remove; a removed trailer is gone from the film
 * (its old short link still opens the film). Trailers are added from the episode editor ("Attach as trailer").
 */
@Component({
  selector: 'app-film-trailers-edit',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './film-trailers-edit.component.html',
  styleUrl: './film-trailers-edit.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilmTrailersEditComponent {
  readonly trailers = input.required<FormArray<FilmTrailerEditGroup>>();
  /** What holds the trailers, for the empty-list hint: a film (default) or a TV show, `'tv'` (RPP #1412). This component and its card serve both; the Film names are historical. */
  readonly parent = input<'film' | 'tv'>('film');

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
