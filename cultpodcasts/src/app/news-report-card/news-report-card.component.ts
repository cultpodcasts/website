import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { SearchDisplayEpisode } from "../search-result-links";
import { EpisodePosterComponent } from "../episode-poster/episode-poster.component";

@Component({
  selector: "app-news-report-card",
  imports: [EpisodePosterComponent],
  templateUrl: "./news-report-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsReportCardComponent {
  readonly episode = input.required<SearchDisplayEpisode>();
  readonly playing = input(false);
  readonly queued = input(false);
  readonly titleAsHtml = input(false);
  readonly showRelease = input(false);
  readonly excludeSubject = input<string | undefined>(undefined);
  readonly play = output<SearchDisplayEpisode>();
  protected get playable(): string[] {
    const item = this.episode();
    return ["/news", item.podcastName, item.id];
  }
  protected get parent(): string[] {
    return ["/news", this.episode().podcastName];
  }
}
