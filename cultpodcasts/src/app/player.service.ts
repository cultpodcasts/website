import { Injectable, computed, signal } from '@angular/core';
import { SearchDisplayEpisode } from './search-result-links';
import { episodeEmbedOptions, preferredEmbedService } from './episode-embed';

export type PlayerMode = 'theater' | 'dock';

export interface QueueItem {
  key: string;
  episode: SearchDisplayEpisode;
}

/**
 * Single source of truth for "now playing" + play queue, shared by every page.
 * A single `EpisodePlayerComponent` (mounted once in the app shell) renders
 * whatever this service holds, so navigating between pages doesn't interrupt
 * playback or drop the queue.
 */
@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly _episode = signal<SearchDisplayEpisode | undefined>(undefined);
  private readonly _mode = signal<PlayerMode>('dock');
  private readonly _queue = signal<QueueItem[]>([]);
  private readonly _queueOpen = signal(false);

  readonly episode = this._episode.asReadonly();
  readonly mode = this._mode.asReadonly();
  readonly queue = this._queue.asReadonly();
  readonly queueOpen = this._queueOpen.asReadonly();

  readonly isOpen = computed(() => !!this._episode());
  readonly isVideo = computed(() => this.preferredServiceFor(this._episode()) === 'youtube');

  /**
   * Start playing an episode. Defaults to theater mode for video (YouTube) and
   * dock mode for audio-only episodes, unless a mode is explicitly requested.
   */
  play(episode: SearchDisplayEpisode, opts?: { mode?: PlayerMode }): void {
    this._episode.set(episode);
    this.removeFromQueue(episode);
    const defaultMode: PlayerMode = this.preferredServiceFor(episode) === 'youtube' ? 'theater' : 'dock';
    this._mode.set(opts?.mode ?? defaultMode);
  }

  close(): void {
    this._episode.set(undefined);
  }

  expand(): void {
    this._mode.set('theater');
  }

  minimize(): void {
    this._mode.set('dock');
  }

  toggleMode(): void {
    this._mode.set(this._mode() === 'theater' ? 'dock' : 'theater');
  }

  addToQueue(episode: SearchDisplayEpisode): void {
    const key = this.keyFor(episode);
    if (!key || key === this.keyFor(this._episode())) {
      return;
    }
    if (this._queue().some((item) => item.key === key)) {
      return;
    }
    this._queue.update((items) => [...items, { key, episode }]);
  }

  removeFromQueue(episode: SearchDisplayEpisode): void {
    const key = this.keyFor(episode);
    if (!key) {
      return;
    }
    this._queue.update((items) => items.filter((item) => item.key !== key));
  }

  isQueued(episode: SearchDisplayEpisode | undefined): boolean {
    const key = this.keyFor(episode);
    if (!key) {
      return false;
    }
    return this._queue().some((item) => item.key === key);
  }

  toggleQueue(episode: SearchDisplayEpisode): void {
    if (this.isQueued(episode)) {
      this.removeFromQueue(episode);
    } else {
      this.addToQueue(episode);
    }
  }

  playFromQueue(episode: SearchDisplayEpisode): void {
    this.removeFromQueue(episode);
    this.play(episode);
  }

  /** Advance to the next queued episode, if any. Returns whether playback advanced. */
  playNext(): boolean {
    const [next, ...rest] = this._queue();
    if (!next) {
      return false;
    }
    this._queue.set(rest);
    this.play(next.episode);
    return true;
  }

  clearQueue(): void {
    this._queue.set([]);
  }

  openQueuePanel(): void {
    this._queueOpen.set(true);
  }

  closeQueuePanel(): void {
    this._queueOpen.set(false);
  }

  toggleQueuePanel(): void {
    this._queueOpen.update((open) => !open);
  }

  private preferredServiceFor(episode: SearchDisplayEpisode | undefined) {
    return episode ? preferredEmbedService(episodeEmbedOptions(episode)) : undefined;
  }

  private keyFor(episode: SearchDisplayEpisode | undefined): string | undefined {
    return episode?.id;
  }
}
