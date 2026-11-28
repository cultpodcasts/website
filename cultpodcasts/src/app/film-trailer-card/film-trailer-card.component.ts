import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { SearchDisplayEpisode } from "../search-result-links";
import { EpisodePosterComponent } from "../episode-poster/episode-poster.component";
import { contentKindIcon } from "../content-kind-label";
import { filmTrailerUrl } from "../film-trailer";
import { TV_SHOW_TRAILER_CONTENT_KIND } from "../tv-show-trailer";

/**
 * A film trailer on the film page's Trailers rail (filmTrailerEpisode), or a TV show trailer on the TV show page's rail
 * (tvShowTrailerEpisode, RPP #1412; only the icon differs). A trailer has no page of its own, so the
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
  protected readonly kindIcon = computed(() =>
    contentKindIcon(this.episode().contentKind === TV_SHOW_TRAILER_CONTENT_KIND ? "TvShowEpisode" : "Film"));
  protected readonly kindLabel = "Trailer";
}
