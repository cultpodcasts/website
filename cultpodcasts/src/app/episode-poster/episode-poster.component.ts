import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { canPlayEpisode, playActionLabel } from '../episode-embed';
import { languageFlagBadgeForEpisode, LanguageFlagBadge } from '../language-flag';
import { SearchDisplayEpisode, episodeArtAspect, episodeImageUrl } from '../search-result-links';
import { displayCatalogName } from '../display-catalog-name';
import { releaseDateLabel } from '../release-label';
import { pickCardSubject } from '../card-subject';
import { SubjectChipComponent } from '../subject-chip/subject-chip.component';
import { PlayerService } from '../player.service';

@Component({
  selector: 'app-episode-poster',
  imports: [RouterLink, MatIconModule, SubjectChipComponent],
  templateUrl: './episode-poster.component.html',
  styleUrl: './episode-poster.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'episode-poster',
    '[class.episode-poster--playing]': 'playing()',
    '[class.episode-poster--wide]': 'artAspect() === "wide"',
    '[class.episode-poster--square]': 'artAspect() === "square"',
  },
})
export class EpisodePosterComponent {
  private readonly playerService = inject(PlayerService);

  readonly episode = input.required<SearchDisplayEpisode>();
  readonly playing = input(false);
  /** Show podcast name under the title (hide on podcast pages). */
  readonly showShow = input(true);
  /**
   * Show the publication date under the title. Off by default: date-grouped rails
   * already state it in their heading, where repeating it per card is noise.
   */
  readonly showRelease = input(false);
  /** Search hit titles may contain highlight markup. */
  readonly titleAsHtml = input(false);
  /** Subject-scoped views pass their own subject so the card's chip adds new information. */
  readonly excludeSubject = input<string | undefined>(undefined);
  /** Curator-only: show a star to promote/demote this episode in the homepage hero. */
  readonly showPromote = input(false);
  /** Whether this episode is currently in the curated hero list. */
  readonly promoted = input(false);
  /**
   * Queue membership from the parent (`playerService.queuedKeys().has(id)`).
   * Kept as an input so OnPush only refreshes posters whose flag actually flipped.
   */
  readonly queued = input(false);

  readonly play = output<SearchDisplayEpisode>();
  readonly promoteToggle = output<SearchDisplayEpisode>();

  protected readonly displayCatalogName = displayCatalogName;

  protected readonly imageUrl = computed(() =>
    episodeImageUrl(this.episode())?.toString()
  );

  /** YouTube thumbnail → wide 16:9; Spotify/Apple/feed art → square. */
  protected readonly artAspect = computed(() => episodeArtAspect(this.episode()));

  protected readonly playable = computed(() => canPlayEpisode(this.episode()));

  protected readonly playLabel = computed(() => playActionLabel(this.episode()));

  protected readonly duration = computed(() => {
    const raw = this.episode().duration ?? '';
    const cleaned = raw.split('.')[0];
    return cleaned.startsWith('0') ? cleaned.substring(1) : cleaned;
  });

  protected readonly languageBadge = computed((): LanguageFlagBadge | undefined =>
    languageFlagBadgeForEpisode(this.episode())
  );

  protected readonly releaseLabel = computed(() =>
    releaseDateLabel(this.episode().release)
  );

  /** One subject per card so a title alone doesn't have to explain what the episode is about. */
  protected readonly subject = computed((): string | undefined =>
    pickCardSubject(this.episode().subjects, this.excludeSubject())
  );

  onPlay(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.playable()) {
      this.play.emit(this.episode());
    }
  }

  onToggleQueue(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.playable()) {
      this.playerService.toggleQueue(this.episode());
    }
  }

  onPromoteToggle(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.promoteToggle.emit(this.episode());
  }
}
