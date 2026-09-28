import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { SearchDisplayEpisode } from "../search-result-links";
import { EpisodePosterComponent } from "../episode-poster/episode-poster.component";

@Component({
  selector: "app-tv-show-episode-card",
  imports: [EpisodePosterComponent],
  templateUrl: "./tv-show-episode-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvShowEpisodeCardComponent {
  readonly episode = input.required<SearchDisplayEpisode>();
  readonly playing = input(false);
  readonly queued = input(false);
  readonly titleAsHtml = input(false);
  readonly showRelease = input(false);
  readonly excludeSubject = input<string | undefined>(undefined);
  readonly play = output<SearchDisplayEpisode>();
  protected get playable(): string[] {
    const item = this.episode();
    return ["/tv", item.podcastName, item.id];
  }
  protected get parent(): string[] {
    return ["/tv", this.episode().podcastName];
  }
}
