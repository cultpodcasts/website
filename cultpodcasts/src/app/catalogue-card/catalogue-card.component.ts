import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { SearchDisplayEpisode } from "../search-result-links";
import { EpisodePosterComponent } from "../episode-poster/episode-poster.component";
import { FilmCardComponent } from "../film-card/film-card.component";
import { NewsReportCardComponent } from "../news-report-card/news-report-card.component";
import { TvShowEpisodeCardComponent } from "../tv-show-episode-card/tv-show-episode-card.component";

/** List boundary. The podcast poster itself does not choose a kind. */
@Component({
  selector: "app-catalogue-card",
  imports: [EpisodePosterComponent, FilmCardComponent, TvShowEpisodeCardComponent, NewsReportCardComponent],
  templateUrl: "./catalogue-card.component.html",
  styleUrl: "../playable-card-host.sass",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogueCardComponent {
  readonly episode = input.required<SearchDisplayEpisode>();
  readonly playing = input(false);
  readonly queued = input(false);
  readonly showShow = input(true);
  readonly showRelease = input(false);
  readonly titleAsHtml = input(false);
  readonly excludeSubject = input<string | undefined>(undefined);
  readonly showPromote = input(false);
  readonly promoted = input(false);
  readonly play = output<SearchDisplayEpisode>();
  readonly promoteToggle = output<SearchDisplayEpisode>();
}
