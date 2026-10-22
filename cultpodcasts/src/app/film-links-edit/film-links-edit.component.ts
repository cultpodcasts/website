import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormArray, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { hasNonEmptyUrlValue, openExternalUrl } from '../episode-form.util';
import { newFilmLinkControl } from '../playable-edit-form.util';
import { serviceLabelForUrl } from '../service-catalog';

/**
 * Edit film: the film's own links (YouTube, BBC iPlayer, Internet Archive, …), one URL per row. The service is taken
 * from the URL, so there is no key to pick; removing a row removes that link from the film.
 */
@Component({
  selector: 'app-film-links-edit',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './film-links-edit.component.html',
  styleUrl: './film-links-edit.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilmLinksEditComponent {
  readonly links = input.required<FormArray<FormControl<string>>>();
  protected readonly hasNonEmptyUrlValue = hasNonEmptyUrlValue;
  protected readonly openExternalUrl = openExternalUrl;

  protected label(value: string): string {
    return serviceLabelForUrl(value) || 'Link';
  }

  add(): void {
    this.links().push(newFilmLinkControl());
    this.links().markAsDirty();
  }

  remove(index: number): void {
    this.links().removeAt(index);
    this.links().markAsDirty();
  }
}
