import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { SearchDisplayEpisode } from "../search-result-links";
import { contentKindIcon, contentKindLabel } from "../content-kind-label";
import { EpisodePosterComponent } from "../episode-poster/episode-poster.component";
import { filmPageCommands } from "../catalogue-links";

@Component({
  selector: "app-film-card",
  imports: [EpisodePosterComponent],
  templateUrl: "./film-card.component.html",
  styleUrl: "../playable-card-host.sass",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilmCardComponent {
  readonly episode = input.required<SearchDisplayEpisode>();
  readonly playing = input(false);
  readonly queued = input(false);
  readonly titleAsHtml = input(false);
  readonly showRelease = input(false);
  /** Curator-only homepage hero star, as on podcast cards. */
  readonly showPromote = input(false);
  readonly promoted = input(false);
  readonly play = output<SearchDisplayEpisode>();
  readonly promoteToggle = output<SearchDisplayEpisode>();
  /** A film has no parent: the byline is a plain "Film" label with the film icon. */
  protected readonly kindIcon = contentKindIcon("Film");
  protected readonly kindLabel = contentKindLabel("Film");
  protected get playable(): string[] {
    const item = this.episode();
    return filmPageCommands(item.episodeTitle, item.id);
  }
}
