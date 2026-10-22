import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { parseFilmTrailerTokens } from '../film-trailer';

/**
 * The film page's Trailers section: the film search document's `trailers` tokens as outbound links, in display
 * order. Renders nothing when the film has none. Trailers have no pages of their own, so each opens its video.
 */
@Component({
  selector: 'app-film-trailers',
  templateUrl: './film-trailers.component.html',
  styleUrl: './film-trailers.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilmTrailersComponent {
  readonly trailers = input<readonly string[] | null | undefined>(undefined);
  protected readonly links = computed(() => parseFilmTrailerTokens(this.trailers()));
}
