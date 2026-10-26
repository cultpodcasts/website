import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { hasNonEmptyUrlValue, openExternalUrl } from '../episode-form.util';
import { newFilmLinkGroup, PlayableServiceLinkGroup } from '../playable-edit-form.util';
import { serviceLabelForUrl } from '../service-catalog';

/**
 * Playable Urls tab (film / news / TV): one page URL per service row. The service is taken from the URL;
 * removing a row removes that service (and its image) from the PATCH.
 */
@Component({
  selector: 'app-film-links-edit',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './film-links-edit.component.html',
  styleUrl: './film-links-edit.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilmLinksEditComponent {
  readonly links = input.required<FormArray<PlayableServiceLinkGroup>>();
  protected readonly hasNonEmptyUrlValue = hasNonEmptyUrlValue;
  protected readonly openExternalUrl = openExternalUrl;

  protected label(value: string): string {
    return serviceLabelForUrl(value) || 'URL';
  }

  add(): void {
    this.links().push(newFilmLinkGroup());
    this.links().markAsDirty();
  }

  remove(index: number): void {
    this.links().removeAt(index);
    this.links().markAsDirty();
  }
}
