import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { SearchDisplayEpisode } from "../search-result-links";
import { contentKindIcon } from "../content-kind-label";
import { EpisodePosterComponent } from "../episode-poster/episode-poster.component";
import { tvShowEpisodePageCommands } from "../catalogue-links";

@Component({
  selector: "app-tv-show-episode-card",
  imports: [EpisodePosterComponent],
  templateUrl: "./tv-show-episode-card.component.html",
  styleUrl: "../playable-card-host.sass",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvShowEpisodeCardComponent {
  readonly episode = input.required<SearchDisplayEpisode>();
  readonly playing = input(false);
  readonly queued = input(false);
  readonly titleAsHtml = input(false);
  readonly showRelease = input(false);
  readonly excludeSubject = input<string | undefined>(undefined);
  /** Curator-only homepage hero star, as on podcast cards. */
  readonly showPromote = input(false);
  readonly promoted = input(false);
  readonly play = output<SearchDisplayEpisode>();
  readonly promoteToggle = output<SearchDisplayEpisode>();
  protected readonly kindIcon = contentKindIcon("TvShowEpisode");
  protected get playable(): string[] {
    const item = this.episode();
    return tvShowEpisodePageCommands(item.podcastName, item.id);
  }
  protected get parent(): string[] {
    return ["/tv", this.episode().podcastName];
  }
}
