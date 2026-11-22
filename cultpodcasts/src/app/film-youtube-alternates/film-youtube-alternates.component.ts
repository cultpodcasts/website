import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { parseYouTubeAlternateTokens, youTubeAlternateEpisode } from '../youtube-alternate';
import { EpisodeRailComponent } from '../episode-rail/episode-rail.component';
import { PlayerService } from '../player.service';
import { SearchDisplayEpisode } from '../search-result-links';
import { startEpisodePlayback } from '../episode-embed';

/**
 * Public "Also on YouTube" rail: the search document's `youTubeAlternates` tokens as rail cards, in display
 * order (RPP #1411). Renders nothing when the item has none. Cards play in the site player.
 */
@Component({
  selector: 'app-film-youtube-alternates',
  imports: [EpisodeRailComponent],
  templateUrl: './film-youtube-alternates.component.html',
  styleUrl: './film-youtube-alternates.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilmYouTubeAlternatesComponent {
  private readonly playerService = inject(PlayerService);

  readonly tokens = input<readonly string[] | null | undefined>(undefined);
  readonly itemId = input.required<string>();
  readonly itemTitle = input('');
  readonly ownerContentKind = input<string | null | undefined>(undefined);
  readonly parentName = input('');

  protected readonly episodes = computed(() =>
    parseYouTubeAlternateTokens(this.tokens()).map((link, index) =>
      youTubeAlternateEpisode(link, this.itemId(), index, this.itemTitle(), {
        contentKind: this.ownerContentKind(),
        parentName: this.parentName(),
      })
    )
  );
  protected readonly playingEpisodeId = computed(() => this.playerService.episode()?.id);

  protected play(episode: SearchDisplayEpisode): void {
    startEpisodePlayback(episode, (playable) => this.playerService.play(playable));
  }
}
