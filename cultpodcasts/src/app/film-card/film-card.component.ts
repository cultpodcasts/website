import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { SearchDisplayEpisode } from "../search-result-links";
import { EpisodePosterComponent } from "../episode-poster/episode-poster.component";

@Component({
  selector: "app-film-card",
  imports: [EpisodePosterComponent],
  templateUrl: "./film-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilmCardComponent {
  readonly episode = input.required<SearchDisplayEpisode>();
  readonly playing = input(false);
  readonly queued = input(false);
  readonly titleAsHtml = input(false);
  readonly showRelease = input(false);
  readonly play = output<SearchDisplayEpisode>();
  protected get playable(): string[] {
    const item = this.episode();
    return ["/film", item.episodeTitle, item.id];
  }
}
