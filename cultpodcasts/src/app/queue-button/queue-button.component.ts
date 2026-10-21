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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (queueable()) {
    <button type="button" class="queue-button" [class.is-queued]="queued()"
      [attr.aria-label]="queued() ? 'Remove from queue' : 'Add to queue'" (click)="toggle($event)">
      <mat-icon>{{ queued() ? 'playlist_add_check' : 'playlist_add' }}</mat-icon>
      {{ queued() ? 'Queued' : 'Add to Queue' }}
    </button>
    }
  `,
  styles: `
    :host
      display: inline-flex
    :host(:empty)
      display: none
    .queue-button
      flex: 1 1 auto
      display: inline-flex
      align-items: center
      justify-content: center
      gap: 6px
      margin: 0
      padding: 9px 16px
      border: 1px solid rgba(255, 255, 255, 0.45)
      border-radius: 4px
      background: rgba(20, 20, 20, 0.55)
      color: #fff
      font: inherit
      font-size: 0.92rem
      font-weight: 600
      cursor: pointer
      backdrop-filter: blur(8px)
      mat-icon
        font-size: 20px
        width: 20px
        height: 20px
      &:hover,
      &:focus-visible
        border-color: var(--nflx-accent)
        color: var(--nflx-accent)
        outline: none
      &.is-queued
        border-color: var(--nflx-accent)
        background: rgba(232, 162, 58, 0.18)
        color: var(--nflx-accent)
  `,
})
export class QueueButtonComponent {
  private readonly playerService = inject(PlayerService);

  readonly episode = input.required<SearchDisplayEpisode>();

  protected readonly queueable = computed(() => canEmbedEpisode(this.episode()));
  protected readonly queued = computed(() => this.playerService.isQueuedId(this.episode().id));

  protected toggle(event: Event): void {
    event.stopPropagation();
    if (this.queueable()) {
      this.playerService.toggleQueue(this.episode());
    }
  }
}
