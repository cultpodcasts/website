import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { canPlayEpisode, playActionLabel } from '../episode-embed';
import { languageLabel } from '../subject-language-filter';
import { SearchDisplayEpisode, episodeImageUrl } from '../search-result-links';
import { HomepageEpisode } from '../homepage-episode.interface';

@Component({
  selector: 'app-episode-poster',
  imports: [RouterLink, MatIconModule],
  templateUrl: './episode-poster.component.html',
  styleUrl: './episode-poster.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'episode-poster',
    '[class.episode-poster--playing]': 'playing()',
  },
})
export class EpisodePosterComponent {
  readonly episode = input.required<SearchDisplayEpisode>();
  readonly playing = input(false);
  /** Show podcast name under the title (hide on podcast pages). */
  readonly showShow = input(true);
  /** Search hit titles may contain highlight markup. */
  readonly titleAsHtml = input(false);

  readonly play = output<SearchDisplayEpisode>();

  protected readonly imageUrl = computed(() =>
    episodeImageUrl(this.episode())?.toString()
  );

  protected readonly playable = computed(() => canPlayEpisode(this.episode()));

  protected readonly playLabel = computed(() => playActionLabel(this.episode()));

  protected readonly duration = computed(() => {
    const raw = this.episode().duration ?? '';
    const cleaned = raw.split('.')[0];
    return cleaned.startsWith('0') ? cleaned.substring(1) : cleaned;
  });

  protected readonly languageBadge = computed(() => {
    const ep = this.episode();
    const code = 'language' in ep ? (ep as HomepageEpisode).language?.trim() : undefined;
    if (!code) {
      return undefined;
    }
    const lower = code.toLowerCase();
    if (lower === 'en' || lower.startsWith('en-') || lower.startsWith('en_')) {
      return undefined;
    }
    return languageLabel(code);
  });

  onPlay(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.playable()) {
      this.play.emit(this.episode());
    }
  }
}
