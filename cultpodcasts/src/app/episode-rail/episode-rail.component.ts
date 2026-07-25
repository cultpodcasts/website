import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { EpisodePosterComponent } from '../episode-poster/episode-poster.component';
import { SearchDisplayEpisode } from '../search-result-links';
import { PlayerService } from '../player.service';

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
  private readonly playerService = inject(PlayerService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

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
  /**
   * When true, poster DOM stays empty until the rail nears the viewport
   * (homepage day rails). Heading + reserved height always render.
   */
  readonly deferPosters = input(false);

  readonly play = output<SearchDisplayEpisode>();
  readonly promoteToggle = output<SearchDisplayEpisode>();
  readonly pinToggle = output<string>();

  protected readonly resolvedAriaLabel = computed(() => this.ariaLabel() ?? this.title());

  protected readonly useDisplayTitle = computed(() => this.displayTitle() || !!this.subject());

  /** Eager when not deferring; deferred until IntersectionObserver fires once. */
  protected readonly postersActive = linkedSignal(() => !this.deferPosters());

  private readonly queuedKeys = computed(() => this.playerService.queuedKeys());
  private observer: IntersectionObserver | undefined;

  constructor() {
    afterNextRender(() => {
      if (!this.deferPosters() || this.postersActive()) {
        return;
      }
      if (!isPlatformBrowser(this.platformId) || typeof IntersectionObserver === 'undefined') {
        return;
      }
      this.observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) {
            return;
          }
          this.postersActive.set(true);
          this.disconnectObserver();
        },
        { rootMargin: '800px 0px', threshold: 0 }
      );
      this.observer.observe(this.elementRef.nativeElement);
    });

    this.destroyRef.onDestroy(() => this.disconnectObserver());
  }

  protected isPromoted(episodeId: string): boolean {
    return this.promotedIds().has(episodeId);
  }

  protected isPlaying(episodeId: string): boolean {
    return this.playingEpisodeId() === episodeId;
  }

  protected isQueued(episodeId: string): boolean {
    return this.queuedKeys().has(episodeId);
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

  private disconnectObserver(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }
}
