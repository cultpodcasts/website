import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { EpisodePosterComponent } from '../episode-poster/episode-poster.component';
import { SearchDisplayEpisode } from '../search-result-links';

@Component({
  selector: 'app-episode-rail',
  imports: [RouterLink, MatIconModule, EpisodePosterComponent],
  templateUrl: './episode-rail.component.html',
  styleUrl: './episode-rail.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'episode-rail-host',
  },
})
export class EpisodeRailComponent {
  readonly title = input.required<string>();
  readonly episodes = input.required<SearchDisplayEpisode[]>();
  /** When set, applies subject rail styling and excludes this subject from poster chips. */
  readonly subject = input<string | undefined>(undefined);
  /** Use the serif display heading (like subject rails) even when this isn't a subject rail. */
  readonly displayTitle = input(false);
  /** Router commands for a linked title (e.g. `['/subject', name]`). */
  readonly titleLink = input<readonly string[] | undefined>(undefined);
  /** Optional “Browse all” link (homepage subject rails). */
  readonly browseAllLink = input<readonly string[] | undefined>(undefined);
  /** Accessible name; defaults to `title`. */
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly showPin = input(false);
  readonly pinned = input(false);
  readonly showPromote = input(false);
  readonly promotedIds = input<ReadonlySet<string>>(new Set());
  readonly showShow = input(true);
  readonly playingEpisodeId = input<string | undefined>(undefined);

  readonly play = output<SearchDisplayEpisode>();
  readonly promoteToggle = output<SearchDisplayEpisode>();
  readonly pinToggle = output<string>();

  protected readonly resolvedAriaLabel = computed(() => this.ariaLabel() ?? this.title());

  protected readonly useDisplayTitle = computed(() => this.displayTitle() || !!this.subject());

  protected isPromoted(episodeId: string): boolean {
    return this.promotedIds().has(episodeId);
  }

  protected isPlaying(episodeId: string): boolean {
    return this.playingEpisodeId() === episodeId;
  }

  onPin(event: Event): void {
    const subject = this.subject();
    if (!subject) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.pinToggle.emit(subject);
  }
}
