import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { filmTrailerEpisode, parseFilmTrailerTokens } from '../film-trailer';
import { EpisodeRailComponent } from '../episode-rail/episode-rail.component';
import { PlayerService } from '../player.service';
import { SearchDisplayEpisode } from '../search-result-links';
import { startEpisodePlayback } from '../episode-embed';

/**
 * The film page's Trailers rail: the film search document's `trailers` tokens as rail cards, in display order, on
 * the same rail as the page's "More on" rails. Renders nothing when the film has none. Trailers have no pages of
 * their own: a YouTube trailer plays in the site player, others open their video (see filmTrailerEpisode).
 */
@Component({
  selector: 'app-film-trailers',
  imports: [EpisodeRailComponent],
  templateUrl: './film-trailers.component.html',
  styleUrl: './film-trailers.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilmTrailersComponent {
  private readonly playerService = inject(PlayerService);

  readonly trailers = input<readonly string[] | null | undefined>(undefined);
  /** The film's id, so trailer card ids are unique across films (player and queue). */
  readonly filmId = input.required<string>();

  protected readonly episodes = computed(() =>
    parseFilmTrailerTokens(this.trailers()).map((link, index) => filmTrailerEpisode(link, this.filmId(), index))
  );
  protected readonly playingEpisodeId = computed(() => this.playerService.episode()?.id);

  protected play(episode: SearchDisplayEpisode): void {
    startEpisodePlayback(episode, (playable) => this.playerService.play(playable));
  }
}
