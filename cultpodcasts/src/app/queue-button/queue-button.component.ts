import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PlayerService } from '../player.service';
import { SearchDisplayEpisode } from '../search-result-links';
import { canEmbedEpisode } from '../episode-embed';

/**
 * Labelled "Add to Queue" / "Queued" toggle for the in-app player queue, shared
 * by the episode page and the homepage hero. Same rules as the search cards'
 * icon button (`episode-poster`): shown only when the episode can be embedded
 * (outbound Watch/Listen has nothing to enqueue), for every visitor (the queue
 * is local, no sign-in), and it toggles `PlayerService` queue membership.
 */
@Component({
  selector: 'app-queue-button',
  imports: [MatIconModule],
  templateUrl: './queue-button.component.html',
  styleUrl: './queue-button.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueueButtonComponent {
  private readonly playerService = inject(PlayerService);

  readonly episode = input.required<SearchDisplayEpisode>();
  /** `square` (default): the episode page's 4px outline. `pill`: rounded, for the homepage hero. */
  readonly shape = input<'square' | 'pill'>('square');

  protected readonly queueable = computed(() => canEmbedEpisode(this.episode()));
  protected readonly queued = computed(() => this.playerService.isQueuedId(this.episode().id));

  protected toggle(event: Event): void {
    event.stopPropagation();
    if (this.queueable()) {
      this.playerService.toggleQueue(this.episode());
    }
  }
}
