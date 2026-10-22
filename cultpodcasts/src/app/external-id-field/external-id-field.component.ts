import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { startWith, switchMap } from 'rxjs';
import { ExternalIdKind, externalIdErrorKey, externalIdSiteName, externalIdUrl, parseExternalId } from '../external-id.util';

const errorText: Record<ExternalIdKind, string> = {
  'imdb': 'Enter an IMDb title id (tt + 7 to 10 digits) or an imdb.com/title URL',
  'tmdb-movie': 'Enter a TMDB movie id or a themoviedb.org/movie URL',
  'tmdb-tv': 'Enter a TMDB TV id or a themoviedb.org/tv URL'
};

const placeholderText: Record<ExternalIdKind, string> = {
  'imdb': 'tt1234567, or paste the IMDb URL',
  'tmdb-movie': '1234567, or paste the TMDB URL',
  'tmdb-tv': '1234567, or paste the TMDB URL'
};

/**
 * One external id input (IMDb title id, TMDB movie / tv id). A pasted page URL is condensed to the bare id at once,
 * and anything typed is condensed on blur; what cannot be condensed stays in the box with an error (the form's
 * `externalIdValidator` makes it invalid) rather than being saved. A valid id shows a link to its page on the site.
 */
@Component({
  selector: 'app-external-id-field',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './external-id-field.component.html',
  styleUrl: './external-id-field.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExternalIdFieldComponent {
  readonly control = input.required<FormControl<string>>();
  readonly kind = input.required<ExternalIdKind>();
  /** Defaults to "IMDb id" / "TMDB id". */
  readonly label = input<string>('');

  private readonly value = toSignal(
    toObservable(this.control).pipe(switchMap(control => control.valueChanges.pipe(startWith(control.value)))),
    { initialValue: '' }
  );

  protected readonly site = computed(() => externalIdSiteName(this.kind()));
  protected readonly labelText = computed(() => this.label() || `${this.site()} id`);
  protected readonly placeholder = computed(() => placeholderText[this.kind()]);
  protected readonly error = computed(() => errorText[this.kind()]);
  /** The item's page on the site, once the box holds a valid id. */
  protected readonly link = computed(() => externalIdUrl(this.kind(), this.value()));
  protected readonly errorKey = externalIdErrorKey;

  /** A pasted URL (or id with stray spaces / case) replaces the box with the bare id. */
  onPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    const id = parseExternalId(this.kind(), text);
    if (id && id !== text) {
      event.preventDefault();
      this.setId(id);
    }
  }

  /** Typed URLs condense when the box loses focus; invalid text is left for the error to show. */
  condense(): void {
    const control = this.control();
    const id = parseExternalId(this.kind(), control.value);
    if (id !== null && id !== control.value) {
      this.setId(id);
    }
  }

  private setId(id: string): void {
    const control = this.control();
    control.setValue(id);
    control.markAsDirty();
    control.markAsTouched();
  }
}
