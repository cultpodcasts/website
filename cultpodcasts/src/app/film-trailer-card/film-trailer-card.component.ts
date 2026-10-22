import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { SearchDisplayEpisode } from "../search-result-links";
import { EpisodePosterComponent } from "../episode-poster/episode-poster.component";
import { contentKindIcon } from "../content-kind-label";
import { filmTrailerUrl } from "../film-trailer";

/**
 * A film trailer on the film page's Trailers rail (filmTrailerEpisode). A trailer has no page of its own, so the
 * title opens its video in a new tab, and no known publisher, so the byline is a plain "Trailer" label.
 */
@Component({
  selector: "app-film-trailer-card",
  imports: [EpisodePosterComponent],
  templateUrl: "./film-trailer-card.component.html",
  styleUrl: "./film-trailer-card.component.sass",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilmTrailerCardComponent {
  readonly episode = input.required<SearchDisplayEpisode>();
  readonly playing = input(false);
  readonly queued = input(false);
  readonly play = output<SearchDisplayEpisode>();
  protected readonly href = computed(() => filmTrailerUrl(this.episode()));
  protected readonly kindIcon = contentKindIcon("Film");
  protected readonly kindLabel = "Trailer";
}
