import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SearchDisplayEpisode } from './search-result-links';
import { episodeEmbedOptions, preferredEmbedService } from './episode-embed';

export type PlayerMode = 'theater' | 'dock';

export interface QueueItem {
  key: string;
  episode: SearchDisplayEpisode;
}

const SESSION_STORAGE_KEY = 'flix.player.session.v1';
/** Stale sessions older than this aren't offered for resume. */
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Snapshot persisted to `localStorage` so a play queue survives closing the tab. */
export interface PersistedPlayerSession {
  v: 1;
  savedAt: number;
  mode: PlayerMode;
  nowPlaying?: SearchDisplayEpisode;
  queue: QueueItem[];
}

/**
 * Single source of truth for "now playing" + play queue, shared by every page.
 * A single `EpisodePlayerComponent` (mounted once in the app shell) renders
 * whatever this service holds, so navigating between pages doesn't interrupt
 * playback or drop the queue.
 */
@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

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

  /** A previously-saved session offered for resume; unset once the user resumes or dismisses it. */
  private readonly _pendingResume = signal<PersistedPlayerSession | undefined>(undefined);
  readonly pendingResume = this._pendingResume.asReadonly();

  /**
   * Guards the auto-persist effect below: stays `false` until any pending resume prompt has
   * been resolved, so we don't silently overwrite the saved session with the (empty) live
   * state while the user hasn't yet answered "resume?".
   */
  private canPersist = false;

  constructor() {
    if (this.isBrowser) {
      const saved = this.loadSession();
      if (saved && (saved.queue.length > 0 || saved.nowPlaying)) {
        this._pendingResume.set(saved);
      } else {
        this.canPersist = true;
      }

      effect(() => {
        const snapshot: PersistedPlayerSession = {
          v: 1,
          savedAt: Date.now(),
          mode: this._mode(),
          nowPlaying: this._episode(),
          queue: this._queue(),
        };
        if (!this.canPersist) {
          return;
        }
        this.persistSession(snapshot);
      });
    }
  }

  /** Restore the saved queue/now-playing from a pending resume prompt. Does not force playback. */
  resumeSession(): void {
    const saved = this._pendingResume();
    if (!saved) {
      return;
    }
    this._pendingResume.set(undefined);
    this.canPersist = true;
    if (saved.nowPlaying) {
      this._episode.set(saved.nowPlaying);
      this._mode.set(saved.mode ?? this.defaultModeFor(saved.nowPlaying));
    }
    this._queue.set(saved.queue);
  }

  /** Discard a pending resume prompt and wipe the saved session. */
  dismissSession(): void {
    this._pendingResume.set(undefined);
    this.canPersist = true;
    this.clearStoredSession();
  }

  private loadSession(): PersistedPlayerSession | undefined {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        return undefined;
      }
      const parsed = JSON.parse(raw) as Partial<PersistedPlayerSession>;
      if (
        parsed?.v !== 1 ||
        typeof parsed.savedAt !== 'number' ||
        !Array.isArray(parsed.queue)
      ) {
        this.clearStoredSession();
        return undefined;
      }
      if (Date.now() - parsed.savedAt > SESSION_MAX_AGE_MS) {
        this.clearStoredSession();
        return undefined;
      }
      return {
        v: 1,
        savedAt: parsed.savedAt,
        mode: parsed.mode === 'theater' ? 'theater' : 'dock',
        nowPlaying: parsed.nowPlaying,
        queue: parsed.queue.filter((item): item is QueueItem => !!item?.key && !!item?.episode),
      };
    } catch {
      this.clearStoredSession();
      return undefined;
    }
  }

  private persistSession(snapshot: PersistedPlayerSession): void {
    try {
      if (!snapshot.nowPlaying && snapshot.queue.length === 0) {
        this.clearStoredSession();
        return;
      }
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Storage full/unavailable (private browsing etc.) — resume is best-effort.
    }
  }

  private clearStoredSession(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore — nothing to clean up if storage isn't available.
    }
  }

  /**
   * Start playing an episode. Defaults to theater mode for video (YouTube) and
   * dock mode for audio-only episodes, unless a mode is explicitly requested.
   */
  play(episode: SearchDisplayEpisode, opts?: { mode?: PlayerMode }): void {
    this._episode.set(episode);
    this.removeFromQueue(episode);
    this._mode.set(opts?.mode ?? this.defaultModeFor(episode));
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

  private defaultModeFor(episode: SearchDisplayEpisode): PlayerMode {
    return this.preferredServiceFor(episode) === 'youtube' ? 'theater' : 'dock';
  }

  private keyFor(episode: SearchDisplayEpisode | undefined): string | undefined {
    return episode?.id;
  }
}
